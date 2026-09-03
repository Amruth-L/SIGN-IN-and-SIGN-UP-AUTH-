const pool = require('../../config/database');
const { routeFor } = require('../campus/campus.service');
const { emitUser } = require('../../shared/realtime');

const overlapMeters = (courierNodes, taskNodes, taskDistance) => {
  const courierEdges = new Set(courierNodes.slice(1).map((node, i) => [courierNodes[i], node].sort().join(':')));
  const shared = taskNodes.slice(1).filter((node, i) => courierEdges.has([taskNodes[i], node].sort().join(':'))).length;
  return taskNodes.length > 1 ? taskDistance * shared / (taskNodes.length - 1) : 0;
};

function scoreCandidate(route, task, reliability = 100) {
  const courierPath = routeFor(route.origin, route.destination);
  const taskPath = routeFor(task.pickup, task.destination);
  const toPickup = routeFor(route.origin, task.pickup);
  const fromDrop = routeFor(task.destination, route.destination);
  if (!courierPath || !taskPath || !toPickup || !fromDrop) return null;
  const sharedMeters = overlapMeters(courierPath.nodes, taskPath.nodes, taskPath.distanceMeters);
  const overlapRatio = taskPath.distanceMeters ? sharedMeters / taskPath.distanceMeters : 0;
  const pickupDetour = Math.max(0, toPickup.distanceMeters + taskPath.distanceMeters + fromDrop.distanceMeters - courierPath.distanceMeters);
  const dropDetour = Math.max(0, fromDrop.distanceMeters - courierPath.distanceMeters * .25);
  const finishAt = Date.now() + (toPickup.distanceMeters + taskPath.distanceMeters + fromDrop.distanceMeters) / 78 * 60000;
  if (pickupDetour > route.max_detour_meters || overlapRatio < .15 || new Date(route.available_until).getTime() < finishAt) return null;
  const breakdown = {
    routeOverlap: Math.round(overlapRatio * 45),
    pickupDetour: Math.round(Math.max(0, 1 - pickupDetour / Math.max(route.max_detour_meters, 1)) * 25),
    dropoffDetour: Math.round(Math.max(0, 1 - dropDetour / Math.max(route.max_detour_meters, 1)) * 15),
    availability: 10,
    reliability: Math.round(Math.min(100, Number(reliability)) / 100 * 5),
  };
  return { score: Object.values(breakdown).reduce((sum, value) => sum + value, 0), breakdown, courierPath, taskPath };
}

async function matchDelivery(deliveryId, client = pool) {
  const deliveryResult = await client.query(`SELECT dr.*, p.route_node_id pickup_node, d.route_node_id destination_node
    FROM delivery_requests dr JOIN campus_locations p ON p.id = dr.pickup_location_id
    JOIN campus_locations d ON d.id = dr.destination_location_id WHERE dr.id = $1`, [deliveryId]);
  const task = deliveryResult.rows[0]; if (!task) return [];
  const candidates = await client.query(`SELECT cra.*, u.courier_reliability_score,
      o.route_node_id origin_node, d.route_node_id destination_node
    FROM courier_route_availability cra JOIN users u ON u.id = cra.courier_id
    JOIN campus_locations o ON o.id = cra.origin_location_id JOIN campus_locations d ON d.id = cra.destination_location_id
    WHERE cra.is_active AND cra.available_until > NOW() AND u.delivery_available
      AND cra.courier_id NOT IN (SELECT courier_id FROM delivery_requests WHERE courier_id IS NOT NULL AND status IN (
        'COURIER_ASSIGNED','ACCEPTED','GOING_TO_PICKUP','ARRIVING_FOR_PICKUP','ARRIVED_AT_PICKUP',
        'PICKUP_VERIFIED','ORDER_COLLECTED','PICKED_UP','GOING_TO_DESTINATION','IN_TRANSIT',
        'ARRIVED_AT_DESTINATION','ARRIVED','RETURN_COURIER_ASSIGNED','RETURN_MATCHING','RETURN_PICKUP_VERIFIED','RETURN_IN_TRANSIT'
      ))
      AND cra.courier_id <> $1 AND ($2 IS NULL OR cra.courier_id <> $2)`, [task.customer_id, task.seller_id]);
  const ranked = candidates.rows.map(candidate => {
    const scored = scoreCandidate({ ...candidate, origin: candidate.origin_node, destination: candidate.destination_node },
      { pickup: task.pickup_node, destination: task.destination_node }, candidate.courier_reliability_score);
    return scored && { ...candidate, ...scored };
  }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 3);
  if (ranked.length) await client.query("UPDATE delivery_requests SET status = 'MATCHING_COURIER' WHERE id = $1 AND status IN ('AVAILABLE', 'NO_COURIER_AVAILABLE')", [deliveryId]);
  for (const candidate of ranked) {
    const { rows } = await client.query(`INSERT INTO delivery_offers (delivery_id, courier_id, match_score, score_breakdown, expires_at)
      VALUES ($1,$2,$3,$4,NOW() + INTERVAL '5 minutes') ON CONFLICT (delivery_id, courier_id)
      DO UPDATE SET match_score=EXCLUDED.match_score, score_breakdown=EXCLUDED.score_breakdown, status='PENDING', offered_at=NOW(), expires_at=EXCLUDED.expires_at
      RETURNING *`, [deliveryId, candidate.courier_id, candidate.score, candidate.breakdown]);
    emitUser(candidate.courier_id, 'delivery:offer', { ...rows[0], delivery: task });
  }
  if (!ranked.length) await client.query("UPDATE delivery_requests SET status = 'NO_COURIER_AVAILABLE' WHERE id = $1 AND status IN ('MATCHING_COURIER','RETURN_MATCHING','AVAILABLE','NO_COURIER_AVAILABLE')", [deliveryId]);
  return ranked;
}

module.exports = { scoreCandidate, matchDelivery };
