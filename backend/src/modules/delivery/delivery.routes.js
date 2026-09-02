const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/authMiddleware');
const deliveryController = require('./delivery.controller');
const handoverController = require('./handover.controller');
const courierController = require('./courier.controller');

// All delivery routes require authentication
router.use(authMiddleware);

// Dashboard & listing endpoints
router.get('/stats', deliveryController.getDeliveryStats);
router.get('/available', deliveryController.getAvailableDeliveries);
router.get('/my-deliveries', deliveryController.getMyDeliveries);
router.get('/earnings', deliveryController.getEarnings);
router.get('/offers', courierController.getOffers);
router.post('/orders', deliveryController.createStandaloneOrder);

// Rental-specific delivery status (for customer/seller views)
// Must be before /:id to avoid 'rental' matching as UUID
router.get('/rental/:rentalId', deliveryController.getRentalDeliveryStatus);
router.get('/:id/tracking', deliveryController.getTracking);
router.get('/:id/route', deliveryController.getDeliveryRoute);
router.get('/:id/handover/:stage', handoverController.getHandover);

// Single delivery detail
router.get('/:id', deliveryController.getDeliveryById);

// Courier actions
router.post('/:id/accept', deliveryController.acceptDelivery);
router.post('/:id/deny', deliveryController.denyDelivery);
router.post('/:id/decline', courierController.declineOffer);
router.post('/:id/start-pickup', deliveryController.startPickup);
router.post('/:id/verify-pickup', deliveryController.verifyPickup);
router.post('/:id/start-delivery', deliveryController.startDelivery);
router.post('/:id/arrive', deliveryController.arriveAtDrop);
router.post('/:id/verify-delivery', deliveryController.verifyDelivery);
router.post('/:id/status', deliveryController.updateStatus);
router.post('/:id/location', deliveryController.updateLocation);
router.post('/:id/verify-handover', handoverController.verifyHandover);
router.post('/:id/verify', deliveryController.verifyCompletion);

module.exports = router;

