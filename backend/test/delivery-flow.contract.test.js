/* global fetch */
const test = require('node:test');
const assert = require('node:assert/strict');

const enabled = process.env.DELIVERY_E2E === '1';
const baseUrl = process.env.DELIVERY_API_URL || 'http://localhost:3003';
const password = process.env.DELIVERY_E2E_PASSWORD || 'CampusMesh@123';
const users = {
  owner: process.env.DELIVERY_E2E_OWNER_EMAIL || 'studenta@dbit.co.in',
  renter: process.env.DELIVERY_E2E_RENTER_EMAIL || 'studentb@dbit.co.in',
  courier: process.env.DELIVERY_E2E_COURIER_EMAIL || 'studentc@dbit.co.in',
};

async function call(token, path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  let data = null;
  try { data = await response.json(); } catch {}
  return { response, data };
}

async function login(email) {
  const { response, data } = await call(null, '/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200, `Could not login ${email}: ${JSON.stringify(data)}`);
  return data;
}

function expectOk(result, label) {
  assert.ok(result.response.ok, `${label} failed (${result.response.status}): ${JSON.stringify(result.data)}`);
  return result.data;
}

test('three-user rental delivery contract', { skip: !enabled }, async () => {
  expectOk(await call(null, '/health'), 'health');
  const [owner, renter, courier] = await Promise.all([
    login(users.owner), login(users.renter), login(users.courier),
  ]);
  const ownerToken = owner.token;
  const renterToken = renter.token;
  const courierToken = courier.token;

  const listings = expectOk(await call(ownerToken, '/listings'), 'listings');
  const listing = listings.find((item) => item.owner_id === owner.user.id && item.rent_price > 0 && item.is_active !== false);
  assert.ok(listing, 'No active rental listing found for the configured owner.');
  const locations = expectOk(await call(renterToken, '/api/campus/locations'), 'campus locations');
  const destination = locations.find((item) => item.id === 'hostel-ground-floor-204' && item.id !== listing.pickup_location_id)
    || locations.find((item) => item.id === 'library-ground-floor-rental-counter-02' && item.id !== listing.pickup_location_id)
    || locations.find((item) => item.id !== listing.pickup_location_id && item.location_type === 'ROOM');
  assert.ok(destination, 'No destination campus location available.');

  const start = new Date(Date.now() + (30 + (Date.now() % 365)) * 86400000);
  const end = new Date(start.getTime() + 86400000);
  const dateOnly = (value) => value.toISOString().slice(0, 10);
  const booking = expectOk(await call(renterToken, '/api/rentals/book', {
    method: 'POST',
    body: JSON.stringify({
      listing_id: listing.id,
      start_date: dateOnly(start),
      end_date: dateOnly(end),
      delivery_requested: true,
      drop_location_id: destination.id,
    }),
  }), 'create rental');
  const rentalId = booking.rental.id;

  const rentalOrder = expectOk(await call(renterToken, '/api/payment/create-rental-order', {
    method: 'POST', body: JSON.stringify({ booking_id: rentalId }),
  }), 'create rental order');
  expectOk(await call(renterToken, '/api/payment/verify-rental', {
    method: 'POST',
    body: JSON.stringify({ booking_id: rentalId, gateway_order_id: rentalOrder.order_id, gateway_payment_id: `sim_payment_${rentalId}`, gateway_signature: 'simulated' }),
  }), 'verify rental payment');

  const ownerRequests = expectOk(await call(ownerToken, '/api/rentals/my-listings-requests'), 'owner request queue');
  const ownerRequest = ownerRequests.requests.find((request) => request.id === rentalId);
  assert.ok(ownerRequest?.actionable, 'The paid request is not actionable in the owner queue.');
  expectOk(await call(ownerToken, '/api/rentals/respond', {
    method: 'POST', body: JSON.stringify({ rental_id: rentalId, response: 'ACCEPTED' }),
  }), 'owner accept');

  const depositOrder = expectOk(await call(renterToken, '/api/payment/create-deposit-order', {
    method: 'POST', body: JSON.stringify({ booking_id: rentalId }),
  }), 'create deposit order');
  expectOk(await call(renterToken, '/api/payment/verify-deposit', {
    method: 'POST',
    body: JSON.stringify({ booking_id: rentalId, gateway_order_id: depositOrder.order_id, gateway_payment_id: `sim_deposit_${rentalId}`, gateway_signature: 'simulated' }),
  }), 'verify deposit');

  const routePayload = {
    origin_location_id: listing.pickup_location_id,
    destination_location_id: destination.id,
    available_until: new Date(Date.now() + 2 * 3600000).toISOString(),
    max_detour_meters: 750,
  };
  const routeSaves = await Promise.all(Array.from({ length: 10 }, () => call(courierToken, '/api/courier/routes', {
    method: 'POST', body: JSON.stringify(routePayload),
  })));
  assert.ok(routeSaves.every(({ response }) => response.status !== 500), 'A parallel route save returned 500.');
  assert.ok(routeSaves.some(({ response }) => response.ok), 'No parallel route save succeeded.');
  const currentRoute = expectOk(await call(courierToken, '/api/courier/routes/current'), 'current route');
  assert.ok(currentRoute.route && currentRoute.delivery_available, 'Courier did not end with one active online route.');

  const available = expectOk(await call(courierToken, '/api/delivery/available'), 'available deliveries');
  const offer = available.deliveries.find((delivery) => delivery.rental_id === rentalId);
  assert.ok(offer, 'Courier did not receive the rental delivery offer.');
  assert.equal(offer.customer_id, renter.user.id);
  assert.equal(offer.seller_id, owner.user.id);
  assert.equal(offer.listing_title, listing.title);
  assert.ok(offer.pickup_location && offer.drop_location && offer.offer_expires_at, 'Offer is missing delivery details or expiry.');

  const deliveryId = offer.delivery_id;
  expectOk(await call(courierToken, `/api/delivery/${deliveryId}/accept`, { method: 'POST', body: '{}' }), 'courier accept');
  const active = expectOk(await call(courierToken, '/api/delivery/my-deliveries'), 'active delivery');
  assert.ok(active.some((delivery) => delivery.id === deliveryId && delivery.status === 'COURIER_ASSIGNED'));

  expectOk(await call(courierToken, `/api/delivery/${deliveryId}/status`, { method: 'POST', body: JSON.stringify({ status: 'GOING_TO_PICKUP' }) }), 'go to pickup');
  expectOk(await call(courierToken, `/api/delivery/${deliveryId}/status`, { method: 'POST', body: JSON.stringify({ status: 'ARRIVED_AT_PICKUP' }) }), 'arrive at pickup');
  const pickupCredential = expectOk(await call(ownerToken, `/api/delivery/${deliveryId}/handover/PICKUP`), 'pickup credential');
  expectOk(await call(courierToken, `/api/delivery/${deliveryId}/verify-handover`, {
    method: 'POST', body: JSON.stringify({ stage: 'PICKUP', method: 'QR', value: pickupCredential.qr }),
  }), 'pickup verification');
  expectOk(await call(courierToken, `/api/delivery/${deliveryId}/status`, { method: 'POST', body: JSON.stringify({ status: 'ARRIVED_AT_DESTINATION' }) }), 'arrive at destination');
  const deliveryCredential = expectOk(await call(renterToken, `/api/delivery/${deliveryId}/handover/DELIVERY`), 'delivery credential');
  expectOk(await call(courierToken, `/api/delivery/${deliveryId}/verify-handover`, {
    method: 'POST', body: JSON.stringify({ stage: 'DELIVERY', method: 'OTP', value: deliveryCredential.otp }),
  }), 'delivery verification');

  const history = expectOk(await call(renterToken, '/api/activity/history?limit=20'), 'renter history');
  assert.ok(history.records.some((record) => record.rental_id === rentalId && record.role === 'RENTER' && record.status === 'COMPLETED'));
  const finalStatus = expectOk(await call(renterToken, `/api/delivery/rental/${rentalId}`), 'final rental delivery status');
  assert.equal(finalStatus.status, 'COMPLETED');
});
