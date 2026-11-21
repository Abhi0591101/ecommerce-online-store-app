require('dotenv').config();
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const setupTrackingSocket = require('./sockets/trackingSocket');

// Register models used in populate() so refs resolve at runtime
require('./models/User');
require('./models/Category');
require('./models/Store');
require('./models/Product');
require('./models/StoreProductPricing');
require('./models/Order');
require('./models/Delivery');
require('./models/Service');
require('./models/ServiceArea');
require('./models/SupportRequest');
require('./models/SellerNotification');
require('./models/ProductReview');
require('./models/Franchise');
require('./models/Coupon');
require('./models/Banner');
require('./models/SiteSettings');
require('./models/Complaint');
require('./models/PlatformConfig');
require('./models/AdminNotification');
require('./models/WalletLedger');
require('./models/CustomerNotification');
require('./models/Wishlist');
require('./models/RiderRequest');
require('./models/RiderNotification');

const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const deliveryBoyRoutes = require('./routes/deliveryBoyRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const storeRoutes = require('./routes/storeRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const locationRoutes = require('./routes/locationRoutes');
const riderRoutes = require('./routes/riderRoutes');
const supportRoutes = require('./routes/supportRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const sellerRoutes = require('./routes/sellerRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { getSettings, listBanners } = require('./controllers/adminController');

const isProd = process.env.NODE_ENV === 'production';

// Don't crash the process if Mongo is briefly unavailable — keep serving API/static
connectDB().catch((err) => {
  console.error('MongoDB unavailable — API routes may fail until reconnected:', err.message);
});

const app = express();
const server = http.createServer(app);

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || (isProd ? true : 'http://localhost:5173');

const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    credentials: true
  }
});

app.set('io', io);
setupTrackingSocket(io);

app.use(cors({
  origin: CLIENT_ORIGIN,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'HyperLocal API is running',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/riders', riderRoutes);
app.use('/api/support-requests', supportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/seller', sellerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/delivery-boy', deliveryBoyRoutes);

// Public site content (no auth)
app.get('/api/public/settings', getSettings);
app.get('/api/public/banners', listBanners);

// Production: optionally serve the Vite React build from ../client/dist
const clientDist = path.join(__dirname, '../client/dist');
if (isProd && fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback for non-API routes (Express 5 safe)
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
  console.log(`Serving React build from ${clientDist}`);
}

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} (${process.env.NODE_ENV || 'development'})`);
});
