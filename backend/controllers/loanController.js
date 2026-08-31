const Loan = require('../models/Loan');
const ApiError = require('../utils/ApiError');
const { repayLoan } = require('../services/saleService');
const { logAction, ACTIONS } = require('../services/auditService');
const { wrapAsync } = require('../middleware/errorHandler');

/** Lazily flags overdue loans whenever loans are listed/viewed. */
const flagOverdue = async () => {
  await Loan.updateMany(
    { dueDate: { $lt: new Date() }, status: { $in: ['ACTIVE', 'PARTIALLY_PAID'] } },
    { $set: { status: 'OVERDUE' } }
  );
};

exports.list = wrapAsync(async (req, res) => {
  await flagOverdue();

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const filter = {};
  if (req.query.search?.trim()) {
    const s = new RegExp(req.query.search.trim(), 'i');
    filter.$or = [{ customerName: s }, { customerPhone: s }, { loanNumber: s }, { saleNumber: s }];
  }
  if (req.query.status && req.query.status !== 'ALL') filter.status = req.query.status;
  if (req.query.customer) filter.customer = req.query.customer;
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(`${req.query.to}T23:59:59.999Z`);
  }

  const [loans, total] = await Promise.all([
    Loan.find(filter).populate('customer', 'name phone').sort({ createdAt: -1 })
      .skip((page - 1) * limit).limit(limit),
    Loan.countDocuments(filter)
  ]);

  const [stats] = await Loan.aggregate([
    {
      $group: {
        _id: null,
        totalLoans: { $sum: 1 },
        activeCount: { $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, 1, 0] } },
        partialCount: { $sum: { $cond: [{ $eq: ['$status', 'PARTIALLY_PAID'] }, 1, 0] } },
        paidCount: { $sum: { $cond: [{ $eq: ['$status', 'PAID'] }, 1, 0] } },
        overdueCount: { $sum: { $cond: [{ $eq: ['$status', 'OVERDUE'] }, 1, 0] } },
        totalCredit: { $sum: '$totalAmount' },
        totalRepaid: { $sum: '$amountPaid' },
        totalOutstanding: { $sum: '$outstandingBalance' },
        overdueAmount: { $sum: { $cond: [{ $eq: ['$status', 'OVERDUE'] }, '$outstandingBalance', 0] } }
      }
    }
  ]);

  res.json({
    success: true,
    data: {
      loans,
      total,
      page,
      pages: Math.ceil(total / limit),
      stats: stats || {
        totalLoans: 0, activeCount: 0, partialCount: 0, paidCount: 0, overdueCount: 0,
        totalCredit: 0, totalRepaid: 0, totalOutstanding: 0, overdueAmount: 0
      }
    }
  });
});

exports.getOne = wrapAsync(async (req, res) => {
  const loan = await Loan.findById(req.params.id).populate('sale').populate('customer', 'name phone email address');
  if (!loan) throw new ApiError(404, 'Loan not found.');
  const Payment = require('../models/Payment');
  const payments = await Payment.find({ loan: loan._id }).sort({ createdAt: -1 }).populate('receivedBy', 'fullName');
  res.json({ success: true, data: { loan, payments } });
});

exports.repay = wrapAsync(async (req, res) => {
  const { amount, method = 'CASH', reference, notes } = req.body;
  const allowed = ['CASH', 'MOMO', 'BANK'];
  if (!allowed.includes(method)) throw new ApiError(400, 'Repayment method must be CASH, MOMO or BANK.');


  const { loan, payment } = await repayLoan({ loanId: req.params.id, amount, method, reference, notes, user: req.user });
  res.status(201).json({
    success: true,
    message: `Repayment recorded (${payment.paymentNumber}). Remaining: ${loan.outstandingBalance.toLocaleString()} RWF`,
    data: { loan, payment }
  });
});

exports.cancel = wrapAsync(async (req, res) => {
  const { reason } = req.body;
  if (!reason?.trim()) throw new ApiError(400, 'A cancellation reason is required.');
  const loan = await Loan.findById(req.params.id);
  if (!loan) throw new ApiError(404, 'Loan not found.');
  if (['PAID', 'CANCELLED'].includes(loan.status)) throw new ApiError(400, `Loan is already ${loan.status.toLowerCase()}.`);
  if (loan.outstandingBalance > loan.totalAmount) throw new ApiError(400, 'Cannot cancel a loan that has been over-repaid.');

  // Only the unpaid portion is cancelled; history is preserved.
  const Customer = require('../models/Customer');
  const Sale = require('../models/Sale');
  const session = await Loan.startSession();
  try {
    await session.withTransaction(async () => {
      loan.status = 'CANCELLED';
      loan.cancelReason = reason.trim();
      await loan.save({ session });

      const customer = await Customer.findById(loan.customer).session(session);
      if (customer) {
        customer.outstandingBalance = Math.max(0, customer.outstandingBalance - loan.outstandingBalance);
        await customer.save({ session });
      }

      const sale = await Sale.findById(loan.sale).session(session);
      if (sale) {
        sale.notes = `${sale.notes ? sale.notes + '; ' : ''}Loan ${loan.loanNumber} cancelled (${reason.trim()}).`;
        await sale.save({ session });
      }

      await logAction({
        user: req.user, action: ACTIONS.LOAN_CANCEL, entity: 'Loan', entityId: loan._id,
        description: `Cancelled loan ${loan.loanNumber}. Reason: ${reason.trim()}`,
        details: { cancelledBalance: loan.outstandingBalance },
        session
      });
    });
  } finally {
    session.endSession();
  }

  res.json({ success: true, message: `Loan ${loan.loanNumber} cancelled`, data: { loan } });
});

exports.updateDueDate = wrapAsync(async (req, res) => {
  const { dueDate } = req.body;
  if (!dueDate) throw new ApiError(400, 'A new due date is required.');
  const date = new Date(dueDate);
  if (Number.isNaN(date.getTime())) throw new ApiError(400, 'Invalid due date.');
  const loan = await Loan.findById(req.params.id);
  if (!loan) throw new ApiError(404, 'Loan not found.');
  if (['PAID', 'CANCELLED'].includes(loan.status)) throw new ApiError(400, 'Closed loans cannot be edited.');
  const oldDate = loan.dueDate;
  loan.dueDate = date;
  if (loan.status === 'OVERDUE' && date > new Date()) loan.status = loan.amountPaid > 0 ? 'PARTIALLY_PAID' : 'ACTIVE';
  await loan.save();
  await logAction({
    user: req.user, action: ACTIONS.LOAN_UPDATE || 'LOAN_UPDATE', entity: 'Loan', entityId: loan._id,
    description: `Changed due date of ${loan.loanNumber}: ${oldDate?.toISOString().slice(0, 10)} -> ${date.toISOString().slice(0, 10)}.`
  });
  res.json({ success: true, message: 'Due date updated', data: { loan } });
});
