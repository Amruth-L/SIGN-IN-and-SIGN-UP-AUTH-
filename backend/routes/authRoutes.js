const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/signup', authController.signup);
router.post('/verify-email', authController.verifyEmail);
router.post('/resend-otp', authController.resendOtp);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/login', authController.login);
router.get('/profile', authMiddleware, authController.getProfile);
router.put('/profile', authMiddleware, authController.updateProfile);
router.get('/me', authMiddleware, authController.getProfile);
router.put('/mode', authMiddleware, authController.setMode);
router.put('/delivery-availability', authMiddleware, authController.setDeliveryAvailability);
router.post('/logout', authController.logout);

module.exports = router;
