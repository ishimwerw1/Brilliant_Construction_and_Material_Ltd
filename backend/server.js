const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { connectDB } = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL?.split(',') || true, credentials: true }));
app.use(express.json({ limit: '3mb' }));

// API routes
app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'API is running', database: dbReady ? 'connected' : 'connecting' });
});
app.use('/api', apiLimiter);
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/roles', require('./routes/roleRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/suppliers', require('./routes/supplierRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/stock', require('./routes/stockRoutes'));
app.use('/api/sales', require('./routes/saleRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/loans', require('./routes/loanRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/audit-logs', require('./routes/auditLogRoutes'));
app.use('/api/settings', require('./routes/settingRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/backups', require('./routes/backupRoutes'));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Start the API even if the database is temporarily unreachable, and keep
// retrying in the background so the app recovers on its own (e.g. after an
// IP is whitelisted in Atlas or internet comes back) without a restart.
const RETRY_MS = 10_000;
let dbReady = false;

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
