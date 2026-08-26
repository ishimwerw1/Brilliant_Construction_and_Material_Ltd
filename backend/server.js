const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { connectDB } = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

const app = express();

const allowedOrigins = (process.env.CLIENT_URL || '').split(',').filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '3mb' }));

// Health Check
app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'API is running', database: dbReady ? 'connected' : 'connecting' });
});

app.use('/api', apiLimiter);

// ==========================================
// DUAL ROUTE MOUNTING (Handles with/without /api)
// ==========================================

// Auth
app.use('/auth', require('./routes/authRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));

// Dashboard
app.use('/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));

// Notifications
app.use('/notifications', require('./routes/notificationRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

// Other API Routes (Dual mounted for safety)
app.use('/users', require('./routes/userRoutes'));
app.use('/api/users', require('./routes/userRoutes'));

app.use('/roles', require('./routes/roleRoutes'));
app.use('/api/roles', require('./routes/roleRoutes'));

app.use('/products', require('./routes/productRoutes'));
app.use('/api/products', require('./routes/productRoutes'));

app.use('/categories', require('./routes/categoryRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));

app.use('/suppliers', require('./routes/supplierRoutes'));
app.use('/api/suppliers', require('./routes/supplierRoutes'));

app.use('/customers', require('./routes/customerRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));

app.use('/stock', require('./routes/stockRoutes'));
app.use('/api/stock', require('./routes/stockRoutes'));

app.use('/sales', require('./routes/saleRoutes'));
app.use('/api/sales', require('./routes/saleRoutes'));

app.use('/orders', require('./routes/orderRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));

app.use('/payments', require('./routes/paymentRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));

app.use('/loans', require('./routes/loanRoutes'));
app.use('/api/loans', require('./routes/loanRoutes'));

app.use('/reports', require('./routes/reportRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));

app.use('/audit-logs', require('./routes/auditLogRoutes'));
app.use('/api/audit-logs', require('./routes/auditLogRoutes'));

app.use('/settings', require('./routes/settingRoutes'));
app.use('/api/settings', require('./routes/settingRoutes'));

app.use('/backups', require('./routes/backupRoutes'));
app.use('/api/backups', require('./routes/backupRoutes'));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

let dbReady = false;
const RETRY_MS = 10_000;

const tryConnect = async () => {
  try {
    await connectDB();
    dbReady = true;
  } catch (err) {
    dbReady = false;
    console.error(`Database unavailable (${(err.message || '').slice(0, 120)}). Retrying in ${RETRY_MS / 1000}s...`);
    setTimeout(tryConnect, RETRY_MS);
  }
};

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
tryConnect();