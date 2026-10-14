export function matchesRentalFilter(status, filter) {
  if (filter === 'All') return true;
  if (filter === 'Requested') return ['BOOKING_PAYMENT_PENDING', 'BOOKING_REQUESTED', 'RENTAL_PAYMENT_COMPLETED', 'OWNER_PENDING', 'DEPOSIT_PENDING', 'OWNER_ACCEPTED', 'WAITING_FOR_DEPOSIT'].includes(status);
  if (filter === 'Active') return ['ACTIVE', 'RENTAL_ACTIVE', 'DEPOSIT_PAID', 'DELIVERY_PENDING', 'DELIVERY_IN_PROGRESS', 'RETURN_REQUESTED', 'RETURN_IN_TRANSIT', 'MATCHING_COURIER', 'NO_COURIER_AVAILABLE', 'COURIER_ASSIGNED', 'IN_TRANSIT', 'RETURN_PENDING', 'RETURN_MATCHING', 'RETURN_COURIER_ASSIGNED'].includes(status);
  return filter === 'Completed' && ['COMPLETED', 'RENTAL_COMPLETED', 'DEPOSIT_REFUNDED'].includes(status);
}
