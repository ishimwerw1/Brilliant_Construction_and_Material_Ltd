const Purchase = require('../models/Purchase');
const SupplierPayment = require('../models/SupplierPayment');
const ApiError = require('../utils/ApiError');
const { wrapAsync } = require('../middleware/errorHandler');
const { logAction, ACTIONS } = require('../services/auditService');
const { nextSequence } = require('../utils/generateCode');

exports.listDebts = wrapAsync(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const filter = { paymentStatus: { $in: ['UNPAID', 'PARTIALLY_PAID'] } };
  if (req.query.search?.trim()) {
    const s = new RegExp(req.query.search.trim(), 'i');
    filter.$or = [{ purchaseNumber: s }, { supplierName: s }];
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
