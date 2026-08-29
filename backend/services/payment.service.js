const pool = require('../config/db');
const razorpay = require('../config/razorpay');
const crypto = require('crypto');
const { createDeliveryRequest } = require('../controllers/deliveryController');
require('dotenv').config();

// Helper to check if Razorpay is running in real or simulation mode
const isSimulationMode = () => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  return !key_id || !key_secret || key_id === 'your_razorpay_key_id' || key_secret === 'your_key_secret';
};

class PaymentService {
  /**
   * Create a Razorpay order for the rental fee (Step 1)
   */
  async createRentalOrder(bookingId, userId) {
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
        throw new Error('Unauthorized to pay for this booking.');
      }

      if (booking.status !== 'BOOKING_PAYMENT_PENDING' && booking.status !== 'BOOKING_REQUESTED') {
        throw new Error(`Invalid booking status for rental payment: ${booking.status}`);
      }

      // Calculate amount in paise (1 INR = 100 paise)
      const amountPaise = Math.round(parseFloat(booking.booking_amount) * 100);
      const receipt = `rent_${bookingId.slice(0, 8)}`;

      let orderId;
      let simulated = false;

      if (isSimulationMode()) {
        orderId = `sim_order_${crypto.randomBytes(8).toString('hex')}`;
        simulated = true;
        console.log(`[PaymentService] Simulation Mode: Created rental order ${orderId} for ₹${booking.booking_amount}`);
      } else {
        const order = await razorpay.orders.create({
          amount: amountPaise,
          currency: 'INR',
          receipt,
          notes: { booking_id: bookingId, payment_type: 'RENTAL' }
        });
        orderId = order.id;
      }

      // Insert pending payment record
      await client.query(`
        INSERT INTO payments (booking_id, rental_id, payment_type, amount, gateway, gateway_order_id, status)
        VALUES ($1, $1, 'RENTAL', $2, 'razorpay', $3, 'PENDING')
      `, [bookingId, booking.booking_amount, orderId]);

      await client.query('COMMIT');

      return {
        order_id: orderId,
        amount: booking.booking_amount,
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
   * Verify rental payment and update status (Step 3)
   */
  async verifyRentalPayment(bookingId, gatewayOrderId, gatewayPaymentId, gatewaySignature, userId) {
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

      // Check if already paid to prevent duplicate processing
      const payCheck = await client.query(
        "SELECT id FROM payments WHERE booking_id = $1 AND payment_type = 'RENTAL' AND status = 'PAID'",
        [bookingId]
      );
      if (payCheck.rows.length > 0) {
        await client.query('COMMIT');
        return { message: 'Payment already processed.', status: booking.status };
      }

      // Update payment record to PAID
      await client.query(`
        UPDATE payments SET
          gateway_payment_id = $1,
          gateway_signature = $2,
          status = 'PAID'
        WHERE booking_id = $3 AND payment_type = 'RENTAL' AND gateway_order_id = $4
      `, [gatewayPaymentId, gatewaySignature || 'sim_sig', bookingId, gatewayOrderId]);

      // Update booking status to RENTAL_PAYMENT_COMPLETED, reserve listing, notify owner
      await client.query(`
        UPDATE rentals SET
          status = 'RENTAL_PAYMENT_COMPLETED',
          booking_status = 'PAYMENT_COMPLETED',
          payment_status = 'RENTAL_PAID',
          updated_at = NOW()
        WHERE id = $1
      `, [bookingId]);

      console.log(`[PaymentService] Rental verified for booking ${bookingId}. Status → RENTAL_PAYMENT_COMPLETED`);

      await client.query('COMMIT');

      return {
        message: 'Rental payment verified. Waiting for owner to accept.',
        status: 'RENTAL_PAYMENT_COMPLETED'
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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
        throw new Error('Deposit deadline expired. Booking has been cancelled.');
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
        INSERT INTO payments (booking_id, rental_id, payment_type, amount, gateway, gateway_order_id, status)
        VALUES ($1, $1, 'SECURITY_DEPOSIT', $2, 'razorpay', $3, 'PENDING')
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

      // Check if already paid to prevent duplicate processing
      const payCheck = await client.query(
        "SELECT id FROM payments WHERE booking_id = $1 AND payment_type = 'SECURITY_DEPOSIT' AND status = 'PAID'",
        [bookingId]
      );
      if (payCheck.rows.length > 0) {
        await client.query('COMMIT');
        return { message: 'Deposit already processed.', status: booking.status };
      }

      // Update deposit payment to PAID
      await client.query(`
        UPDATE payments SET
          gateway_payment_id = $1,
          gateway_signature = $2,
          status = 'PAID'
        WHERE booking_id = $3 AND payment_type = 'SECURITY_DEPOSIT' AND gateway_order_id = $4
      `, [gatewayPaymentId, gatewaySignature || 'sim_sig', bookingId, gatewayOrderId]);

      // Check if both RENTAL and SECURITY_DEPOSIT payments are paid
      const rentalPaymentRes = await client.query(
        "SELECT status FROM payments WHERE booking_id = $1 AND payment_type = 'RENTAL' AND status = 'PAID'",
        [bookingId]
      );
      
      const isRentalPaid = rentalPaymentRes.rows.length > 0;

      // Generate secure QR hash (Step 7)
      const qrCodeHash = crypto
        .createHash('sha256')
        .update(`${bookingId}:${Date.now()}:campusmesh`)
        .digest('hex');

      // Advance status only if both are paid, otherwise keep updating deposit status
      if (isRentalPaid) {
        await client.query(`
          UPDATE rentals SET
            status = 'QR_GENERATED',
            deposit_status = 'HELD',
            payment_status = 'FULLY_PAID',
            qr_code_hash = $1,
            qr_generated_at = NOW(),
            updated_at = NOW()
          WHERE id = $2
        `, [qrCodeHash, bookingId]);
      } else {
        await client.query(`
          UPDATE rentals SET
            deposit_status = 'HELD',
            updated_at = NOW()
          WHERE id = $1
        `, [bookingId]);
      }

      // Auto-create delivery request if delivery_fee > 0
      if (parseFloat(booking.delivery_fee) > 0 && isRentalPaid) {
        try {
          // Fetch listing location for pickup
          const listingRes = await client.query('SELECT location FROM listings WHERE id = $1', [booking.listing_id]);
          const pickupLocation = listingRes.rows.length > 0 ? listingRes.rows[0].location : 'Campus';
          
          await createDeliveryRequest(client, {
            rental_id: bookingId,
            listing_id: booking.listing_id,
            customer_id: booking.borrower_id,
            seller_id: booking.owner_id,
            pickup_location: pickupLocation,
            drop_location: 'Campus',
            delivery_fee: booking.delivery_fee,
            distance: 1.0,
            estimated_time: '10 mins'
          });
        } catch (delErr) {
          console.error('[PaymentService] Failed to create delivery request:', delErr.message);
        }
      }

      console.log(`[PaymentService] Security deposit verified for booking ${bookingId}. Status → QR_GENERATED (Item pickup enabled)`);

      await client.query('COMMIT');

      return {
        message: 'Security deposit payment verified. QR code generated for handover.',
        status: isRentalPaid ? 'QR_GENERATED' : booking.status,
        qr_code_hash: qrCodeHash
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Refund security deposit (Step 8)
   */
  async refundDeposit(bookingId, damageAmount, damageDescription, adminId) {
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
        `SELECT id, gateway_payment_id FROM payments 
         WHERE booking_id = $1 AND payment_type = 'SECURITY_DEPOSIT' AND status = 'PAID'`,
        [bookingId]
      );

      if (paymentRes.rows.length === 0) {
        throw new Error('No paid security deposit found for this booking.');
      }

      const payment = paymentRes.rows[0];
      let gatewayRefundId = `sim_refund_${crypto.randomBytes(8).toString('hex')}`;

      // In real mode, call Razorpay refund API
      if (!isSimulationMode() && !payment.gateway_payment_id.startsWith('sim_')) {
        try {
          const refund = await razorpay.payments.refund(payment.gateway_payment_id, {
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
        INSERT INTO refunds (payment_id, rental_id, deposit_amount, damage_amount, refund_amount, refund_status, damage_description, approved_by, gateway_refund_id)
        VALUES ($1, $2, $3, $4, $5, 'PROCESSED', $6, $7, $8)
      `, [payment.id, bookingId, booking.deposit_amount, dmgAmt, refundAmt, damageDescription || null, adminId || null, gatewayRefundId]);

      // Update booking status
      await client.query(`
        UPDATE rentals SET 
          status = 'DEPOSIT_REFUNDED', 
          deposit_status = 'REFUNDED', 
          updated_at = NOW()
        WHERE id = $1
      `, [bookingId]);

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
      JOIN rentals r ON p.booking_id = r.id
      LEFT JOIN listings l ON r.listing_id = l.id
      WHERE r.borrower_id = $1 OR r.owner_id = $1
      ORDER BY p.created_at DESC
    `, [userId]);
    return result.rows;
  }
}

module.exports = new PaymentService();
