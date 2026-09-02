const crypto = require('crypto');
require('dotenv').config();

const verifyPaymentSignature = (req, res, next) => {
  const { gateway_order_id, gateway_payment_id, gateway_signature } = req.body;

  if (!gateway_order_id || !gateway_payment_id || !gateway_signature) {
    return res.status(400).json({ error: 'Missing payment signature verification parameters.' });
  }

  // Simulation mode fallback
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_secret || key_secret === 'your_razorpay_key_secret' || key_secret === 'your_key_secret' || gateway_payment_id.startsWith('sim_')) {
    console.log('[Payment Middleware] Simulation mode: Skipping signature verification.');
    req.paymentVerified = true;
    return next();
  }

  try {
    const generatedSignature = crypto
      .createHmac('sha256', key_secret)
      .update(`${gateway_order_id}|${gateway_payment_id}`)
      .digest('hex');

    if (generatedSignature !== gateway_signature) {
      return res.status(400).json({ error: 'Invalid payment signature. Verification failed.' });
    }

    req.paymentVerified = true;
    next();
  } catch (error) {
    console.error('[Payment Middleware] Signature verification error:', error.message);
    res.status(500).json({ error: 'Failed to verify payment signature.' });
  }
};

module.exports = verifyPaymentSignature;

