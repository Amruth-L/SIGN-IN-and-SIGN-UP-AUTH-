const cors = require('cors');
const pool = require('./config/database');
const express = require('express');
const authRoutes = require('./modules/auth/auth.routes');
const activityRoutes = require('./modules/activity/activity.routes');
const campusRoutes = require('./modules/campus/campus.routes');
const cartRoutes = require('./modules/cart/cart.routes');
const courierRoutes = require('./modules/delivery/courier.routes');
const deliveryRoutes = require('./modules/delivery/delivery.routes');
const listingRoutes = require('./modules/listings/listings.routes');
const paymentRoutes = require('./modules/payments/payment.routes');
const pricingRoutes = require('./modules/payments/pricing.routes');
const profileRoutes = require('./modules/profile/profile.routes');
const rentalRoutes = require('./modules/rentals/rentals.routes');
const wishlistRoutes = require('./modules/saved/saved.routes');
const xeroxRoutes = require('./modules/xerox/xerox.routes');

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: process.env.FRONTEND_ORIGIN?.split(',') || true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, database: true, serverTime: new Date().toISOString() });
  } catch {
    res.status(503).json({
      ok: false,
      database: false,
      serverTime: new Date().toISOString(),
      error: 'Database unavailable.',
    });
  }
});
app.use('/', authRoutes);
app.use('/listings', listingRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/rentals', rentalRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/campus', campusRoutes);
app.use('/api/courier', courierRoutes);
app.use('/api/xerox', xeroxRoutes);
app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));
app.use((error, req, res, next) => {
  void next;
  console.error('[request]', error);
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'The upload is too large.' });
  return res.status(error.status || 500).json({ error: error.message || 'Internal Server Error' });
});
module.exports = app;
