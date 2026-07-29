const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const listingRoutes = require('./routes/listingRoutes');
const profileRoutes = require('./src/routes/profileRoutes');
const rentalRoutes = require('./routes/rentalRoutes');
const paymentRoutes = require('./routes/payment.routes');
const cartRoutes = require('./routes/cartRoutes');
const pricingRoutes = require('./routes/pricingRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/', authRoutes); // Auth routes (signup, login, profile, logout)
app.use('/listings', listingRoutes); // Listing CRUD routes
app.use('/api/profile', profileRoutes); // Profile API routes
app.use('/api/rentals', rentalRoutes); // Rental booking & status routes
app.use('/api/payment', paymentRoutes); // Payment & refund routes
app.use('/api/cart', cartRoutes); // Shopping cart routes
app.use('/api/pricing', pricingRoutes); // Dynamic pricing engine routes
app.use('/api/wishlist', wishlistRoutes); // Wishlist / Saved items routes

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
