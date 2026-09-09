const OnDemand = require('../models/OnDemand');
const ApiError = require('../utils/ApiError');
const { createOnDemand, recordOnDemandPayment, cancelOnDemand } = require('../services/onDemandService');
const { wrapAsync } = require('../middleware/errorHandler');

exports.list = wrapAsync(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const filter = {};
  if (req.query.search?.trim()) {
    const s = new RegExp(req.query.search.trim(), 'i');
    filter.$or = [{ transactionNumber: s }, { customerName: s }, { supplierName: s }];
  }
  if (req.query.customer) filter.customer = req.query.customer;
  if (req.query.supplier) filter.supplier = req.query.supplier;
  if (req.query.status && req.query.status !== 'ALL') filter.status = req.query.status;
  if (req.query.paymentStatus && req.query.paymentStatus !== 'ALL') filter.paymentStatus = req.query.paymentStatus;
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(`${req.query.to}T23:59:59.999Z`);
  }

  const [transactions, total] = await Promise.all([
    OnDemand.find(filter).populate('customer', 'name phone').populate('supplier', 'name phone')
      .populate('supplierDetails.supplier', 'name phone')
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    OnDemand.countDocuments(filter)
  ]);

  const [stats] = await OnDemand.aggregate([
    { $match: {} },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        revenue: { $sum: '$totalAmount' },
        cost: { $sum: '$totalCost' },
        profit: { $sum: '$totalProfit' },
        outstanding: { $sum: '$balance' },
        supplierBalance: { $sum: '$supplierBalance' }
      }
    }
  ]);

  res.json({
    success: true,
    data: {
      transactions,
      stats: stats || { total: 0, revenue: 0, cost: 0, profit: 0, outstanding: 0, supplierBalance: 0 },
      total, page, pages: Math.ceil(total / limit)
    }
  });
});

exports.getOne = wrapAsync(async (req, res) => {
  const transaction = await OnDemand.findById(req.params.id)
    .populate('customer', 'name phone email address')
    .populate('supplier', 'name phone companyName address')
    .populate('supplierDetails.supplier', 'name phone companyName address')
    .populate('createdBy', 'fullName')
    .populate('sale');
  if (!transaction) throw new ApiError(404, 'On-Demand transaction not found.');
  const Payment = require('../models/Payment');
  const SupplierPayment = require('../models/SupplierPayment');
  const purchaseIds = (transaction.supplierDetails || [])
    .map((d) => d.purchase)
    .filter(Boolean);
  if (transaction.purchase && !purchaseIds.some((p) => String(p) === String(transaction.purchase))) {
    purchaseIds.push(transaction.purchase);
  }
  const [payments, supplierPayments] = await Promise.all([
    Payment.find({ onDemand: transaction._id }).sort({ createdAt: -1 }).populate('receivedBy', 'fullName'),
    SupplierPayment.find({ purchase: { $in: purchaseIds } }).sort({ createdAt: -1 }).populate('createdBy', 'fullName')
  ]);
  res.json({ success: true, data: { transaction, payments, supplierPayments } });
});

exports.create = wrapAsync(async (req, res) => {
  const result = await createOnDemand({ payload: req.body, user: req.user });
  res.status(201).json({
    success: true,
    message: `On-Demand sale ${result.onDemand.transactionNumber} recorded successfully. Profit: ${result.onDemand.totalProfit.toLocaleString()} RWF.`,
    data: result
  });
});

exports.recordPayment = wrapAsync(async (req, res) => {
  const { side = 'customer', amount, method = 'CASH', reference, notes, supplierId } = req.body;
  if (!amount) throw new ApiError(400, 'Payment amount is required.');
  const result = await recordOnDemandPayment({
    onDemandId: req.params.id,
    side,
    amount,
    method,
    reference,
    notes,
    supplierId,
    user: req.user
  });
  res.status(201).json({ success: true, message: 'Payment recorded.', data: result });
});

exports.cancel = wrapAsync(async (req, res) => {
  const { reason } = req.body;
  if (!reason?.trim()) throw new ApiError(400, 'A cancellation reason is required.');
  const transaction = await cancelOnDemand({ onDemandId: req.params.id, reason: reason.trim(), user: req.user });
  res.json({ success: true, message: `On-Demand transaction ${transaction.transactionNumber} cancelled.`, data: { transaction } });
});