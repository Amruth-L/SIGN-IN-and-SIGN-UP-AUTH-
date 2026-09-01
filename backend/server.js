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
const deliveryRoutes = require('./routes/deliveryRoutes');
const campusRoutes = require('./routes/campusRoutes');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { ensureCampusSchema } = require('./services/campusService');
const realtime = require('./services/realtime');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3003;

// Middleware
app.use(cors());
// Listing images are sent as base64 data URLs from the create-listing form.
// The default Express JSON limit (100 KB) rejects normal image uploads before
// they can reach the listing controller.
app.use(express.json({ limit: '50mb' }));

// Routes
app.use('/', authRoutes); // Auth routes (signup, login, profile, logout)
app.use('/listings', listingRoutes); // Listing CRUD routes
app.use('/api/profile', profileRoutes); // Profile API routes
app.use('/api/rentals', rentalRoutes); // Rental booking & status routes
app.use('/api/payment', paymentRoutes); // Payment & refund routes
app.use('/api/cart', cartRoutes); // Shopping cart routes
app.use('/api/pricing', pricingRoutes); // Dynamic pricing engine routes
app.use('/api/wishlist', wishlistRoutes); // Wishlist / Saved items routes
app.use('/api/delivery', deliveryRoutes); // Delivery / Courier routes
app.use('/api/campus', campusRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'The uploaded images are too large. Please use smaller images or fewer images.'
    });
  }
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start Server
const io = new Server(server, { cors: { origin: '*' } });
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch { next(new Error('Unauthorized')); }
});
io.on('connection', socket => {
  socket.on('delivery:join', id => socket.join(`delivery:${id}`));
  socket.on('delivery:leave', id => socket.leave(`delivery:${id}`));
});
realtime.setIO(io);
ensureCampusSchema().catch(err => console.error('[Campus schema]', err.message));

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
