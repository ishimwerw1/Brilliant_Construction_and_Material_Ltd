/**
 * Reset business data — keeps ONLY system essentials.
 *
 * Deletes: all users except the main admin, products, suppliers, customers,
 *          sales, payments, loans, orders, stock transactions, notifications,
 *          audit logs, and number sequences (counters).
 * Keeps:   roles, company settings, main admin account, categories.
 *
 * Run:  node --env-file=.env reset-business-data.js
 */
const mongoose = require('mongoose');

const KEEP_ADMIN_USERNAME = 'admin';

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  console.log('Connected. Cleaning...\n');

  const results = {};

  // Users: keep only the primary admin account
  const usersCol = db.collection('users');
  const admins = await usersCol.find({ username: KEEP_ADMIN_USERNAME }).toArray();
  if (!admins.length) {
    console.error(`ABORT: no user found with username "${KEEP_ADMIN_USERNAME}". Nothing deleted.`);
    await mongoose.disconnect();
    process.exit(1);
  }
  const res = await usersCol.deleteMany({ username: { $ne: KEEP_ADMIN_USERNAME } });
  results['users (kept only admin)'] = res.deletedCount;

  // All business collections: full wipe
  for (const col of [
    'products', 'suppliers', 'customers', 'sales', 'payments', 'loans',
    'orders', 'stocktransactions', 'notifications', 'auditlogs'
  ]) {
    const r = await db.collection(col).deleteMany({});
    if (r.deletedCount) results[col] = r.deletedCount;
  }

  // Reset document numbering so invoices start again at INV-00001
  const c = await db.collection('counters').deleteMany({});
  results['counters (numbering reset)'] = c.deletedCount;

  console.log('Deleted:');
  for (const [k, v] of Object.entries(results)) console.log(`  - ${k}: ${v}`);

  console.log('\nKept:');
  console.log(`  - users: ${await usersCol.countDocuments()} (admin only)`);
  for (const col of ['roles', 'settings', 'categories']) {
    console.log(`  - ${col}: ${await db.collection(col).countDocuments()}`);
  }

  console.log('\nDone. The database now contains only system essentials — ready for real data.');
  await mongoose.disconnect();
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
