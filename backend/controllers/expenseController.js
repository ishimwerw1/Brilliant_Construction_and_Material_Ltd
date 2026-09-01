const Expense = require('../models/Expense');
const ApiError = require('../utils/ApiError');
const { wrapAsync } = require('../middleware/errorHandler');
const { logAction, ACTIONS } = require('../services/auditService');

exports.list = wrapAsync(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const filter = {};
  if (req.query.search?.trim()) {
    const s = new RegExp(req.query.search.trim(), 'i');
    filter.$or = [{ title: s }, { description: s }];
  }
  if (req.query.category && req.query.category !== 'ALL') filter.category = req.query.category;
  if (req.query.paymentMethod && req.query.paymentMethod !== 'ALL') filter.paymentMethod = req.query.paymentMethod;
  if (req.query.user) filter.createdBy = req.query.user;
  if (req.query.from || req.query.to) {
    filter.date = {};
    if (req.query.from) filter.date.$gte = new Date(req.query.from);
    if (req.query.to) filter.date.$lte = new Date(`${req.query.to}T23:59:59.999Z`);
  }

  const [expenses, total] = await Promise.all([
    Expense.find(filter).populate('createdBy', 'fullName')
      .sort({ date: -1 }).skip((page - 1) * limit).limit(limit),
    Expense.countDocuments(filter)
  ]);

  res.json({ success: true, data: { expenses, total, page, pages: Math.ceil(total / limit) } });
});

exports.getOne = wrapAsync(async (req, res) => {
  const expense = await Expense.findById(req.params.id).populate('createdBy', 'fullName');
  if (!expense) throw new ApiError(404, 'Expense not found.');
  res.json({ success: true, data: { expense } });
});

exports.create = wrapAsync(async (req, res) => {
  const { title, category, amount, paymentMethod, date, description } = req.body;
  if (!title?.trim()) throw new ApiError(400, 'Title is required.');
  if (!category) throw new ApiError(400, 'Category is required.');
  if (!amount || amount <= 0) throw new ApiError(400, 'Amount must be greater than 0.');
  if (!paymentMethod) throw new ApiError(400, 'Payment method is required.');

  const expense = await Expense.create({
    title: title.trim(),
    category,
    amount,
    paymentMethod,
    date: date || Date.now(),
    description: description?.trim() || '',
    createdBy: req.user._id
  });

  await logAction({
    user: req.user,
    action: ACTIONS.EXPENSE_CREATE,
    entity: 'Expense',
    entityId: expense._id,
    description: `Expense created: ${expense.title} - RWF ${expense.amount}`
  });

  const populated = await Expense.findById(expense._id).populate('createdBy', 'fullName');
  res.status(201).json({ success: true, message: 'Expense created successfully.', data: { expense: populated } });
});

exports.update = wrapAsync(async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) throw new ApiError(404, 'Expense not found.');

  const { title, category, amount, paymentMethod, date, description } = req.body;
  if (title !== undefined) expense.title = title.trim();
  if (category !== undefined) expense.category = category;
  if (amount !== undefined) expense.amount = amount;
  if (paymentMethod !== undefined) expense.paymentMethod = paymentMethod;
  if (date !== undefined) expense.date = date;
  if (description !== undefined) expense.description = description?.trim() || '';

  await expense.save();

  await logAction({
    user: req.user,
    action: ACTIONS.EXPENSE_UPDATE,
    entity: 'Expense',
    entityId: expense._id,
    description: `Expense updated: ${expense.title} - RWF ${expense.amount}`
  });

  const populated = await Expense.findById(expense._id).populate('createdBy', 'fullName');
  res.json({ success: true, message: 'Expense updated successfully.', data: { expense: populated } });
});

exports.remove = wrapAsync(async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) throw new ApiError(404, 'Expense not found.');

  await logAction({
    user: req.user,
    action: ACTIONS.EXPENSE_DELETE,
    entity: 'Expense',
    entityId: expense._id,
    description: `Expense deleted: ${expense.title} - RWF ${expense.amount}`
  });

  await expense.deleteOne();
  res.json({ success: true, message: 'Expense deleted successfully.' });
});

exports.summary = wrapAsync(async (req, res) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todayTotal, weekTotal, monthTotal, byCategory, byUser] = await Promise.all([
    Expense.aggregate([
      { $match: { date: { $gte: startOfToday } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    Expense.aggregate([
      { $match: { date: { $gte: startOfWeek } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    Expense.aggregate([
      { $match: { date: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    Expense.aggregate([
      { $match: { date: { $gte: startOfMonth } } },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } }
    ]),
    Expense.aggregate([
      { $match: { date: { $gte: startOfMonth } } },
      { $group: { _id: '$createdBy', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { _id: 1, total: 1, count: 1, name: '$user.fullName' } },
      { $sort: { total: -1 } }
    ])
  ]);

  res.json({
    success: true,
    data: {
      today: todayTotal[0]?.total || 0,
      thisWeek: weekTotal[0]?.total || 0,
      thisMonth: monthTotal[0]?.total || 0,
      byCategory,
      byUser
    }
  });
});
