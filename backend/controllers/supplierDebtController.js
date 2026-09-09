const Purchase = require('../models/Purchase');
const SupplierPayment = require('../models/SupplierPayment');
const OnDemand = require('../models/OnDemand');
const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const { wrapAsync } = require('../middleware/errorHandler');
const { logAction, ACTIONS } = require('../services/auditService');
const { nextSequence } = require('../utils/generateCode');

const round2 = (n) => Math.round(n * 100) / 100;

const computeDebtStatus = (total, paid) => {
  if (paid <= 0) return 'UNPAID';
  if (paid >= total - 0.001) return 'PAID';
  return 'PARTIALLY_PAID';
};

/** When a supplier payment is recorded against a purchase that came from an On-Demand sale,
 *  keep the On-Demand transaction's per-supplier balance in sync. */
const linkPaymentToOnDemand = async ({ onDemandId, purchaseId, amount, paymentNumber, method, reference, receivedBy }) => {
  if (!onDemandId) return;
  const onDemand = await OnDemand.findById(onDemandId);
  if (!onDemand) return;

  const entry = onDemand.supplierDetails && onDemand.supplierDetails.length
    ? onDemand.supplierDetails.find((d) => d.purchase && String(d.purchase) === String(purchaseId))
    : null;

  if (entry) {
    entry.amountPaid = round2((entry.amountPaid || 0) + amount);
    entry.balance = Math.max(0, round2(entry.totalCost - entry.amountPaid));
    entry.paymentStatus = computeDebtStatus(entry.totalCost, entry.amountPaid);
    entry.payments.push({
      paymentNumber,
      amount,
      method,
      reference: reference || '',
      receivedBy,
      receivedAt: new Date()
    });
    onDemand.supplierPaid = round2(onDemand.supplierDetails.reduce((s, d) => s + (d.amountPaid || 0), 0));
    onDemand.supplierBalance = round2(onDemand.supplierDetails.reduce((s, d) => s + (d.balance || 0), 0));
    onDemand.supplierPaymentStatus = computeDebtStatus(onDemand.supplierPaid + onDemand.supplierBalance, onDemand.supplierPaid);
  } else if (!onDemand.supplierDetails || onDemand.supplierDetails.length === 0) {
    // Legacy single-supplier on-demand record.
    onDemand.supplierPaid = round2((onDemand.supplierPaid || 0) + amount);
    onDemand.supplierBalance = Math.max(0, round2((onDemand.supplierCost || 0) - onDemand.supplierPaid));
    onDemand.supplierPaymentStatus = computeDebtStatus(onDemand.supplierCost, onDemand.supplierPaid);
  } else {
    return;
  }

  if ((onDemand.balance || 0) <= 0.001 && (onDemand.supplierBalance || 0) <= 0.001) {
    onDemand.status = 'COMPLETED';
  }
  await onDemand.save();
};

exports.listDebts = wrapAsync(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const filter = { paymentStatus: { $in: ['UNPAID', 'PARTIALLY_PAID'] } };
  if (req.query.search?.trim()) {
    const s = new RegExp(req.query.search.trim(), 'i');
    filter.$or = [{ purchaseNumber: s }, { supplierName: s }, { onDemandNumber: s }];
  }
  if (req.query.supplier) filter.supplier = req.query.supplier;

  const [purchases, total] = await Promise.all([
    Purchase.find(filter).populate('supplier', 'name phone')
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Purchase.countDocuments(filter)
  ]);

  res.json({ success: true, data: { debts: purchases, total, page, pages: Math.ceil(total / limit) } });
});

exports.getDebt = wrapAsync(async (req, res) => {
  const purchase = await Purchase.findById(req.params.id)
    .populate('supplier', 'name phone email')
    .populate('items.product', 'name sku')
    .populate('createdBy', 'fullName');
  if (!purchase) throw new ApiError(404, 'Purchase not found.');

  const payments = await SupplierPayment.find({ purchase: purchase._id })
    .populate('createdBy', 'fullName')
    .sort({ createdAt: -1 });

  res.json({ success: true, data: { purchase, payments } });
});

exports.recordPayment = wrapAsync(async (req, res) => {
  const { purchaseId, amount, paymentMethod, reference, notes } = req.body;
  if (!purchaseId) throw new ApiError(400, 'Purchase ID is required.');
  if (!amount || amount <= 0) throw new ApiError(400, 'Payment amount must be greater than 0.');
  if (!paymentMethod) throw new ApiError(400, 'Payment method is required.');

  const purchase = await Purchase.findById(purchaseId);
  if (!purchase) throw new ApiError(404, 'Purchase not found.');
  if (purchase.paymentStatus === 'PAID') throw new ApiError(400, 'This purchase is already fully paid.');

  const paymentNumber = await nextSequence('supplierPayment', 'SP');

  const payment = await SupplierPayment.create({
    paymentNumber,
    purchase: purchase._id,
    supplier: purchase.supplier,
    amount,
    paymentMethod,
    reference: reference?.trim() || '',
    notes: notes?.trim() || '',
    createdBy: req.user._id
  });

  purchase.amountPaid += amount;
  if (purchase.amountPaid >= purchase.totalAmount) {
    purchase.paymentStatus = 'PAID';
    purchase.remainingAmount = 0;
  } else {
    purchase.paymentStatus = 'PARTIALLY_PAID';
    purchase.remainingAmount = purchase.totalAmount - purchase.amountPaid;
  }
  await purchase.save();

  // Keep the linked On-Demand sale's supplier balance in sync (auto-link).
  await linkPaymentToOnDemand({
    onDemandId: purchase.onDemand,
    purchaseId: purchase._id,
    amount,
    paymentNumber,
    method: paymentMethod,
    reference: reference?.trim(),
    receivedBy: req.user._id
  });

  await logAction({
    user: req.user,
    action: ACTIONS.SUPPLIER_PAYMENT,
    entity: 'SupplierPayment',
    entityId: payment._id,
    description: `Supplier payment recorded: ${paymentNumber} - RWF ${amount} for ${purchase.purchaseNumber}`
  });

  const populated = await SupplierPayment.findById(payment._id).populate('createdBy', 'fullName');
  res.status(201).json({ success: true, message: `Payment ${paymentNumber} recorded successfully.`, data: { payment: populated, purchase } });
});

exports.removePayment = wrapAsync(async (req, res) => {
  const payment = await SupplierPayment.findById(req.params.id);
  if (!payment) throw new ApiError(404, 'Supplier payment not found.');

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const purchase = payment.purchase
        ? await Purchase.findById(payment.purchase).session(session)
        : null;

      if (purchase) {
        purchase.amountPaid = round2(Math.max(0, (purchase.amountPaid || 0) - payment.amount));
        purchase.remainingAmount = round2(Math.max(0, purchase.totalAmount - purchase.amountPaid));
        purchase.paymentStatus = computeDebtStatus(purchase.totalAmount, purchase.amountPaid);
        await purchase.save({ session });

        // Keep the linked On-Demand transaction's per-supplier balance in sync (reverse direction).
        if (purchase.onDemand) {
          const onDemand = await OnDemand.findById(purchase.onDemand).session(session);
          if (onDemand) {
            const entry = onDemand.supplierDetails && onDemand.supplierDetails.length
              ? onDemand.supplierDetails.find((d) => d.purchase && String(d.purchase) === String(purchase._id))
              : null;
            if (entry) {
              entry.amountPaid = round2(Math.max(0, (entry.amountPaid || 0) - payment.amount));
              entry.balance = round2(Math.max(0, entry.totalCost - entry.amountPaid));
              entry.paymentStatus = computeDebtStatus(entry.totalCost, entry.amountPaid);
              entry.payments = (entry.payments || []).filter((p) => p.paymentNumber !== payment.paymentNumber);
              onDemand.supplierPaid = round2(onDemand.supplierDetails.reduce((s, d) => s + (d.amountPaid || 0), 0));
              onDemand.supplierBalance = round2(onDemand.supplierDetails.reduce((s, d) => s + (d.balance || 0), 0));
              onDemand.supplierPaymentStatus = computeDebtStatus(onDemand.supplierPaid + onDemand.supplierBalance, onDemand.supplierPaid);
            } else if (!onDemand.supplierDetails || onDemand.supplierDetails.length === 0) {
              onDemand.supplierPaid = round2(Math.max(0, (onDemand.supplierPaid || 0) - payment.amount));
              onDemand.supplierBalance = round2(Math.max(0, (onDemand.supplierCost || 0) - onDemand.supplierPaid));
              onDemand.supplierPaymentStatus = computeDebtStatus(onDemand.supplierCost, onDemand.supplierPaid);
            }
            if ((onDemand.balance || 0) > 0.001 || (onDemand.supplierBalance || 0) > 0.001) {
              if (onDemand.status !== 'CANCELLED') onDemand.status = 'ACTIVE';
            } else if ((onDemand.balance || 0) <= 0.001 && (onDemand.supplierBalance || 0) <= 0.001) {
              if (onDemand.status !== 'CANCELLED') onDemand.status = 'COMPLETED';
            }
            await onDemand.save({ session });
          }
        }
      }

      await payment.deleteOne({ session });
      await logAction({
        user: req.user,
        action: ACTIONS.SUPPLIER_PAYMENT_DELETE,
        entity: 'SupplierPayment',
        entityId: payment._id,
        description: `Deleted supplier payment ${payment.paymentNumber} (RWF ${payment.amount}) and reversed the purchase/on-demand balances.`
      });
    });
  } finally {
    session.endSession();
  }

  res.json({ success: true, message: `Supplier payment ${payment.paymentNumber} deleted permanently and balances reversed.` });
});

exports.summary = wrapAsync(async (req, res) => {
  const [debtSummary, overdueCount] = await Promise.all([
    Purchase.aggregate([
      { $match: { paymentStatus: { $in: ['UNPAID', 'PARTIALLY_PAID'] } } },
      { $group: { _id: null, totalDebt: { $sum: '$totalAmount' }, totalPaid: { $sum: '$amountPaid' }, totalRemaining: { $sum: '$remainingAmount' }, count: { $sum: 1 } } }
    ]),
    Purchase.countDocuments({ paymentStatus: { $in: ['UNPAID', 'PARTIALLY_PAID'] }, dueDate: { $lt: new Date() } })
  ]);

  const allPurchases = await Purchase.aggregate([
    { $group: { _id: null, totalAll: { $sum: '$totalAmount' }, totalPaidAll: { $sum: '$amountPaid' } } }
  ]);

  res.json({
    success: true,
    data: {
      totalDebt: debtSummary[0]?.totalDebt || 0,
      totalPaid: debtSummary[0]?.totalPaid || 0,
      totalRemaining: debtSummary[0]?.totalRemaining || 0,
      outstandingCount: debtSummary[0]?.count || 0,
      overdueCount,
      totalPurchases: allPurchases[0]?.totalAll || 0,
      totalAllPaid: allPurchases[0]?.totalPaidAll || 0
    }
  });
});
