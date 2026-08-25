const Sale = require('../models/Sale');
const Setting = require('../models/Setting');
const { createSale, cancelSale } = require('../services/saleService');
const ApiError = require('../utils/ApiError');
const { wrapAsync } = require('../middleware/errorHandler');

exports.list = wrapAsync(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const filter = {};
  if (req.query.search?.trim()) {
    const s = new RegExp(req.query.search.trim(), 'i');
    filter.$or = [{ saleNumber: s }, { customerName: s }];
  }
  if (req.query.customer) filter.customer = req.query.customer;
  if (req.query.cashier) filter.cashier = req.query.cashier;
  if (req.query.paymentMethod && req.query.paymentMethod !== 'ALL') filter.paymentMethod = req.query.paymentMethod;
  if (req.query.paymentStatus && req.query.paymentStatus !== 'ALL') filter.paymentStatus = req.query.paymentStatus;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(`${req.query.to}T23:59:59.999Z`);
  }

  const [sales, total] = await Promise.all([
    Sale.find(filter).populate('customer', 'name phone').populate('cashier', 'fullName')
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Sale.countDocuments(filter)
  ]);

  res.json({ success: true, data: { sales, total, page, pages: Math.ceil(total / limit) } });
});

exports.getOne = wrapAsync(async (req, res) => {
  const sale = await Sale.findById(req.params.id)
    .populate('customer', 'name phone email address')
    .populate('cashier', 'fullName username');
  if (!sale) throw new ApiError(404, 'Sale not found.');
  const settings = await Setting.getSettings();
  res.json({ success: true, data: { sale, company: settings } });
});

exports.create = wrapAsync(async (req, res) => {
  const sale = await createSale({ payload: req.body, user: req.user });
  const populated = await Sale.findById(sale._id).populate('customer', 'name phone').populate('cashier', 'fullName');
  res.status(201).json({ success: true, message: `Sale ${sale.saleNumber} completed successfully`, data: { sale: populated } });
});

exports.cancel = wrapAsync(async (req, res) => {
  const { reason } = req.body;
  if (!reason?.trim()) throw new ApiError(400, 'A cancellation reason is required.');
  const sale = await cancelSale({ saleId: req.params.id, reason: reason.trim(), user: req.user });
  res.json({ success: true, message: `Sale ${sale.saleNumber} cancelled and stock restored`, data: { sale } });
});
