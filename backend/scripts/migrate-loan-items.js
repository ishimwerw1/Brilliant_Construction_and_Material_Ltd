/**
 * One-time migration: backfills per-item financial fields on existing loans
 * so every loan product can be independently managed and paid.
 *
 * For each loan item it sets:
 *   - product             (matched by productName where possible)
 *   - totalAmount         (quantity * unitPrice)
 *   - amountPaid          (loan's repaid money distributed proportionally by item value)
 *   - outstandingBalance  (totalAmount - allocated amountPaid)
 *   - status              (ACTIVE / PARTIALLY_PAID / PAID)
 *   - createdAt / updatedAt
 *
 * Existing loan-level financials (totalAmount / amountPaid / outstandingBalance / status)
 * are preserved exactly by construction (the proportional split sums back to the loan total).
 *
 * Usage:  node scripts/migrate-loan-items.js
 * Safe to run multiple times; loans that are already migrated are skipped.
 */
require('dotenv').config();

const mongoose = require('mongoose');
const Loan = require('../models/Loan');
const Product = require('../models/Product');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const isMigrated = (loan) =>
  Array.isArray(loan.items) &&
  loan.items.length > 0 &&
  loan.items.every(
    (it) =>
      Number(it.totalAmount) > 0 &&
      ['ACTIVE', 'PARTIALLY_PAID', 'PAID', 'REMOVED'].includes(it.status)
  );

const buildItemFinancials = (item, loan) => {
  const qty = Number(item.quantity) || 1;
  const unitPrice = Number(item.unitPrice) || 0;
  const total = round2(qty * unitPrice);
  const itemTotalAmount = Number(item.totalAmount) > 0 ? Number(item.totalAmount) : total;
  return { qty, unitPrice, total, itemTotalAmount };
};

const main = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set. Add it to backend/.env first.');
    process.exit(1);
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  console.log(`Connected: ${mongoose.connection.host}`);

  const allLoans = await Loan.find({});
  let updated = 0;
  let skipped = 0;

  for (const loan of allLoans) {
    if (isMigrated(loan)) {
      skipped++;
      continue;
    }
    if (!Array.isArray(loan.items) || loan.items.length === 0) {
      // No items to migrate, but ensure loan-level amounts stay sensible.
      skipped++;
      continue;
    }

    const loanPaid = Number(loan.amountPaid) || 0;
    const itemsCount = loan.items.length;

    // Build financials per item (legacy fallback: qty * unitPrice).
    const fin = loan.items.map((it) => ({
      item: it,
      total: Number(it.totalAmount) > 0 ? Number(it.totalAmount) : round2((Number(it.quantity) || 1) * (Number(it.unitPrice) || 0))
    }));
    const totalValue = fin.reduce((s, f) => s + f.total, 0);

    // Distribute the existing repaid amount proportionally to item value,
    // preserving the loan-level outstanding balance exactly.
    let remainingToAllocate = loanPaid;
    fin.forEach((f, i) => {
      const share = totalValue > 0 ? (f.total / totalValue) * loanPaid : 0;
      const allocated = i === fin.length - 1 ? remainingToAllocate : Math.min(remainingToAllocate, round2(share));
      const paid = Math.max(0, Math.min(round2(allocated), f.total));
      remainingToAllocate = round2(remainingToAllocate - paid);

      const item = f.item;
      item.product = item.product || undefined;
      item.totalAmount = f.total;
      item.amountPaid = paid;
      item.outstandingBalance = round2(Math.max(0, f.total - paid));
      item.status = paid >= f.total - 0.001 ? 'PAID' : paid > 0 ? 'PARTIALLY_PAID' : 'ACTIVE';
      item.removedAt = item.removedAt || undefined;
      item.removeReason = item.removeReason || undefined;
      item.createdAt = item.createdAt || loan.createdAt || new Date();
      item.updatedAt = new Date();
    });

    // Resolve product ObjectIds by name (best effort; null is allowed for unknown products).
    const names = [...new Set(loan.items.map((it) => it.productName).filter(Boolean))];
    if (names.length > 0) {
      const products = await Product.find({ name: { $in: names } }).select('_id name');
      const byName = new Map(products.map((p) => [p.name, p._id]));
      for (const it of loan.items) {
        if (!it.product && byName.has(it.productName)) it.product = byName.get(it.productName);
      }
    }

    // Preserve ORIGINAL loan totals exactly; only recompute statuses to match repayment level.
    if (loan.outstandingBalance <= 0.001) loan.status = 'PAID';
    else if (loan.amountPaid > 0) loan.status = 'PARTIALLY_PAID';
    else if (loan.status !== 'CANCELLED') loan.status = 'ACTIVE';

    await loan.save();
    updated++;
    console.log(`Migrated ${loan.loanNumber}: ${itemsCount} item(s), paid ${loanPaid}, outstanding ${loan.outstandingBalance}, status ${loan.status}`);
  }

  console.log(`\nDone. ${updated} loan(s) migrated, ${skipped} skipped (already migrated / empty).`);
  await mongoose.disconnect();
};

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});