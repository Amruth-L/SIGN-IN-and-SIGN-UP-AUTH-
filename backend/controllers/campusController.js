const pool = require('../config/db');
const { campusPayload, routeFor } = require('../services/campusService');

exports.getCampus = (_req, res) => res.json(campusPayload());
exports.getLocations = async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM campus_locations ORDER BY building_name, floor_name, room_name');
  res.json(rows);
};
exports.getRoute = (req, res) => res.json({ ...routeFor(), from: req.query.from, to: req.query.to, travelMode: req.query.mode || 'WALK' });
