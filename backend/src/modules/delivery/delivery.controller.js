const pool = require('../../config/database');
const { emitDelivery, emitUser } = require('../../shared/realtime');
const { routeFor } = require('../campus/campus.service');
const redactDelivery = (delivery) => {
  const safe = { ...delivery };
  delete safe.pickup_token;
  delete safe.delivery_token;
  return safe;
};

/**
 * CampusMesh Delivery Controller
 * Handles all courier / delivery-person operations.
 */

// ─────────────────────────────────────────────────────────────
//  GET /api/delivery/stats — Dashboard stats for current courier
// ─────────────────────────────────────────────────────────────
exports.getDeliveryStats = async (req, res) => {
  const userId = req.user.id;
  try {
    // Available requests (exclude own items, declined)
    const availableRes = await pool.query(
      `SELECT COUNT(*) as count
       FROM delivery_offers offer
       JOIN delivery_requests dr ON dr.id = offer.delivery_id
       JOIN users courier ON courier.id = offer.courier_id
       WHERE offer.courier_id = $1
         AND courier.delivery_available
         AND offer.status = 'PENDING' AND offer.expires_at > NOW()
         AND dr.status IN ('MATCHING_COURIER','AVAILABLE','NO_COURIER_AVAILABLE','RETURN_MATCHING')
         AND dr.customer_id IS DISTINCT FROM $1
         AND dr.seller_id IS DISTINCT FROM $1`,
      [userId],
    );

    const activeRes = await pool.query(
      `SELECT COUNT(*) as count FROM delivery_requests 
       WHERE courier_id = $1 AND status IN ('COURIER_ASSIGNED','ACCEPTED','GOING_TO_PICKUP','ARRIVING_FOR_PICKUP','ARRIVED_AT_PICKUP','PICKUP_VERIFIED','ORDER_COLLECTED','PICKED_UP','GOING_TO_DESTINATION','IN_TRANSIT','ARRIVED_AT_DESTINATION','ARRIVED','RETURN_COURIER_ASSIGNED','RETURN_IN_TRANSIT')`,
      [userId],
    );

    const completedRes = await pool.query(
      `SELECT COUNT(*) as count FROM delivery_requests WHERE courier_id = $1 AND status IN ('COMPLETED','DELIVERED')`,
      [userId],
    );

    const earningsRes = await pool.query(
      `SELECT COALESCE(SUM(courier_earning), 0) as total FROM delivery_requests WHERE courier_id = $1 AND status IN ('COMPLETED','DELIVERED')`,
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
    await pool.query("UPDATE delivery_offers SET status='EXPIRED' WHERE courier_id=$1 AND status='PENDING' AND expires_at <= NOW()", [userId]);
    const result = await pool.query(
      `SELECT offer.id AS offer_id, offer.delivery_id,
              offer.match_score AS offer_match_score, offer.score_breakdown AS offer_score_breakdown,
              offer.expires_at AS offer_expires_at,
              dr.*,
              l.title AS listing_title, l.image_url AS listing_image, l.category AS listing_category,
              u_seller.name AS seller_name, u_seller.hostel AS seller_hostel,
              u_customer.name AS customer_name, u_customer.hostel AS customer_hostel
       FROM delivery_offers offer
       JOIN delivery_requests dr ON dr.id = offer.delivery_id
       JOIN users courier ON courier.id = offer.courier_id
       LEFT JOIN listings l ON l.id = dr.listing_id
       LEFT JOIN users u_seller ON u_seller.id = dr.seller_id
       LEFT JOIN users u_customer ON u_customer.id = dr.customer_id
       WHERE offer.courier_id = $1
         AND courier.delivery_available
         AND offer.status = 'PENDING' AND offer.expires_at > NOW()
         AND dr.status IN ('MATCHING_COURIER','AVAILABLE','NO_COURIER_AVAILABLE','RETURN_MATCHING')
         AND dr.customer_id IS DISTINCT FROM $1
         AND dr.seller_id IS DISTINCT FROM $1
         AND NOT ($1 = ANY(COALESCE(dr.declined_by, ARRAY[]::uuid[])))
       ORDER BY offer.match_score DESC, dr.created_at DESC`,
      [userId],
    );
    res.json(result.rows.map(redactDelivery));
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
         CASE WHEN dr.status IN ('COMPLETED','DELIVERED') THEN 1 ELSE 0 END,
         dr.updated_at DESC`,
      [userId],
    );
    res.json(result.rows.map(redactDelivery));
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
       FROM delivery_requests WHERE courier_id = $1 AND status IN ('COMPLETED','DELIVERED')`,
      [userId],
    );

    // Today's earnings
    const todayRes = await pool.query(
      `SELECT COALESCE(SUM(courier_earning), 0) as today_total, COUNT(*) as today_count
       FROM delivery_requests 
       WHERE courier_id = $1 AND status IN ('COMPLETED','DELIVERED') AND COALESCE(delivered_at, completed_at)::date = CURRENT_DATE`,
      [userId],
    );

    // Recent transactions
    const transactionsRes = await pool.query(
      `SELECT dr.id, dr.courier_earning, dr.delivered_at, dr.pickup_location, dr.drop_location,
              l.title as listing_title, l.image_url as listing_image
       FROM delivery_requests dr
       LEFT JOIN listings l ON dr.listing_id = l.id
       WHERE dr.courier_id = $1 AND dr.status IN ('COMPLETED','DELIVERED')
       ORDER BY COALESCE(dr.delivered_at, dr.completed_at) DESC LIMIT 20`,
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
    const allowed = [delivery.customer_id, delivery.seller_id, delivery.courier_id].filter(Boolean);
    if (!allowed.includes(userId)) {
      const offer = await pool.query(
        `SELECT 1 FROM delivery_offers WHERE delivery_id=$1 AND courier_id=$2
         AND status='PENDING' AND expires_at > NOW()`,
        [id, userId],
      );
      if (!offer.rowCount) return res.status(403).json({ error: 'Not authorized to view this delivery.' });
    }

    // Handover credentials are issued through the role-bound endpoint and are never returned here.
    res.json(redactDelivery(delivery));
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
    const availability = await client.query('SELECT delivery_available FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (!availability.rows[0]?.delivery_available) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Go online before accepting a delivery.' });
    }
    const offer = await client.query(
      `UPDATE delivery_offers SET status='ACCEPTED', responded_at=NOW()
      WHERE delivery_id=$1 AND courier_id=$2 AND status='PENDING' AND expires_at>NOW() RETURNING match_score`,
      [id, userId],
    );
    if (!offer.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This offer expired or the task was assigned.' });
    }
    const result = await client.query(
      `UPDATE delivery_requests 
       SET courier_id = $1, status = 'COURIER_ASSIGNED', accepted_at = NOW(), match_score=$3, updated_at = NOW()
       WHERE id = $2 AND status IN ('AVAILABLE','MATCHING_COURIER','RETURN_MATCHING') AND customer_id IS DISTINCT FROM $1 AND seller_id IS DISTINCT FROM $1
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
    const payload = {
      id, delivery_id: id, rental_id: delivery.rental_id, listing_id: delivery.listing_id,
      item_description: delivery.item_description, status: 'COURIER_ASSIGNED', courier_id: userId,
    };
    emitDelivery(id, 'delivery:assigned', payload);
    emitDelivery(id, 'delivery:status', payload);
    emitUser(userId, 'delivery:assigned', payload);
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
  COURIER_ASSIGNED: ['GOING_TO_PICKUP'],
  ACCEPTED: ['GOING_TO_PICKUP'],
  GOING_TO_PICKUP: ['ARRIVED_AT_PICKUP'],
  IN_TRANSIT: ['ARRIVED_AT_DESTINATION'],
  RETURN_COURIER_ASSIGNED: ['GOING_TO_PICKUP'],
};
const normalizeStatus = (status) =>
  ({
    ARRIVING_FOR_PICKUP: 'GOING_TO_PICKUP',
    PICKUP_VERIFIED: 'IN_TRANSIT',
    ORDER_COLLECTED: 'IN_TRANSIT',
    PICKED_UP: 'IN_TRANSIT',
    GOING_TO_DESTINATION: 'IN_TRANSIT',
    RETURN_PICKUP_VERIFIED: 'RETURN_IN_TRANSIT',
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
  const payload = { id, delivery_id: id, status: next, courier_id: req.user.id };
  emitDelivery(id, 'delivery:status', payload);
  emitUser(req.user.id, 'delivery:status', payload);
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
  const { x, y, route_node_id = null, speed = 0 } = req.body;
  if (![x, y].every(Number.isFinite)) return res.status(400).json({ error: 'Numeric x and y are required.' });
  const allowed = await pool.query(
    'SELECT id,customer_id,seller_id,status FROM delivery_requests WHERE id = $1 AND courier_id = $2',
    [id, req.user.id],
  );
  if (!allowed.rowCount)
    return res.status(403).json({ error: 'Only the assigned courier can share a location.' });
  if (!['COURIER_ASSIGNED', 'GOING_TO_PICKUP', 'ARRIVED_AT_PICKUP', 'IN_TRANSIT', 'ARRIVED_AT_DESTINATION', 'RETURN_COURIER_ASSIGNED', 'RETURN_IN_TRANSIT'].includes(allowed.rows[0].status))
    return res.status(409).json({ error: 'Location sharing is closed for this delivery stage.' });
  const { rows } = await pool.query(
    'INSERT INTO delivery_location_updates (delivery_id, courier_id, x, y, route_node_id, speed) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [id, req.user.id, x, y, route_node_id, speed],
  );
  emitDelivery(id, 'delivery:location', rows[0]);
  emitUser(allowed.rows[0].customer_id, 'delivery:location', rows[0]);
  emitUser(allowed.rows[0].seller_id, 'delivery:location', rows[0]);
  res.json(rows[0]);
};

exports.getTracking = async (req, res) => {
  const { id } = req.params;
  const delivery = await pool.query(
    `SELECT dr.*,
            l.title AS listing_title, l.image_url AS listing_image, l.category AS listing_category,
            u_seller.name AS seller_name, u_seller.hostel AS seller_hostel,
            u_customer.name AS customer_name, u_customer.hostel AS customer_hostel,
            u_courier.name AS courier_name, u_courier.phone_number AS courier_phone
     FROM delivery_requests dr
     LEFT JOIN listings l ON l.id = dr.listing_id
     LEFT JOIN users u_seller ON u_seller.id = dr.seller_id
     LEFT JOIN users u_customer ON u_customer.id = dr.customer_id
     LEFT JOIN users u_courier ON u_courier.id = dr.courier_id
     WHERE dr.id = $1`,
    [id],
  );
  if (!delivery.rowCount) return res.status(404).json({ error: 'Delivery not found.' });
  const d = redactDelivery(delivery.rows[0]);
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

// ─────────────────────────────────────────────────────────────
//  GET /api/delivery/rental/:rentalId — Get delivery status for a rental
//  (Used by RentDetails / OwnerDashboard to show courier info)
// ─────────────────────────────────────────────────────────────
exports.getRentalDeliveryStatus = async (req, res) => {
  const { rentalId } = req.params;
  const userId = req.user.id;

  try {
    const access = await pool.query(
      'SELECT id FROM rentals WHERE id=$1 AND (borrower_id=$2 OR owner_id=$2)',
      [rentalId, userId],
    );
    if (!access.rows[0]) return res.status(403).json({ error: 'You do not have access to this rental delivery.' });

    const result = await pool.query(
      `SELECT dr.*,
              l.title AS listing_title, l.image_url AS listing_image, l.category AS listing_category,
              owner.name AS owner_name, owner.email AS owner_email,
              renter.name AS renter_name, renter.email AS renter_email,
              courier.name AS courier_name, courier.phone_number AS courier_phone
       FROM delivery_requests dr
       JOIN rentals r ON r.id = dr.rental_id
       LEFT JOIN listings l ON l.id = dr.listing_id
       LEFT JOIN users owner ON owner.id = dr.seller_id
       LEFT JOIN users renter ON renter.id = dr.customer_id
       LEFT JOIN users courier ON courier.id = dr.courier_id
       WHERE dr.rental_id = $1
       ORDER BY CASE
         WHEN dr.status IN ('MATCHING_COURIER','COURIER_ASSIGNED','GOING_TO_PICKUP','ARRIVED_AT_PICKUP','IN_TRANSIT','ARRIVED_AT_DESTINATION','RETURN_MATCHING','RETURN_COURIER_ASSIGNED','RETURN_IN_TRANSIT') THEN 0
         WHEN dr.id = r.outbound_delivery_id THEN 1
         WHEN dr.id = r.return_delivery_id THEN 2
         ELSE 3 END, dr.created_at DESC
       LIMIT 1`,
      [rentalId],
    );

    if (!result.rows[0]) return res.json({ has_delivery: false });
    const delivery = result.rows[0];
    const handovers = await pool.query(
      'SELECT stage,status,expires_at,verified_at FROM handover_verifications WHERE delivery_id=$1 ORDER BY stage',
      [delivery.id],
    );
    const pickupStage = delivery.task_type === 'XEROX_DELIVERY' ? 'XEROX_PICKUP' : delivery.task_type === 'RENTAL_RETURN' ? 'RETURN_PICKUP' : 'PICKUP';
    const deliveryStage = delivery.task_type === 'RENTAL_RETURN' ? 'RETURN_RECEIVED' : 'DELIVERY';
    const pickupHandover = handovers.rows.find((item) => item.stage === pickupStage);
    const deliveryHandover = handovers.rows.find((item) => item.stage === deliveryStage);
    const nextHandshake = delivery.status === 'COMPLETED'
      ? null
      : delivery.status === 'ARRIVED_AT_PICKUP' && pickupHandover?.status !== 'USED'
        ? pickupStage
        : delivery.task_type === 'RENTAL_RETURN' && delivery.status === 'RETURN_IN_TRANSIT' && pickupHandover?.status === 'USED'
          ? deliveryStage
          : delivery.status === 'ARRIVED_AT_DESTINATION' && pickupHandover?.status === 'USED'
            ? deliveryStage
            : null;

    res.json({
      has_delivery: true,
      delivery_id: delivery.id,
      rental_id: delivery.rental_id,
      listing_id: delivery.listing_id,
      listing_title: delivery.listing_title,
      listing_image: delivery.listing_image,
      task_type: delivery.task_type,
      status: delivery.status,
      owner_name: delivery.owner_name || null,
      renter_name: delivery.renter_name || null,
      courier_name: delivery.courier_name || null,
      courier_phone: delivery.courier_phone || null,
      pickup_location: delivery.pickup_location,
      drop_location: delivery.drop_location,
      delivery_fee: delivery.delivery_fee,
      estimated_time: delivery.estimated_time,
      accepted_at: delivery.accepted_at,
      picked_up_at: delivery.picked_up_at,
      delivered_at: delivery.delivered_at,
      arrived_pickup_at: delivery.arrived_pickup_at,
      arrived_destination_at: delivery.arrived_destination_at,
      pickup_verified_at: delivery.pickup_verified_at,
      delivery_verified_at: delivery.delivery_verified_at,
      handovers: handovers.rows,
      pickup_handover_status: pickupHandover?.status || null,
      delivery_handover_status: deliveryHandover?.status || null,
      next_handshake: nextHandshake,
    });
  } catch (error) {
    console.error('[DeliveryController] getRentalDeliveryStatus error:', error.message);
    res.status(500).json({ error: 'Failed to fetch delivery status.' });
  }
};
