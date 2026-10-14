import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesRentalFilter } from '../src/lib/rental-status.js';
test('active rentals and pending handovers stay visible in Active', () => {
  for (const status of ['RENTAL_ACTIVE', 'ACTIVE', 'MATCHING_COURIER', 'RETURN_IN_TRANSIT']) assert.equal(matchesRentalFilter(status, 'Active'), true);
  assert.equal(matchesRentalFilter('COMPLETED', 'Active'), false);
});
test('Requested includes booking and owner approval states', () => {
  for (const status of ['BOOKING_REQUESTED', 'OWNER_PENDING', 'RENTAL_PAYMENT_COMPLETED']) assert.equal(matchesRentalFilter(status, 'Requested'), true);
  assert.equal(matchesRentalFilter('RENTAL_ACTIVE', 'Requested'), false);
});
