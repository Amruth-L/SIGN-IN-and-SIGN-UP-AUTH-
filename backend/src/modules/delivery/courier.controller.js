const pool = require('../../config/database');
const { routeFor } = require('../campus/campus.service');
const { matchDelivery } = require('./matching.service');

const loadLocations = async (originId, destinationId) => {
  const { rows } = await pool.query('SELECT * FROM campus_locations WHERE id = ANY($1)', [[originId, destinationId]]);
  return Object.fromEntries(rows.map(location => [location.id, location]));
};

exports.upsertRoute = async (req, res) => {
  const { origin_location_id, destination_location_id, available_until, max_detour_meters = 250 } = req.body;
  if (!origin_location_id || !destination_location_id || !available_until) return res.status(400).json({ error: 'Origin, destination, and available-until time are required.' });
  if (origin_location_id === destination_location_id) return res.status(400).json({ error: 'Choose two different locations.' });
  const locations = await loadLocations(origin_location_id, destination_location_id);
  const route = routeFor(locations[origin_location_id], locations[destination_location_id]);
  if (!route) return res.status(422).json({ error: 'No campus route connects those locations.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE courier_route_availability SET is_active = FALSE WHERE courier_id = $1 AND is_active', [req.user.id]);
    const { rows } = await client.query(`INSERT INTO courier_route_availability
      (courier_id, origin_location_id, destination_location_id, route_node_ids, available_until, max_detour_meters)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [req.user.id, origin_location_id, destination_location_id, route.nodes, available_until, Math.max(50, Number(max_detour_meters))]);
    await client.query("UPDATE users SET delivery_available=TRUE, active_mode='DELIVERY' WHERE id=$1", [req.user.id]);
    await client.query('COMMIT');
    const openTasks = await pool.query("SELECT id FROM delivery_requests WHERE status IN ('MATCHING_COURIER','RETURN_MATCHING','AVAILABLE','NO_COURIER_AVAILABLE') AND (customer_id IS NULL OR customer_id <> $1) AND (seller_id IS NULL OR seller_id <> $1)", [req.user.id]);
    await Promise.all(openTasks.rows.map((task) => matchDelivery(task.id)));
    res.status(201).json({ ...rows[0], route });
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
};

exports.currentRoute = async (req, res) => {
  const { rows } = await pool.query(`SELECT cra.*, o.building_name origin_name, d.building_name destination_name
    FROM courier_route_availability cra JOIN campus_locations o ON o.id=cra.origin_location_id
    JOIN campus_locations d ON d.id=cra.destination_location_id WHERE courier_id=$1 AND is_active ORDER BY created_at DESC LIMIT 1`, [req.user.id]);
  if (!rows[0]) return res.json({ route: null });
  const locations = await loadLocations(rows[0].origin_location_id, rows[0].destination_location_id);
  res.json({ route: rows[0], navigation: routeFor(locations[rows[0].origin_location_id], locations[rows[0].destination_location_id]) });
};

exports.deactivateRoute = async (req, res) => {
  await pool.query('UPDATE courier_route_availability SET is_active=FALSE WHERE courier_id=$1 AND is_active', [req.user.id]);
  await pool.query('UPDATE users SET delivery_available=FALSE WHERE id=$1', [req.user.id]);
  res.json({ route: null, delivery_available: false });
};

exports.getOffers = async (req, res) => {
  await pool.query("UPDATE delivery_offers SET status='EXPIRED' WHERE courier_id=$1 AND status='PENDING' AND expires_at <= NOW()", [req.user.id]);
  const { rows } = await pool.query(`SELECT offer.*, dr.task_type, dr.item_description, dr.pickup_location, dr.drop_location,
      dr.pickup_location_id, dr.destination_location_id, dr.estimated_time, dr.delivery_fee
    FROM delivery_offers offer JOIN delivery_requests dr ON dr.id=offer.delivery_id
    WHERE offer.courier_id=$1 AND offer.status='PENDING' AND offer.expires_at > NOW() ORDER BY offer.match_score DESC`, [req.user.id]);
  res.json(rows);
};

exports.declineOffer = async (req, res) => {
  const { rows } = await pool.query(`UPDATE delivery_offers SET status='DECLINED', responded_at=NOW()
    WHERE delivery_id=$1 AND courier_id=$2 AND status='PENDING' RETURNING *`, [req.params.id, req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Active offer not found.' });
  res.json(rows[0]);
};

