const pool = require('../config/db');
const crypto = require('crypto');

/**
 * CampusMesh Delivery Controller
 * Handles all courier / delivery-person operations.
 */

// ── Helper: generate a short human-readable token (6 chars) ──
const generateToken = () => crypto.randomBytes(3).toString('hex').toUpperCase();

// ── Ensure delivery_requests table exists ──
const ensureDeliveryTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS delivery_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rental_id UUID REFERENCES rentals(id) ON DELETE CASCADE,
      listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
      customer_id UUID REFERENCES users(id) ON DELETE CASCADE,
      seller_id UUID REFERENCES users(id) ON DELETE CASCADE,
      courier_id UUID REFERENCES users(id) ON DELETE SET NULL,
      pickup_location VARCHAR(255) NOT NULL,
      drop_location VARCHAR(255) NOT NULL DEFAULT 'Campus',
      distance DECIMAL(5,2) DEFAULT 1.0,
      estimated_time VARCHAR(100) DEFAULT '10 mins',
      delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
      courier_earning DECIMAL(10,2) NOT NULL DEFAULT 0,
      status VARCHAR(50) DEFAULT 'AVAILABLE',
      pickup_token VARCHAR(255),
      delivery_token VARCHAR(255),
      declined_by UUID[] DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      accepted_at TIMESTAMP,
      picked_up_at TIMESTAMP,
      delivered_at TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

// Run on first require
ensureDeliveryTable().catch(err => console.error('[DeliveryController] Table init error:', err.message));

// ─────────────────────────────────────────────────────────────
//  GET /api/delivery/stats — Dashboard stats for current courier
// ─────────────────────────────────────────────────────────────
exports.getDeliveryStats = async (req, res) => {
  const userId = req.user.id;
  try {
    // Available requests (exclude own items, declined)
    const availableRes = await pool.query(
      `SELECT COUNT(*) as count FROM delivery_requests 
       WHERE status = 'AVAILABLE' 
         AND customer_id != $1 
         AND seller_id != $1 
         AND NOT ($1 = ANY(declined_by))`,
      [userId]
    );

    const activeRes = await pool.query(
      `SELECT COUNT(*) as count FROM delivery_requests 
       WHERE courier_id = $1 AND status IN ('ACCEPTED','ARRIVING_FOR_PICKUP','PICKED_UP','IN_TRANSIT','ARRIVED')`,
      [userId]
    );

    const completedRes = await pool.query(
      `SELECT COUNT(*) as count FROM delivery_requests WHERE courier_id = $1 AND status = 'DELIVERED'`,
      [userId]
    );

    const earningsRes = await pool.query(
      `SELECT COALESCE(SUM(courier_earning), 0) as total FROM delivery_requests WHERE courier_id = $1 AND status = 'DELIVERED'`,
      [userId]
    );

    res.json({
      available: parseInt(availableRes.rows[0].count),
      active: parseInt(activeRes.rows[0].count),
      completed: parseInt(completedRes.rows[0].count),
      totalEarned: parseFloat(earningsRes.rows[0].total)
    });
  } catch (error) {
    console.error('[DeliveryController] getDeliveryStats error:', error.message);
    res.status(500).json({ error: 'Failed to fetch delivery stats.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/delivery/available — Available delivery requests
// ─────────────────────────────────────────────────────────────
exports.getAvailableDeliveries = async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await pool.query(
      `SELECT dr.*,
              l.title as listing_title, l.image_url as listing_image, l.category as listing_category,
              u_seller.name as seller_name,
              u_customer.name as customer_name
       FROM delivery_requests dr
       LEFT JOIN listings l ON dr.listing_id = l.id
       LEFT JOIN users u_seller ON dr.seller_id = u_seller.id
       LEFT JOIN users u_customer ON dr.customer_id = u_customer.id
       WHERE dr.status = 'AVAILABLE'
         AND dr.customer_id != $1
         AND dr.seller_id != $1
         AND NOT ($1 = ANY(dr.declined_by))
       ORDER BY dr.created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('[DeliveryController] getAvailableDeliveries error:', error.message);
    res.status(500).json({ error: 'Failed to fetch available deliveries.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/delivery/my-deliveries — Courier's accepted deliveries
// ─────────────────────────────────────────────────────────────
exports.getMyDeliveries = async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await pool.query(
      `SELECT dr.*,
              l.title as listing_title, l.image_url as listing_image, l.category as listing_category,
              u_seller.name as seller_name, u_seller.hostel as seller_hostel,
              u_customer.name as customer_name, u_customer.hostel as customer_hostel
       FROM delivery_requests dr
       LEFT JOIN listings l ON dr.listing_id = l.id
       LEFT JOIN users u_seller ON dr.seller_id = u_seller.id
       LEFT JOIN users u_customer ON dr.customer_id = u_customer.id
       WHERE dr.courier_id = $1
       ORDER BY 
         CASE WHEN dr.status = 'DELIVERED' THEN 1 ELSE 0 END,
         dr.updated_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('[DeliveryController] getMyDeliveries error:', error.message);
    res.status(500).json({ error: 'Failed to fetch your deliveries.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/delivery/earnings — Courier earnings breakdown
// ─────────────────────────────────────────────────────────────
exports.getEarnings = async (req, res) => {
  const userId = req.user.id;
  try {
    // Total earnings
    const totalRes = await pool.query(
      `SELECT COALESCE(SUM(courier_earning), 0) as total, COUNT(*) as count
       FROM delivery_requests WHERE courier_id = $1 AND status = 'DELIVERED'`,
      [userId]
    );

    // Today's earnings
    const todayRes = await pool.query(
      `SELECT COALESCE(SUM(courier_earning), 0) as today_total, COUNT(*) as today_count
       FROM delivery_requests 
       WHERE courier_id = $1 AND status = 'DELIVERED' AND delivered_at::date = CURRENT_DATE`,
      [userId]
    );

    // Recent transactions
    const transactionsRes = await pool.query(
      `SELECT dr.id, dr.courier_earning, dr.delivered_at, dr.pickup_location, dr.drop_location,
              l.title as listing_title, l.image_url as listing_image
       FROM delivery_requests dr
       LEFT JOIN listings l ON dr.listing_id = l.id
       WHERE dr.courier_id = $1 AND dr.status = 'DELIVERED'
       ORDER BY dr.delivered_at DESC LIMIT 20`,
      [userId]
    );

    res.json({
      totalEarned: parseFloat(totalRes.rows[0].total),
      completedCount: parseInt(totalRes.rows[0].count),
      todayEarned: parseFloat(todayRes.rows[0].today_total),
      todayCount: parseInt(todayRes.rows[0].today_count),
      transactions: transactionsRes.rows
    });
  } catch (error) {
    console.error('[DeliveryController] getEarnings error:', error.message);
    res.status(500).json({ error: 'Failed to fetch earnings.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/delivery/:id — Single delivery details
// ─────────────────────────────────────────────────────────────
exports.getDeliveryById = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const result = await pool.query(
      `SELECT dr.*,
              l.title as listing_title, l.image_url as listing_image, l.category as listing_category,
              u_seller.name as seller_name, u_seller.hostel as seller_hostel, u_seller.phone_number as seller_phone,
              u_customer.name as customer_name, u_customer.hostel as customer_hostel,
              u_courier.name as courier_name, u_courier.phone_number as courier_phone
       FROM delivery_requests dr
       LEFT JOIN listings l ON dr.listing_id = l.id
       LEFT JOIN users u_seller ON dr.seller_id = u_seller.id
       LEFT JOIN users u_customer ON dr.customer_id = u_customer.id
       LEFT JOIN users u_courier ON dr.courier_id = u_courier.id
       WHERE dr.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Delivery request not found.' });
    }

    const delivery = result.rows[0];

    // Only allow involved parties to view
    const allowed = [delivery.customer_id, delivery.seller_id, delivery.courier_id].filter(Boolean);
    if (!allowed.includes(userId) && delivery.status === 'AVAILABLE') {
      // Available requests can be viewed by anyone except customer/seller themselves
      // (already filtered in available endpoint, but allow GET by ID for any courier)
    } else if (!allowed.includes(userId)) {
      return res.status(403).json({ error: 'Not authorized to view this delivery.' });
    }

    // Mask tokens depending on viewer role
    const isCourier = delivery.courier_id === userId;
    const isSeller = delivery.seller_id === userId;
    const isCustomer = delivery.customer_id === userId;

    // Seller sees pickup_token, customer sees delivery_token, courier sees neither (they input tokens)
    if (!isSeller) delivery.pickup_token = undefined;
    if (!isCustomer) delivery.delivery_token = undefined;

    res.json(delivery);
  } catch (error) {
    console.error('[DeliveryController] getDeliveryById error:', error.message);
    res.status(500).json({ error: 'Failed to fetch delivery details.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/delivery/:id/accept — Courier accepts a delivery
// ─────────────────────────────────────────────────────────────
exports.acceptDelivery = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    // Atomic conditional update — only succeeds if status is still AVAILABLE
    const result = await pool.query(
      `UPDATE delivery_requests 
       SET courier_id = $1, status = 'ACCEPTED', accepted_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND status = 'AVAILABLE' AND customer_id != $1 AND seller_id != $1
       RETURNING id`,
      [userId, id]
    );

    if (result.rowCount === 0) {
      return res.status(409).json({ error: 'This delivery has already been accepted by another courier or is no longer available.' });
    }

    console.log(`[DeliveryController] Courier ${userId} accepted delivery ${id}`);
    res.json({ message: 'Delivery accepted successfully!', delivery_id: id });
  } catch (error) {
    console.error('[DeliveryController] acceptDelivery error:', error.message);
    res.status(500).json({ error: 'Failed to accept delivery.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/delivery/:id/deny — Courier declines a delivery
// ─────────────────────────────────────────────────────────────
exports.denyDelivery = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `UPDATE delivery_requests 
       SET declined_by = array_append(declined_by, $1), updated_at = NOW()
       WHERE id = $2 AND status = 'AVAILABLE'
       RETURNING id`,
      [userId, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Delivery request not found or already taken.' });
    }

    res.json({ message: 'Delivery declined.' });
  } catch (error) {
    console.error('[DeliveryController] denyDelivery error:', error.message);
    res.status(500).json({ error: 'Failed to decline delivery.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/delivery/:id/start-pickup — Courier heading to seller
// ─────────────────────────────────────────────────────────────
exports.startPickup = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `UPDATE delivery_requests 
       SET status = 'ARRIVING_FOR_PICKUP', updated_at = NOW()
       WHERE id = $1 AND courier_id = $2 AND status = 'ACCEPTED'
       RETURNING id`,
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ error: 'Cannot start pickup. Check delivery status.' });
    }

    res.json({ message: 'On the way to pickup!', status: 'ARRIVING_FOR_PICKUP' });
  } catch (error) {
    console.error('[DeliveryController] startPickup error:', error.message);
    res.status(500).json({ error: 'Failed to start pickup.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/delivery/:id/verify-pickup — Verify seller's token
// ─────────────────────────────────────────────────────────────
exports.verifyPickup = async (req, res) => {
  const { id } = req.params;
  const { token } = req.body;
  const userId = req.user.id;

  if (!token) {
    return res.status(400).json({ error: 'Pickup token is required.' });
  }

  try {
    // Fetch delivery with pickup_token
    const deliveryRes = await pool.query(
      `SELECT * FROM delivery_requests WHERE id = $1 AND courier_id = $2 AND status IN ('ACCEPTED', 'ARRIVING_FOR_PICKUP')`,
      [id, userId]
    );

    if (deliveryRes.rows.length === 0) {
      return res.status(400).json({ error: 'Delivery not found or not in pickup state.' });
    }

    const delivery = deliveryRes.rows[0];

    if (delivery.pickup_token !== token.trim().toUpperCase()) {
      return res.status(400).json({ error: 'Invalid pickup token. Please check with the seller.' });
    }

    // Token matches — transition to PICKED_UP
    await pool.query(
      `UPDATE delivery_requests 
       SET status = 'PICKED_UP', picked_up_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    console.log(`[DeliveryController] Pickup verified for delivery ${id} by courier ${userId}`);
    res.json({ message: 'Pickup verified! Item collected from seller.', status: 'PICKED_UP' });
  } catch (error) {
    console.error('[DeliveryController] verifyPickup error:', error.message);
    res.status(500).json({ error: 'Failed to verify pickup.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/delivery/:id/start-delivery — Courier in transit
// ─────────────────────────────────────────────────────────────
exports.startDelivery = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `UPDATE delivery_requests 
       SET status = 'IN_TRANSIT', updated_at = NOW()
       WHERE id = $1 AND courier_id = $2 AND status = 'PICKED_UP'
       RETURNING id`,
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ error: 'Cannot start delivery. Check delivery status.' });
    }

    res.json({ message: 'On the way to drop location!', status: 'IN_TRANSIT' });
  } catch (error) {
    console.error('[DeliveryController] startDelivery error:', error.message);
    res.status(500).json({ error: 'Failed to start delivery.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/delivery/:id/arrive — Courier arrived at drop
// ─────────────────────────────────────────────────────────────
exports.arriveAtDrop = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `UPDATE delivery_requests 
       SET status = 'ARRIVED', updated_at = NOW()
       WHERE id = $1 AND courier_id = $2 AND status = 'IN_TRANSIT'
       RETURNING id`,
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ error: 'Cannot mark as arrived. Check delivery status.' });
    }

    res.json({ message: 'Arrived at drop location!', status: 'ARRIVED' });
  } catch (error) {
    console.error('[DeliveryController] arriveAtDrop error:', error.message);
    res.status(500).json({ error: 'Failed to mark arrival.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/delivery/:id/verify-delivery — Verify customer's token
// ─────────────────────────────────────────────────────────────
exports.verifyDelivery = async (req, res) => {
  const { id } = req.params;
  const { token } = req.body;
  const userId = req.user.id;

  if (!token) {
    return res.status(400).json({ error: 'Delivery token is required.' });
  }

  try {
    const deliveryRes = await pool.query(
      `SELECT * FROM delivery_requests WHERE id = $1 AND courier_id = $2 AND status IN ('PICKED_UP','IN_TRANSIT','ARRIVED')`,
      [id, userId]
    );

    if (deliveryRes.rows.length === 0) {
      return res.status(400).json({ error: 'Delivery not found or not in delivery state.' });
    }

    const delivery = deliveryRes.rows[0];

    if (delivery.delivery_token !== token.trim().toUpperCase()) {
      return res.status(400).json({ error: 'Invalid delivery token. Please check with the customer.' });
    }

    // Token matches — transition to DELIVERED and record earning
    await pool.query(
      `UPDATE delivery_requests 
       SET status = 'DELIVERED', delivered_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    // Also update the rental status to indicate item was delivered via courier
    if (delivery.rental_id) {
      await pool.query(
        `UPDATE rentals SET status = 'RENTAL_ACTIVE', updated_at = NOW() WHERE id = $1 AND status IN ('QR_GENERATED', 'OWNER_PENDING')`,
        [delivery.rental_id]
      );
    }

    console.log(`[DeliveryController] Delivery ${id} completed! Courier ${userId} earned ₹${delivery.courier_earning}`);
    res.json({ 
      message: 'Delivery completed! Earnings recorded.', 
      status: 'DELIVERED',
      earning: parseFloat(delivery.courier_earning)
    });
  } catch (error) {
    console.error('[DeliveryController] verifyDelivery error:', error.message);
    res.status(500).json({ error: 'Failed to verify delivery.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/delivery/rental/:rentalId — Get delivery status for a rental
//  (Used by RentDetails / OwnerDashboard to show courier info)
// ─────────────────────────────────────────────────────────────
exports.getRentalDeliveryStatus = async (req, res) => {
  const { rentalId } = req.params;
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT dr.*,
              u_courier.name as courier_name, u_courier.phone_number as courier_phone
       FROM delivery_requests dr
       LEFT JOIN users u_courier ON dr.courier_id = u_courier.id
       WHERE dr.rental_id = $1
       ORDER BY dr.created_at DESC
       LIMIT 1`,
      [rentalId]
    );

    if (result.rows.length === 0) {
      return res.json({ has_delivery: false });
    }

    const delivery = result.rows[0];
    
    // Determine viewer role
    const isSeller = delivery.seller_id === userId;
    const isCustomer = delivery.customer_id === userId;
    const isCourier = delivery.courier_id === userId;

    // Mask tokens: seller sees pickup_token, customer sees delivery_token
    const response = {
      has_delivery: true,
      delivery_id: delivery.id,
      status: delivery.status,
      courier_name: delivery.courier_name || null,
      courier_phone: delivery.courier_phone || null,
      pickup_location: delivery.pickup_location,
      drop_location: delivery.drop_location,
      delivery_fee: delivery.delivery_fee,
      estimated_time: delivery.estimated_time,
      accepted_at: delivery.accepted_at,
      picked_up_at: delivery.picked_up_at,
      delivered_at: delivery.delivered_at,
      pickup_token: isSeller ? delivery.pickup_token : undefined,
      delivery_token: isCustomer ? delivery.delivery_token : undefined,
    };

    res.json(response);
  } catch (error) {
    console.error('[DeliveryController] getRentalDeliveryStatus error:', error.message);
    res.status(500).json({ error: 'Failed to fetch delivery status.' });
  }
};

// ─────────────────────────────────────────────────────────────
//  Helper: Create a delivery request (called from payment flows)
// ─────────────────────────────────────────────────────────────
exports.createDeliveryRequest = async (client, {
  rental_id, listing_id, customer_id, seller_id,
  pickup_location, drop_location, delivery_fee, distance, estimated_time
}) => {
  const pickupToken = generateToken();
  const deliveryToken = generateToken();
  const courierEarning = Math.round(parseFloat(delivery_fee) * 0.70 * 100) / 100; // Courier gets 70%

  const result = await (client || pool).query(
    `INSERT INTO delivery_requests 
       (rental_id, listing_id, customer_id, seller_id, pickup_location, drop_location,
        distance, estimated_time, delivery_fee, courier_earning, status, pickup_token, delivery_token)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'AVAILABLE', $11, $12)
     RETURNING id`,
    [
      rental_id, listing_id, customer_id, seller_id,
      pickup_location || 'Campus', drop_location || 'Campus',
      distance || 1.0, estimated_time || '10 mins',
      delivery_fee, courierEarning,
      pickupToken, deliveryToken
    ]
  );

  console.log(`[DeliveryController] Created delivery request ${result.rows[0].id} for rental ${rental_id} (fee: ₹${delivery_fee}, courier earning: ₹${courierEarning})`);
  return result.rows[0].id;
};
