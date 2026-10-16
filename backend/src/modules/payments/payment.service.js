const pool = require('../../config/database');
const razorpay = require('../../config/razorpay');
const { matchDelivery } = require('../delivery/matching.service');
const { ensureOutboundDelivery } = require('../delivery/delivery-request.service');
const { emitUser } = require('../../shared/realtime');
const crypto = require('crypto');
require('dotenv').config();

// Helper to check if Razorpay is running in real or simulation mode
const isSimulationMode = () => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  return !key_id || !key_secret || String(key_id).includes('your_') || String(key_secret).includes('your_');
};

class PaymentService {
  constructor({ db = pool, gateway = razorpay, publish = emitUser, simulation = isSimulationMode, lookupTimeoutMs = 15000 } = {}) {
    this.db = db;
    this.gateway = gateway;
    this.publish = publish;
    this.simulation = simulation;
    this.lookupTimeoutMs = lookupTimeoutMs;
  }

  async withRentalTransaction(bookingId, userId, action) {
    const client = await this.db.connect();
    const context = { client };
    let result;
    try {
      await client.query('BEGIN');
      // Creation, callback verification and recovery must serialize on the same
      // rental. A second click must not produce another independently payable order.
      const res = await client.query('SELECT * FROM rentals WHERE id = $1 FOR UPDATE', [bookingId]);
      if (!res.rows.length) throw Object.assign(new Error('Booking not found.'), { status: 404 });
      context.booking = res.rows[0];
      if (context.booking.borrower_id !== userId) {
        throw Object.assign(new Error('Unauthorized to pay for this booking.'), { status: 403 });
      }
      result = await action(context);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    // A socket failure must not make a committed payment look unsuccessful.
    if (context.rentalEvent) {
      try {
        this.publish(context.booking.owner_id, 'rental:request', context.rentalEvent);
        this.publish(context.booking.borrower_id, 'rental:status', context.rentalEvent);
      } catch {
        console.error('[PaymentService] Rental payment committed; realtime notification unavailable.');
      }
    }
    return result;
  }

  rentalPaymentResult(booking, extra = {}) {
    return { rental_id: booking.id, booking_id: booking.id, status: booking.status, ...extra };
  }

  async paidRentalPayment({ client, booking }) {
    const result = await client.query(
      "SELECT id, transaction_id FROM payments WHERE rental_id = $1 AND payment_type = 'RENTAL' AND status = 'PAID' ORDER BY created_at LIMIT 1",
      [booking.id],
    );
    return result.rows[0];
  }

  assertRentalPayable(booking) {
    if (!['BOOKING_PAYMENT_PENDING', 'BOOKING_REQUESTED'].includes(booking.status)) {
      throw Object.assign(new Error(`This booking cannot accept another rental payment (${booking.status}).`), { status: 409 });
    }
    const amount = Math.round(Number(booking.booking_amount) * 100);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw Object.assign(new Error('The booking amount is invalid. Please contact support.'), { status: 409 });
    }
    return amount;
  }

  async providerRead(context, read) {
    // Read requests can finish safely after a timeout, but must not hold a rental
    // lock indefinitely or make us create another payable order on uncertainty.
    context.lookupDeadline ||= Date.now() + this.lookupTimeoutMs;
    const remaining = context.lookupDeadline - Date.now();
    if (remaining <= 0) throw new Error('Payment provider lookup timed out.');
    let timer;
    try {
      return await Promise.race([
        read(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Payment provider lookup timed out.')), remaining);
        }),
      ]);
    } finally {
      globalThis.clearTimeout(timer);
    }
  }

  async inspectRentalOrders(context) {
    const { client, booking } = context;
    const result = await client.query(
      "SELECT * FROM payments WHERE rental_id = $1 AND payment_type = 'RENTAL' AND status = 'PENDING' ORDER BY created_at DESC, id DESC",
      [booking.id],
    );
    const amount = Math.round(Number(booking.booking_amount) * 100);
    const captured = new Map();
    let reusable, pending = false;
    for (const record of result.rows) {
      const orderId = record.transaction_id || '';
      if (orderId.startsWith('sim_order_')) {
        // Simulation records cannot prove payment or be reused with real keys.
        if (this.simulation() && Math.round(Number(record.amount) * 100) === amount) reusable ||= record;
        continue;
      }
      if (!/^order_[A-Za-z0-9]+$/.test(orderId) || Math.round(Number(record.amount) * 100) !== amount) {
        throw Object.assign(new Error('The saved payment order does not match this booking. Please contact support before paying again.'), { status: 409 });
      }
      if (this.simulation()) {
        throw Object.assign(new Error('Payment confirmation is not configured. Please retry later; do not pay again.'), { status: 503 });
      }
      let order, payments;
      try {
        order = await this.providerRead(context, () => this.gateway.orders.fetch(orderId));
        payments = await this.providerRead(context, () => this.gateway.orders.fetchPayments(orderId));
      } catch {
        throw Object.assign(new Error('Could not check the existing payment. Please retry confirmation; do not pay again.'), { status: 503 });
      }
      if (order.id !== orderId || order.currency !== 'INR' || Number(order.amount) !== amount ||
          (order.notes?.booking_id && order.notes.booking_id !== booking.id) ||
          !Array.isArray(payments.items) || !['created', 'attempted', 'paid'].includes(order.status)) {
        throw Object.assign(new Error('The provider payment order does not match this booking. Please contact support.'), { status: 409 });
      }
      let orderCaptured = false;
      for (const payment of payments.items) {
        if (!['captured', 'authorized', 'created'].includes(payment.status)) continue;
        if (payment.order_id !== orderId || payment.currency !== 'INR' || Number(payment.amount) !== amount) {
          throw Object.assign(new Error('The provider payment does not match the booking amount. Please contact support.'), { status: 409 });
        }
        if (payment.status !== 'captured') {
          pending = true;
          continue;
        }
        let verified;
        try {
          verified = await this.providerRead(context, () => this.gateway.payments.fetch(payment.id));
        } catch {
          throw Object.assign(new Error('Could not confirm the captured payment. Please retry confirmation; do not pay again.'), { status: 503 });
        }
        if (verified.id !== payment.id || verified.order_id !== orderId || verified.status !== 'captured' ||
            verified.captured !== true || verified.currency !== 'INR' || Number(verified.amount) !== amount) {
          throw Object.assign(new Error('Payment capture could not be confirmed. Please retry confirmation; do not pay again.'), { status: 409 });
        }
        captured.set(verified.id, { record, paymentId: verified.id });
        orderCaptured = true;
      }
      if (order.status === 'paid' && !orderCaptured) pending = true;
      if (order.status !== 'paid') reusable ||= record;
    }
    if (captured.size > 1) {
      throw Object.assign(new Error('More than one captured payment needs review. Please contact support; do not pay again.'), { status: 409 });
    }
    return { captured: [...captured.values()][0], reusable, pending };
  }

  async settleRentalPayment(context, record, paymentId) {
    const { client, booking } = context;
    const amount = this.assertRentalPayable(booking);
    if (Math.round(Number(record.amount) * 100) !== amount) {
      throw Object.assign(new Error('The payment amount does not match this booking.'), { status: 409 });
    }
    const updated = await client.query(
      "UPDATE payments SET transaction_id = $1, status = 'PAID' WHERE id = $2 AND status = 'PENDING' RETURNING id",
      [paymentId, record.id],
    );
    if (!updated.rowCount) throw Object.assign(new Error('Payment order is no longer pending.'), { status: 409 });
    await client.query(`
      UPDATE rentals SET status = 'RENTAL_PAYMENT_COMPLETED', booking_status = 'PAYMENT_COMPLETED',
        payment_status = 'RENTAL_PAID', updated_at = NOW() WHERE id = $1
    `, [booking.id]);
    await client.query(
      `INSERT INTO transaction_events (rental_id, event_type, actor_user_id, metadata)
       VALUES ($1, 'RENTAL_PAYMENT_COMPLETED', $2, $3)`,
      [booking.id, booking.borrower_id, { amount: Number(booking.booking_amount), gateway_order_id: record.transaction_id }],
    );
    booking.status = 'RENTAL_PAYMENT_COMPLETED';
    context.rentalEvent = {
      rental_id: booking.id, owner_id: booking.owner_id, renter_id: booking.borrower_id, status: booking.status,
    };
    return this.rentalPaymentResult(booking, {
      paid: true, already_paid: true, message: 'Rental payment verified. Waiting for owner to accept.',
    });
  }

  /** Recover a lost browser callback using only orders already bound to this rental. */
  async reconcileRentalPayment(bookingId, userId) {
    return this.withRentalTransaction(bookingId, userId, async (context) => {
      if (await this.paidRentalPayment(context)) return this.rentalPaymentResult(context.booking, { paid: true, already_paid: true });
      const checked = await this.inspectRentalOrders(context);
      if (checked.captured) return this.settleRentalPayment(context, checked.captured.record, checked.captured.paymentId);
      return this.rentalPaymentResult(context.booking, {
        paid: false, ...(checked.pending ? { pending: true, awaiting_capture: true } : {}),
      });
    });
  }

  /**
   * Create a Razorpay order for the rental fee (Step 1)
   */
  async createRentalOrder(bookingId, userId) {
    return this.withRentalTransaction(bookingId, userId, async (context) => {
      const { client, booking } = context;
      if (await this.paidRentalPayment(context)) return this.rentalPaymentResult(booking, { paid: true, already_paid: true });
      const amountPaise = this.assertRentalPayable(booking);
      const checked = await this.inspectRentalOrders(context);
      if (checked.captured) return this.settleRentalPayment(context, checked.captured.record, checked.captured.paymentId);
      if (checked.pending) {
        throw Object.assign(new Error('Your payment is still being confirmed. Please retry confirmation; do not pay again.'), { status: 409 });
      }
      let orderId = checked.reusable?.transaction_id;
      const simulated = this.simulation();
      if (!orderId) {
        if (simulated) {
          orderId = `sim_order_${crypto.randomBytes(8).toString('hex')}`;
        } else {
          const order = await this.gateway.orders.create({
            amount: amountPaise, currency: 'INR', receipt: `rent_${bookingId.slice(0, 8)}`,
            notes: { booking_id: bookingId, payment_type: 'RENTAL' },
          });
          orderId = order.id;
        }
        await client.query(`
          INSERT INTO payments (rental_id, payment_type, amount, transaction_id, status)
          VALUES ($1, 'RENTAL', $2, $3, 'PENDING')
        `, [bookingId, booking.booking_amount, orderId]);
      }
      return {
        order_id: orderId, amount: booking.booking_amount, currency: 'INR',
        razorpay_key: process.env.RAZORPAY_KEY_ID || 'SIMULATION_MODE', simulated,
        reused: Boolean(checked.reusable),
      };
    });
  }

  /** Signature and capture are checked by verify-payment middleware before this method. */
  async verifyRentalPayment(bookingId, gatewayOrderId, gatewayPaymentId, _gatewaySignature, userId) {
    return this.withRentalTransaction(bookingId, userId, async (context) => {
      const paid = await this.paidRentalPayment(context);
      if (paid) {
        if (paid.transaction_id !== gatewayPaymentId) {
          throw Object.assign(new Error('This booking already has a different completed payment. Please contact support.'), { status: 409 });
        }
        return this.rentalPaymentResult(context.booking, { paid: true, already_paid: true, message: 'Payment already processed.' });
      }
      const pending = await context.client.query(
        "SELECT * FROM payments WHERE rental_id = $1 AND payment_type = 'RENTAL' AND transaction_id = $2 AND status = 'PENDING' ORDER BY created_at LIMIT 1",
        [bookingId, gatewayOrderId],
      );
      if (!pending.rows.length) throw Object.assign(new Error('Payment order not found or already processed.'), { status: 409 });
      return this.settleRentalPayment(context, pending.rows[0], gatewayPaymentId);
    });
  }

  /**
   * Create a Razorpay order for the refundable security deposit (Step 5)
   */
  async createDepositOrder(bookingId, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Fetch the booking/rental
      const res = await client.query(
        'SELECT * FROM rentals WHERE id = $1',
        [bookingId]
      );
      if (res.rows.length === 0) {
        throw new Error('Booking not found.');
      }

      const booking = res.rows[0];

      if (booking.borrower_id !== userId) {
        throw new Error('Unauthorized.');
      }

      if (booking.status !== 'DEPOSIT_PENDING') {
        throw new Error(`Booking status must be DEPOSIT_PENDING to pay security deposit. Current: ${booking.status}`);
      }

      // Check deposit deadline
      if (booking.deposit_deadline && new Date(booking.deposit_deadline) < new Date()) {
        await client.query(`
          UPDATE rentals SET
            status = 'CANCELLED',
            deposit_status = 'TIMEOUT',
            updated_at = NOW()
          WHERE id = $1
        `, [bookingId]);
        await client.query(`
          UPDATE delivery_requests SET status='CANCELLED', updated_at=NOW()
          WHERE rental_id=$1 AND courier_id IS NULL
            AND status IN ('WAITING_FOR_DEPOSIT','MATCHING_COURIER','NO_COURIER_AVAILABLE','AVAILABLE')
        `, [bookingId]);
        await client.query(`
          UPDATE delivery_offers SET status='EXPIRED', responded_at=NOW()
          WHERE delivery_id IN (SELECT id FROM delivery_requests WHERE rental_id=$1)
            AND status='PENDING'
        `, [bookingId]);
        await client.query(
          `INSERT INTO transaction_events (rental_id, event_type, actor_user_id)
           VALUES ($1, 'DEPOSIT_TIMEOUT', $2)`,
          [bookingId, userId],
        );
        await client.query('COMMIT');
        throw Object.assign(new Error('Deposit deadline expired. Booking has been cancelled.'), { status: 409 });
      }

      const amountPaise = Math.round(parseFloat(booking.deposit_amount) * 100);
      const receipt = `dep_${bookingId.slice(0, 8)}`;

      let orderId;
      let simulated = false;

      if (isSimulationMode()) {
        orderId = `sim_order_${crypto.randomBytes(8).toString('hex')}`;
        simulated = true;
        console.log(`[PaymentService] Simulation Mode: Created deposit order ${orderId} for ₹${booking.deposit_amount}`);
      } else {
        const order = await razorpay.orders.create({
          amount: amountPaise,
          currency: 'INR',
          receipt,
          notes: { booking_id: bookingId, payment_type: 'SECURITY_DEPOSIT' }
        });
        orderId = order.id;
      }

      // Store pending payment record
      await client.query(`
        INSERT INTO payments (rental_id, payment_type, amount, transaction_id, status)
        VALUES ($1, 'SECURITY_DEPOSIT', $2, $3, 'PENDING')
      `, [bookingId, booking.deposit_amount, orderId]);

      await client.query('COMMIT');

      return {
        order_id: orderId,
        amount: booking.deposit_amount,
        currency: 'INR',
        razorpay_key: process.env.RAZORPAY_KEY_ID || 'SIMULATION_MODE',
        simulated
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Verify security deposit payment (Step 6)
   */
  async verifyDepositPayment(bookingId, gatewayOrderId, gatewayPaymentId, gatewaySignature, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const res = await client.query('SELECT * FROM rentals WHERE id = $1 FOR UPDATE', [bookingId]);
      if (!res.rows[0]) throw new Error('Booking not found.');
      const booking = res.rows[0];
      if (booking.borrower_id !== userId) throw new Error('Unauthorized.');

      const payCheck = await client.query(
        "SELECT id FROM payments WHERE rental_id=$1 AND payment_type='SECURITY_DEPOSIT' AND status='PAID'",
        [bookingId],
      );
      const depositAlreadyPaid = payCheck.rows.length > 0;
      if (depositAlreadyPaid && booking.payment_status === 'FULLY_PAID') {
        await client.query('COMMIT');
        return { message: 'Payment already processed.', status: booking.status, delivery_id: booking.outbound_delivery_id };
      }
      if (!depositAlreadyPaid) {
        const paymentUpdate = await client.query(
          "UPDATE payments SET transaction_id=$1,status='PAID' WHERE rental_id=$2 AND payment_type='SECURITY_DEPOSIT' AND transaction_id=$3 AND status='PENDING'",
          [gatewayPaymentId, bookingId, gatewayOrderId],
        );
        if (!paymentUpdate.rowCount) throw new Error('Payment order not found or already processed.');
      }

      const rentalPaymentRes = await client.query(
        "SELECT status FROM payments WHERE rental_id=$1 AND payment_type='RENTAL' AND status='PAID'",
        [bookingId],
      );
      const isRentalPaid = rentalPaymentRes.rows.length > 0;
      const isDelivery = Boolean(booking.delivery_requested || Number(booking.delivery_fee) > 0);
      let deliveryId = null;
      let qrCodeHash = null;
      let nextStatus = booking.status;

      if (isRentalPaid && isDelivery) {
        const delivery = await ensureOutboundDelivery(client, bookingId, 'MATCHING_COURIER');
        deliveryId = delivery.id;
        nextStatus = 'MATCHING_COURIER';
        await client.query(
          `UPDATE rentals SET status='MATCHING_COURIER', deposit_status='HELD',
           payment_status='FULLY_PAID', booking_confirmed_at=COALESCE(booking_confirmed_at,NOW()), qr_code_hash=NULL, qr_generated_at=NULL, updated_at=NOW()
           WHERE id=$1`,
          [bookingId],
        );
      } else if (isRentalPaid) {
        qrCodeHash = booking.qr_code_hash || crypto.createHash('sha256')
          .update(`${bookingId}:${Date.now()}:campusmesh`)
          .digest('hex');
        nextStatus = 'QR_GENERATED';
        await client.query(
          `UPDATE rentals SET status='QR_GENERATED', deposit_status='HELD',
           payment_status='FULLY_PAID', booking_confirmed_at=COALESCE(booking_confirmed_at,NOW()), qr_code_hash=$1, qr_generated_at=NOW(), updated_at=NOW()
           WHERE id=$2`,
          [qrCodeHash, bookingId],
        );
      } else {
        await client.query(
          "UPDATE rentals SET deposit_status='HELD', updated_at=NOW() WHERE id=$1",
          [bookingId],
        );
      }
      await client.query(
        `INSERT INTO transaction_events (rental_id, delivery_id, event_type, actor_user_id, metadata)
         VALUES ($1, $2, 'DEPOSIT_PAID', $3, $4)`,
        [bookingId, deliveryId, userId, { delivery: isDelivery }],
      );

      await client.query('COMMIT');

      const event = {
        rental_id: bookingId,
        delivery_id: deliveryId,
        owner_id: booking.owner_id,
        renter_id: booking.borrower_id,
        status: nextStatus,
        delivery_status: deliveryId ? 'MATCHING_COURIER' : null,
      };
      emitUser(booking.borrower_id, 'rental:status', event);
      emitUser(booking.owner_id, 'rental:status', event);

      if (deliveryId) {
        try {
          await matchDelivery(deliveryId);
        } catch (matchingError) {
          console.error(`[PaymentService] Delivery matching deferred for ${deliveryId}:`, matchingError.message);
        }
        emitUser(booking.borrower_id, 'delivery:created', event);
        emitUser(booking.owner_id, 'delivery:created', event);
      }

      return {
        message: isDelivery
          ? (depositAlreadyPaid ? 'Deposit already verified. Finding an online courier.' : 'Security deposit verified. Finding an online courier.')
          : 'Security deposit payment verified. QR code generated for handover.',
        status: nextStatus,
        qr_code_hash: qrCodeHash,
      };
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch {}
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Refund security deposit (Step 8)
   */
  async refundDeposit(bookingId, damageAmount, damageDescription, _adminId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const res = await client.query('SELECT * FROM rentals WHERE id = $1', [bookingId]);
      if (res.rows.length === 0) {
        throw new Error('Booking not found.');
      }

      const booking = res.rows[0];
      const dmgAmt = parseFloat(damageAmount) || 0;
      const refundAmt = Math.max(0, parseFloat(booking.deposit_amount) - dmgAmt);

      // Find the paid security deposit
      const paymentRes = await client.query(
        `SELECT id, transaction_id FROM payments
         WHERE rental_id = $1 AND payment_type = 'SECURITY_DEPOSIT' AND status = 'PAID'`,
        [bookingId]
      );

      if (paymentRes.rows.length === 0) {
        throw new Error('No paid security deposit found for this booking.');
      }

      const payment = paymentRes.rows[0];
      let gatewayRefundId = `sim_refund_${crypto.randomBytes(8).toString('hex')}`;

      // In real mode, call Razorpay refund API
      if (!isSimulationMode() && !String(payment.transaction_id || '').startsWith('sim_')) {
        try {
          const refund = await razorpay.payments.refund(payment.transaction_id, {
            amount: Math.round(refundAmt * 100),
            notes: { booking_id: bookingId, refund_type: 'DEPOSIT_REFUND' }
          });
          gatewayRefundId = refund.id;
        } catch (rzpErr) {
          console.error('[PaymentService] Razorpay Refund call failed:', rzpErr.message);
          throw new Error(`Razorpay Refund failed: ${rzpErr.message}`);
        }
      }

      // Record refund
      await client.query(`
        INSERT INTO refunds (payment_id, rental_id, deposit_amount, damage_amount, refund_amount, refund_status, damage_description)
        VALUES ($1, $2, $3, $4, $5, 'PROCESSED', $6)
      `, [payment.id, bookingId, booking.deposit_amount, dmgAmt, refundAmt, damageDescription || null]);

      // Update booking status
      await client.query(`
        UPDATE rentals SET
          status = 'DEPOSIT_REFUNDED',
          deposit_status = 'REFUNDED',
          updated_at = NOW()
        WHERE id = $1
      `, [bookingId]);
      await client.query(
        `INSERT INTO transaction_events (rental_id, event_type, actor_user_id, metadata)
         VALUES ($1, 'DEPOSIT_REFUNDED', $2, $3)`,
        [bookingId, _adminId, { refundAmount: refundAmt, damageAmount: dmgAmt }],
      );

      console.log(`[PaymentService] Deposit refund processed for booking ${bookingId}. Refunded: ₹${refundAmt}`);

      await client.query('COMMIT');

      return {
        message: 'Security deposit refund processed successfully.',
        refund_amount: refundAmt,
        gateway_refund_id: gatewayRefundId
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Fetch payment history for a user
   */
  async getPaymentHistory(userId) {
    const result = await pool.query(`
      SELECT p.*, r.status as rental_status, l.title as listing_title
      FROM payments p
      JOIN rentals r ON p.rental_id = r.id
      LEFT JOIN listings l ON r.listing_id = l.id
      WHERE r.borrower_id = $1 OR r.owner_id = $1
      ORDER BY p.created_at DESC
    `, [userId]);
    return result.rows;
  }
}

module.exports = new PaymentService();
module.exports.createPaymentService = (options) => new PaymentService(options);

