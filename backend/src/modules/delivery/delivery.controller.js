const pool = require('../../config/database');
const crypto = require('crypto');
const { emitDelivery, emitUser } = require('../../shared/realtime');
const { routeFor } = require('../campus/campus.service');

/**
 * CampusMesh Delivery Controller
 * Handles all courier / delivery-person operations.
 */

// ── Helper: generate a short human-readable token (6 chars) ──
const generateToken = () => crypto.randomBytes(3).toString('hex').toUpperCase();

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
      [userId],
    );

    const activeRes = await pool.query(
      `SELECT COUNT(*) as count FROM delivery_requests 
       WHERE courier_id = $1 AND status IN ('ACCEPTED','ARRIVING_FOR_PICKUP','PICKED_UP','IN_TRANSIT','ARRIVED')`,
      [userId],
    );

    const completedRes = await pool.query(
      `SELECT COUNT(*) as count FROM delivery_requests WHERE courier_id = $1 AND status = 'DELIVERED'`,
      [userId],
    );

    const earningsRes = await pool.query(
      `SELECT COALESCE(SUM(courier_earning), 0) as total FROM delivery_requests WHERE courier_id = $1 AND status = 'DELIVERED'`,
      [userId],
    );

    res.json({
      available: parseInt(availableRes.rows[0].count),
      active: parseInt(activeRes.rows[0].count),
      completed: parseInt(completedRes.rows[0].count),
      totalEarned: parseFloat(earningsRes.rows[0].total),
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
      [userId],
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
      [userId],
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
      [userId],
    );

    // Today's earnings
    const todayRes = await pool.query(
      `SELECT COALESCE(SUM(courier_earning), 0) as today_total, COUNT(*) as today_count
       FROM delivery_requests 
       WHERE courier_id = $1 AND status = 'DELIVERED' AND delivered_at::date = CURRENT_DATE`,
      [userId],
    );

    // Recent transactions
    const transactionsRes = await pool.query(
      `SELECT dr.id, dr.courier_earning, dr.delivered_at, dr.pickup_location, dr.drop_location,
              l.title as listing_title, l.image_url as listing_image
       FROM delivery_requests dr
       LEFT JOIN listings l ON dr.listing_id = l.id
       WHERE dr.courier_id = $1 AND dr.status = 'DELIVERED'
       ORDER BY dr.delivered_at DESC LIMIT 20`,
      [userId],
    );

    res.json({
      totalEarned: parseFloat(totalRes.rows[0].total),
      completedCount: parseInt(totalRes.rows[0].count),
      todayEarned: parseFloat(todayRes.rows[0].today_total),
      todayCount: parseInt(todayRes.rows[0].today_count),
      transactions: transactionsRes.rows,
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
      [id],
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

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const availability = await pool.query('SELECT delivery_available FROM users WHERE id = $1', [userId]);
    if (!availability.rows[0]?.delivery_available) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Go online before accepting a delivery.' });
    }
    const offer = await client.query(
      `UPDATE delivery_offers SET status='ACCEPTED', responded_at=NOW()
      WHERE delivery_id=$1 AND courier_id=$2 AND status='PENDING' AND expires_at>NOW() RETURNING match_score`,
      [id, userId],
    );
    const legacyAvailable = await client.query(
      "SELECT status FROM delivery_requests WHERE id=$1 AND status='AVAILABLE'",
      [id],
    );
    if (!offer.rowCount && !legacyAvailable.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This offer expired or the task was assigned.' });
    }
    const result = await client.query(
      `UPDATE delivery_requests 
       SET courier_id = $1, status = 'COURIER_ASSIGNED', accepted_at = NOW(), match_score=$3, updated_at = NOW()
       WHERE id = $2 AND status IN ('AVAILABLE','MATCHING_COURIER','RETURN_MATCHING') AND customer_id != $1 AND seller_id != $1
       RETURNING *`,
      [userId, id, offer.rows[0]?.match_score || null],
    );

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res
        .status(409)
        .json({
          error: 'This delivery has already been accepted by another courier or is no longer available.',
        });
    }
    await client.query(
      "UPDATE delivery_offers SET status='EXPIRED', responded_at=NOW() WHERE delivery_id=$1 AND courier_id<>$2 AND status='PENDING'",
      [id, userId],
    );
    const delivery = result.rows[0];
    if (delivery.rental_id)
      await client.query(
        `UPDATE rentals SET status=CASE WHEN $2='RENTAL_RETURN' THEN 'RETURN_COURIER_ASSIGNED' ELSE 'COURIER_ASSIGNED' END,
      updated_at=NOW() WHERE id=$1`,
        [delivery.rental_id, delivery.task_type],
      );
    await client.query(
      `INSERT INTO transaction_events (rental_id,delivery_id,xerox_request_id,event_type,actor_user_id,metadata)
      VALUES ($1,$2,$3,'COURIER_ASSIGNED',$4,$5)`,
      [
        delivery.rental_id,
        id,
        delivery.xerox_request_id,
        userId,
        { matchScore: offer.rows[0]?.match_score || null },
      ],
    );
    await client.query('COMMIT');
    console.log(`[DeliveryController] Courier ${userId} accepted delivery ${id}`);
    const payload = { id, status: 'COURIER_ASSIGNED', courier_id: userId };
    emitDelivery(id, 'delivery:assigned', payload);
    emitUser(delivery.customer_id, 'delivery:assigned', payload);
    emitUser(delivery.seller_id, 'delivery:assigned', payload);
    res.json({ message: 'Delivery accepted successfully!', delivery_id: id, status: 'COURIER_ASSIGNED' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[DeliveryController] acceptDelivery error:', error.message);
    res.status(500).json({ error: 'Failed to accept delivery.' });
  } finally {
    client.release();
  }
};

const TRANSITIONS = {
  AVAILABLE: ['ACCEPTED'],
  COURIER_ASSIGNED: ['GOING_TO_PICKUP'],
  ACCEPTED: ['GOING_TO_PICKUP'],
  GOING_TO_PICKUP: ['ARRIVED_AT_PICKUP'],
  ARRIVED_AT_PICKUP: ['ORDER_COLLECTED'],
  ORDER_COLLECTED: ['GOING_TO_DESTINATION'],
  GOING_TO_DESTINATION: ['ARRIVED_AT_DESTINATION'],
  ARRIVED_AT_DESTINATION: ['DELIVERED'],
  DELIVERED: ['COMPLETED'],
};
const normalizeStatus = (status) =>
  ({
    ARRIVING_FOR_PICKUP: 'GOING_TO_PICKUP',
    PICKED_UP: 'ORDER_COLLECTED',
    IN_TRANSIT: 'GOING_TO_DESTINATION',
    ARRIVED: 'ARRIVED_AT_DESTINATION',
  })[status] || status;

exports.updateStatus = async (req, res) => {
  const { id } = req.params;
  const next = String(req.body.status || '').toUpperCase();
  const { rows } = await pool.query('SELECT * FROM delivery_requests WHERE id = $1 AND courier_id = $2', [
    id,
    req.user.id,
  ]);
  const delivery = rows[0];
  if (!delivery) return res.status(404).json({ error: 'Delivery not found.' });
  const current = normalizeStatus(delivery.status);
  if (!TRANSITIONS[current]?.includes(next))
    return res.status(400).json({ error: `Cannot move from ${current} to ${next}.` });
  const timestamp =
    next === 'ARRIVED_AT_PICKUP'
      ? ', arrived_pickup_at = NOW()'
      : next === 'ARRIVED_AT_DESTINATION'
        ? ', arrived_destination_at = NOW()'
        : next === 'COMPLETED'
          ? ', completed_at = NOW()'
          : '';
  await pool.query(`UPDATE delivery_requests SET status = $1, updated_at = NOW()${timestamp} WHERE id = $2`, [
    next,
    id,
  ]);
  const payload = { id, status: next };
  emitDelivery(id, 'delivery:status', payload);
  emitUser(delivery.customer_id, 'delivery:status', payload);
  emitUser(delivery.seller_id, 'delivery:status', payload);
  if (next.startsWith('ARRIVED'))
    emitDelivery(id, 'delivery:notification', {
      message:
        next === 'ARRIVED_AT_PICKUP' ? 'Pickup point reached.' : 'You have reached the delivery destination.',
    });
  res.json(payload);
};

exports.updateLocation = async (req, res) => {
  const { id } = req.params;
  const { x, y, speed = 0 } = req.body;
  if (![x, y].every(Number.isFinite)) return res.status(400).json({ error: 'Numeric x and y are required.' });
  const allowed = await pool.query(
    'SELECT id,customer_id,seller_id FROM delivery_requests WHERE id = $1 AND courier_id = $2',
    [id, req.user.id],
  );
  if (!allowed.rowCount)
    return res.status(403).json({ error: 'Only the assigned courier can share a location.' });
  const { rows } = await pool.query(
    'INSERT INTO delivery_location_updates (delivery_id, courier_id, x, y, speed) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [id, req.user.id, x, y, speed],
  );
  emitDelivery(id, 'delivery:location', rows[0]);
  emitUser(allowed.rows[0].customer_id, 'delivery:location', rows[0]);
  emitUser(allowed.rows[0].seller_id, 'delivery:location', rows[0]);
  res.json(rows[0]);
};

exports.getTracking = async (req, res) => {
  const { id } = req.params;
  const delivery = await pool.query(
    `SELECT dr.*, u.name courier_name FROM delivery_requests dr LEFT JOIN users u ON u.id = dr.courier_id WHERE dr.id = $1`,
    [id],
  );
  if (!delivery.rowCount) return res.status(404).json({ error: 'Delivery not found.' });
  const d = delivery.rows[0];
  if (![d.customer_id, d.seller_id, d.courier_id].includes(req.user.id))
    return res.status(403).json({ error: 'Not authorized.' });
  const location = await pool.query(
    'SELECT x, y, speed, created_at FROM delivery_location_updates WHERE delivery_id = $1 ORDER BY created_at DESC LIMIT 1',
    [id],
  );
  res.json({ delivery: d, location: location.rows[0] || null });
};

exports.getDeliveryRoute = async (req, res) => {
  const { rows } = await pool.query(
    `SELECT dr.customer_id,dr.seller_id,dr.courier_id,p.*,
    d.id d_id,d.building_id d_building_id,d.route_node_id d_route_node_id,d.x d_x,d.y d_y,d.building_name d_building_name
    FROM delivery_requests dr JOIN campus_locations p ON p.id=dr.pickup_location_id
    JOIN campus_locations d ON d.id=dr.destination_location_id WHERE dr.id=$1`,
    [req.params.id],
  );
  const item = rows[0];
  if (!item) return res.status(404).json({ error: 'Delivery route not found.' });
  if (![item.customer_id, item.seller_id, item.courier_id].includes(req.user.id))
    return res.status(403).json({ error: 'Not authorized.' });
  const destination = {
    id: item.d_id,
    building_id: item.d_building_id,
    route_node_id: item.d_route_node_id,
    x: item.d_x,
    y: item.d_y,
    building_name: item.d_building_name,
  };
  res.json(routeFor(item, destination));
};

exports.createStandaloneOrder = async (req, res) => {
  const {
    pickupLocationId,
    destinationLocationId,
    itemDescription,
    specialInstructions,
    deliveryFee = 40,
  } = req.body;
  if (!pickupLocationId || !destinationLocationId || !itemDescription)
    return res.status(400).json({ error: 'Pickup, destination, and item description are required.' });
  const locations = await pool.query('SELECT * FROM campus_locations WHERE id = ANY($1)', [
    [pickupLocationId, destinationLocationId],
  ]);
  if (locations.rowCount !== 2) return res.status(400).json({ error: 'Choose valid campus locations.' });
  const byId = Object.fromEntries(locations.rows.map((x) => [x.id, x]));
  const pickup = byId[pickupLocationId],
    drop = byId[destinationLocationId];
  const pickupLabel = [pickup.building_name, pickup.floor_name, pickup.room_name].filter(Boolean).join(' · ');
  const dropLabel = [drop.building_name, drop.floor_name, drop.room_name].filter(Boolean).join(' · ');
  const result = await pool.query(
    `INSERT INTO delivery_requests (customer_id, seller_id, pickup_location, drop_location, pickup_location_id, destination_location_id, order_type, item_description, special_instructions, distance, estimated_time, delivery_fee, courier_earning, status, delivery_otp, qr_token)
    VALUES ($1,$1,$2,$3,$4,$5,'CAMPUS_ORDER',$6,$7,0.425,'6 min',$8,$9,'AVAILABLE',$10,$11) RETURNING *`,
    [
      req.user.id,
      pickupLabel,
      dropLabel,
      pickupLocationId,
      destinationLocationId,
      itemDescription,
      specialInstructions || null,
      deliveryFee,
      Number(deliveryFee) * 0.7,
      String(Math.floor(1000 + Math.random() * 9000)),
      crypto.randomBytes(24).toString('hex'),
    ],
  );
  res.status(201).json(result.rows[0]);
};

exports.verifyCompletion = async (req, res) => {
  const { id } = req.params;
  const { method, value } = req.body;
  const result = await pool.query('SELECT * FROM delivery_requests WHERE id = $1 AND courier_id = $2', [
    id,
    req.user.id,
  ]);
  const d = result.rows[0];
  if (!d || normalizeStatus(d.status) !== 'ARRIVED_AT_DESTINATION')
    return res.status(400).json({ error: 'Arrival must be recorded before verification.' });
  const valid =
    method === 'OTP'
      ? d.delivery_otp === String(value)
      : method === 'QR'
        ? d.qr_token === String(value)
        : false;
  if (!valid) return res.status(400).json({ error: 'Verification failed.' });
  await pool.query(
    "UPDATE delivery_requests SET status = 'COMPLETED', completed_at = NOW(), delivered_at = NOW(), updated_at = NOW() WHERE id = $1",
    [id],
  );
  emitDelivery(id, 'delivery:status', { id, status: 'COMPLETED' });
  res.json({ id, status: 'COMPLETED' });
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
      [userId, id],
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
      [id, userId],
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
      [id, userId],
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
      [id],
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
      [id, userId],
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
      [id, userId],
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
      [id, userId],
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
      [id],
    );

    // Also update the rental status to indicate item was delivered via courier
    if (delivery.rental_id) {
      await pool.query(
        `UPDATE rentals SET status = 'RENTAL_ACTIVE', updated_at = NOW() WHERE id = $1 AND status IN ('QR_GENERATED', 'OWNER_PENDING')`,
        [delivery.rental_id],
      );
    }

    console.log(
      `[DeliveryController] Delivery ${id} completed! Courier ${userId} earned ₹${delivery.courier_earning}`,
    );
    res.json({
      message: 'Delivery completed! Earnings recorded.',
      status: 'DELIVERED',
      earning: parseFloat(delivery.courier_earning),
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
      [rentalId],
    );

    if (result.rows.length === 0) {
      return res.json({ has_delivery: false });
    }

    const delivery = result.rows[0];

    // Determine viewer role
    const isSeller = delivery.seller_id === userId;
    const isCustomer = delivery.customer_id === userId;
    // Mask tokens: seller sees pickup_token, customer sees delivery_token
    const response = {
      has_delivery: true,
      delivery_id: delivery.id,
      task_type: delivery.task_type,
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
exports.createDeliveryRequest = async (
  client,
  {
    rental_id,
    listing_id,
    customer_id,
    seller_id,
    pickup_location,
    drop_location,
    delivery_fee,
    distance,
    estimated_time,
  },
) => {
  const pickupToken = generateToken();
  const deliveryToken = generateToken();
  const courierEarning = Math.round(parseFloat(delivery_fee) * 0.7 * 100) / 100; // Courier gets 70%

  const result = await (client || pool).query(
    `INSERT INTO delivery_requests 
       (rental_id, listing_id, customer_id, seller_id, pickup_location, drop_location,
        distance, estimated_time, delivery_fee, courier_earning, status, pickup_token, delivery_token)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'AVAILABLE', $11, $12)
     RETURNING id`,
    [
      rental_id,
      listing_id,
      customer_id,
      seller_id,
      pickup_location || 'Campus',
      drop_location || 'Campus',
      distance || 1.0,
      estimated_time || '10 mins',
      delivery_fee,
      courierEarning,
      pickupToken,
      deliveryToken,
    ],
  );

  console.log(
    `[DeliveryController] Created delivery request ${result.rows[0].id} for rental ${rental_id} (fee: ₹${delivery_fee}, courier earning: ₹${courierEarning})`,
  );
  return result.rows[0].id;
};

