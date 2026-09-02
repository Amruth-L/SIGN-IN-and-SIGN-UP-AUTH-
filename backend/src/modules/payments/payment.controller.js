const paymentService = require('./payment.service');
const pool = require('../../config/database');
const razorpay = require('../../config/razorpay');
const crypto = require('crypto');

const isSimulationMode = () => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  return !key_id || !key_secret || key_id === 'your_razorpay_key_id' || key_secret === 'your_key_secret';
};

exports.createRentalOrder = async (req, res) => {
  const { rental_id, booking_id } = req.body;
  const targetId = booking_id || rental_id; // Support both naming variants for robust compatibility
  const userId = req.user.id;

  if (!targetId) {
    return res.status(400).json({ error: 'booking_id is required.' });
  }

  try {
    const orderData = await paymentService.createRentalOrder(targetId, userId);
    res.status(201).json(orderData);
  } catch (error) {
    console.error('[PaymentController] createRentalOrder error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to create rental payment order.' });
  }
};

exports.verifyRental = async (req, res) => {
  const { rental_id, booking_id, gateway_order_id, gateway_payment_id, gateway_signature } = req.body;
  const targetId = booking_id || rental_id;
  const userId = req.user.id;

  if (!targetId || !gateway_order_id || !gateway_payment_id) {
    return res.status(400).json({ error: 'booking_id, gateway_order_id, and gateway_payment_id are required.' });
  }

  try {
    const verificationResult = await paymentService.verifyRentalPayment(
      targetId,
      gateway_order_id,
      gateway_payment_id,
      gateway_signature,
      userId
    );
    res.status(200).json(verificationResult);
  } catch (error) {
    console.error('[PaymentController] verifyRental error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to verify rental payment.' });
  }
};

exports.createDepositOrder = async (req, res) => {
  const { rental_id, booking_id } = req.body;
  const targetId = booking_id || rental_id;
  const userId = req.user.id;

  if (!targetId) {
    return res.status(400).json({ error: 'booking_id is required.' });
  }

  if (targetId.startsWith('mock-rental-')) {
    return res.status(201).json({
      order_id: `sim_order_${Math.random().toString(36).substr(2, 9)}`,
      amount: 200.00, // mock deposit amount
      currency: 'INR',
      razorpay_key: 'SIMULATION_MODE',
      simulated: true
    });
  }

  try {
    const orderData = await paymentService.createDepositOrder(targetId, userId);
    res.status(201).json(orderData);
  } catch (error) {
    console.error('[PaymentController] createDepositOrder error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to create deposit payment order.' });
  }
};

exports.verifyDeposit = async (req, res) => {
  const { rental_id, booking_id, gateway_order_id, gateway_payment_id, gateway_signature } = req.body;
  const targetId = booking_id || rental_id;
  const userId = req.user.id;

  if (!targetId || !gateway_order_id || !gateway_payment_id) {
    return res.status(400).json({ error: 'booking_id, gateway_order_id, and gateway_payment_id are required.' });
  }

  if (targetId.startsWith('mock-rental-')) {
    return res.status(200).json({
      message: 'Deposit payment verified successfully (Mock).',
      status: 'QR_GENERATED'
    });
  }

  try {
    const verificationResult = await paymentService.verifyDepositPayment(
      targetId,
      gateway_order_id,
      gateway_payment_id,
      gateway_signature,
      userId
    );
    res.status(200).json(verificationResult);
  } catch (error) {
    console.error('[PaymentController] verifyDeposit error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to verify deposit payment.' });
  }
};

exports.refundDeposit = async (req, res) => {
  const { rental_id, booking_id, damage_amount, damage_description } = req.body;
  const targetId = booking_id || rental_id;
  const adminId = req.user?.id;

  if (!targetId) {
    return res.status(400).json({ error: 'booking_id is required.' });
  }

  try {
    const result = await paymentService.refundDeposit(
      targetId,
      damage_amount,
      damage_description,
      adminId
    );
    res.status(200).json(result);
  } catch (error) {
    console.error('[PaymentController] refundDeposit error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to process refund.' });
  }
};

exports.getPaymentHistory = async (req, res) => {
  const userId = req.user.id;

  try {
    const history = await paymentService.getPaymentHistory(userId);
    res.status(200).json(history);
  } catch (error) {
    console.error('[PaymentController] getPaymentHistory error:', error.message);
    res.status(500).json({ error: 'Failed to fetch payment history.' });
  }
};

/**
 * Stage 3: Cart Checkout Order Creation
 */
exports.createCheckoutOrder = async (req, res) => {
  const userId = req.user.id;
  const { delivery_opted, selected_item_ids } = req.body; // Map of { [item_id]: boolean } & selected IDs array

  const optedMap = delivery_opted || {};

  try {
    // 1. Fetch active user's cart joined with listings details
    let query = `SELECT c.*, l.rent_price, l.delivery_charge, l.deposit, l.owner_id 
                 FROM cart c 
                 JOIN listings l ON c.item_id = l.id 
                 WHERE c.user_id = $1`;
    let queryParams = [userId];

    if (Array.isArray(selected_item_ids) && selected_item_ids.length > 0) {
      query += ` AND (c.item_id::text = ANY($2) OR c.id::text = ANY($2))`;
      queryParams.push(selected_item_ids);
    }

    const cartRes = await pool.query(query, queryParams);

    if (cartRes.rows.length === 0) {
      return res.status(400).json({ error: 'No selected items found in your cart.' });
    }

    const cartItems = cartRes.rows;

    // 2. Perform pricing calculations on backend
    let rentalFee = 0;
    let deliveryFee = 0;
    let depositTotal = 0;
    const platformFee = 5.00; // Flat platform fee

    cartItems.forEach(item => {
      rentalFee += parseFloat(item.subtotal);
      depositTotal += parseFloat(item.deposit || 0);
      const isDeliveryOpted = optedMap[item.item_id] || optedMap[item.id] || false;
      if (isDeliveryOpted) {
        deliveryFee += parseFloat(item.delivery_charge || 0);
      }
    });

    const bookingTotal = rentalFee + platformFee + deliveryFee;

    // 3. Create Razorpay order with exact totalAmount (in paise)
    const amountPaise = Math.round(bookingTotal * 100);
    const receipt = `chk_${crypto.randomBytes(4).toString('hex')}`;
    let orderId;
    let simulated = false;

    if (isSimulationMode()) {
      orderId = `sim_order_${crypto.randomBytes(8).toString('hex')}`;
      simulated = true;
      console.log(`[PaymentController] Simulation Mode: Created checkout order ${orderId} for ₹${bookingTotal}`);
    } else {
      const order = await razorpay.orders.create({
        amount: amountPaise,
        currency: 'INR',
        receipt,
        notes: { user_id: userId, payment_type: 'CHECKOUT', merchant: 'CampusMesh Student Rentals' }
      });
      orderId = order.id;
    }

    // 4. Cache detailed booking payload in pending_orders table
    const distributedPlatformFee = platformFee / cartItems.length;

    const bookingData = {
      user_id: userId,
      items: cartItems.map(item => {
        const isDeliveryOpted = optedMap[item.item_id] || optedMap[item.id] || false;
        const delFee = isDeliveryOpted ? parseFloat(item.delivery_charge || 0) : 0;
        const subtotal = parseFloat(item.subtotal);

        return {
          listing_id: item.item_id,
          owner_id: item.owner_id,
          start_date: item.start_date,
          end_date: item.end_date,
          rental_days: item.days,
          rental_fee: subtotal,
          delivery_fee: delFee,
          platform_fee: distributedPlatformFee,
          booking_amount: subtotal + distributedPlatformFee + delFee,
          deposit_amount: parseFloat(item.deposit || 0)
        };
      })
    };

    await pool.query(
      'INSERT INTO pending_orders (id, user_id, booking_data) VALUES ($1, $2, $3)',
      [orderId, userId, JSON.stringify(bookingData)]
    );

    // Return backend-calculated numbers. totalAmount MUST match Razorpay order amount
    res.status(201).json({
      order_id: orderId,
      rentalFee: parseFloat(rentalFee.toFixed(2)),
      platformFee: parseFloat(platformFee.toFixed(2)),
      deliveryFee: parseFloat(deliveryFee.toFixed(2)),
      depositTotal: parseFloat(depositTotal.toFixed(2)),
      totalAmount: parseFloat(bookingTotal.toFixed(2)),
      amount: parseFloat(bookingTotal.toFixed(2)), // For backward compatibility
      selectedCount: cartItems.length,
      currency: 'INR',
      razorpay_key: process.env.RAZORPAY_KEY_ID || 'SIMULATION_MODE',
      simulated
    });
  } catch (error) {
    console.error('[PaymentController] createCheckoutOrder error:', error.message);
    res.status(500).json({ error: 'Failed to create checkout payment order.' });
  }
};

/**
 * Stage 3: Cart Checkout Verification
 */
exports.verifyCheckout = async (req, res) => {
  const { gateway_order_id, gateway_payment_id } = req.body;
  const userId = req.user.id;

  if (!gateway_order_id || !gateway_payment_id) {
    return res.status(400).json({ error: 'gateway_order_id and gateway_payment_id are required.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Fetch pending order
    const pendingRes = await client.query('SELECT * FROM pending_orders WHERE id = $1', [gateway_order_id]);
    if (pendingRes.rows.length === 0) {
      throw new Error('Pending order not found for this transaction.');
    }

    const { booking_data } = pendingRes.rows[0];

    // 2. Loop through each item to insert rental records, generate QR codes & clear cart items
    const createdRentals = [];

    for (const item of booking_data.items) {
      // Generate a unique QR code hash for each rental
      const qrCodeHash = crypto
        .createHash('sha256')
        .update(`${item.listing_id}:${userId}:${Date.now()}:${crypto.randomBytes(8).toString('hex')}:campusmesh`)
        .digest('hex');

      // Insert into rentals table with QR code
      const rentalRes = await client.query(
        `INSERT INTO rentals (
           listing_id, borrower_id, owner_id, start_date, end_date,
           rental_days, rental_fee, delivery_fee, platform_fee, booking_amount,
           deposit_amount, status, booking_status, deposit_status, payment_status,
           qr_code_hash, qr_generated_at, delivery_requested
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'OWNER_PENDING', 'CONFIRMED', 'PENDING', 'PAID', $12, NOW(), $13)
         RETURNING id`,
        [
          item.listing_id,
          userId,
          item.owner_id,
          item.start_date,
          item.end_date,
          item.rental_days,
          item.rental_fee,
          item.delivery_fee,
          item.platform_fee,
          item.booking_amount,
          item.deposit_amount,
          qrCodeHash,
          parseFloat(item.delivery_fee) > 0
        ]
      );

      const rentalId = rentalRes.rows[0].id;
      await client.query("INSERT INTO listing_interactions(listing_id,user_id,interaction_type) VALUES($1,$2,'RENT')", [item.listing_id, userId]);

      // Insert into payments history table
      await client.query(
        `INSERT INTO payments (rental_id, amount, status, transaction_id)
         VALUES ($1, $2, 'SUCCESS', $3)`,
        [rentalId, item.booking_amount, gateway_payment_id]
      );

      // Clear from user's shopping cart
      await client.query(
        'DELETE FROM cart WHERE user_id = $1 AND item_id = $2',
        [userId, item.listing_id]
      );

      // Fetch listing title and location for display and delivery
      const listingRes = await client.query('SELECT title, location FROM listings WHERE id = $1', [item.listing_id]);
      const listingTitle = listingRes.rows.length > 0 ? listingRes.rows[0].title : 'Item';

      createdRentals.push({
        rental_id: rentalId,
        listing_id: item.listing_id,
        listing_title: listingTitle,
        qr_code_hash: qrCodeHash
      });
    }

    // 3. Clear pending order cache
    await client.query('DELETE FROM pending_orders WHERE id = $1', [gateway_order_id]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Checkout verified successfully. Cart items have been booked and cleared.',
      rentals: createdRentals
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[PaymentController] verifyCheckout error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to verify checkout transaction.' });
  } finally {
    client.release();
  }
};

