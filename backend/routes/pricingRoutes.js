const express = require('express');
const router = express.Router();
const pricingController = require('../controllers/pricingController');

// POST /api/pricing/calculate - Calculate full dynamic pricing breakdown
router.post('/calculate', pricingController.calculatePricingHandler);

module.exports = router;
