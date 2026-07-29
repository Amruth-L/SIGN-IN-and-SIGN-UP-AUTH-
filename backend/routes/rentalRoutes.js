const express = require('express');
const router = express.Router();
const rentalController = require('../controllers/rentalController');
const authMiddleware = require('../middleware/authMiddleware');

// All rental routes require authentication
router.use(authMiddleware);

router.post('/book', rentalController.bookRental);
router.post('/respond', rentalController.respondToBooking);
router.get('/my-rentals', rentalController.getMyRentals);
router.get('/my-listings-requests', rentalController.getOwnerRequests);
router.get('/:id/status', rentalController.getRentalStatus);
router.post('/:id/complete', rentalController.confirmReturn);

module.exports = router;
