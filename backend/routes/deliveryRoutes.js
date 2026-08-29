const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const deliveryController = require('../controllers/deliveryController');

// All delivery routes require authentication
router.use(authMiddleware);

// Dashboard & listing endpoints
router.get('/stats', deliveryController.getDeliveryStats);
router.get('/available', deliveryController.getAvailableDeliveries);
router.get('/my-deliveries', deliveryController.getMyDeliveries);
router.get('/earnings', deliveryController.getEarnings);

// Rental-specific delivery status (for customer/seller views)
// Must be before /:id to avoid 'rental' matching as UUID
router.get('/rental/:rentalId', deliveryController.getRentalDeliveryStatus);

// Single delivery detail
router.get('/:id', deliveryController.getDeliveryById);

// Courier actions
router.post('/:id/accept', deliveryController.acceptDelivery);
router.post('/:id/deny', deliveryController.denyDelivery);
router.post('/:id/start-pickup', deliveryController.startPickup);
router.post('/:id/verify-pickup', deliveryController.verifyPickup);
router.post('/:id/start-delivery', deliveryController.startDelivery);
router.post('/:id/arrive', deliveryController.arriveAtDrop);
router.post('/:id/verify-delivery', deliveryController.verifyDelivery);

module.exports = router;
