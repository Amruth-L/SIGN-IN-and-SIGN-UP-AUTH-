const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const authMiddleware = require('../middleware/authMiddleware');

// GET /api/profile - Get current user profile
router.get('/', authMiddleware, profileController.getProfile);

// POST /api/profile - Create user profile
router.post('/', authMiddleware, profileController.createProfile);

// PUT /api/profile - Update user profile
router.put('/', authMiddleware, profileController.updateProfile);

module.exports = router;
