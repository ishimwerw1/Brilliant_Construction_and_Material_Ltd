const Payment = require('../models/Payment');
const ApiError = require('../utils/ApiError');
const { repayLoan } = require('../services/saleService');
const { wrapAsync } = require('../middleware/errorHandler');

exports.list = wrapAsync(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const filter = {};
  if (req.query.search?.trim()) {
    const s = new RegExp(req.query.search.trim(), 'i');
    filter.$or = [{ paymentNumber: s }, { customerName: s }, { reference: s }];
  }
  if (req.query.customer) filter.customer = req.query.customer;
  if (req.query.method && req.query.method !== 'ALL') filter.method = req.query.method;
  if (req.query.type && req.query.type !== 'ALL') filter.type = req.query.type;
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(`${req.query.to}T23:59:59.999Z`);
  }

  const [payments, total] = await Promise.all([
    Payment.find(filter).populate('customer', 'name phone').populate('receivedBy', 'fullName')
      .populate('loan', 'loanNumber').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Payment.countDocuments(filter)
  ]);

  const totals = await Payment.aggregate([
    { $match: filter },
    { $group: { _id: '$method', total: { $sum: '$amount' } } }
  ]);
  const byMethod = Object.fromEntries(totals.map((t) => [t._id, t.total]));

  res.json({ success: true, data: { payments, total, page, pages: Math.ceil(total / limit), byMethod } });
});

/** Standalone loan repayment (also used from the loans module). */
exports.repayLoan = wrapAsync(async (req, res) => {
  const { loanId, amount, method = 'CASH', reference, notes } = req.body;
  if (!loanId) throw new ApiError(400, 'Loan is required.');
  const allowed = ['CASH', 'MOMO', 'BANK'];
  if (!allowed.includes(method)) throw new ApiError(400, 'Repayment method must be CASH, MOMO or BANK.');
  if ((method === 'MOMO' || method === 'BANK') && !reference) {
    throw new ApiError(400, `A transaction/reference number is required for ${method} payments.`);
  }

  const { loan, payment } = await repayLoan({ loanId, amount, method, reference, notes, user: req.user });
  res.status(201).json({
    success: true,
    message: `Repayment recorded (${payment.paymentNumber}). Remaining balance: ${loan.outstandingBalance.toLocaleString()} RWF`,
    data: { loan, payment }
  });
});
