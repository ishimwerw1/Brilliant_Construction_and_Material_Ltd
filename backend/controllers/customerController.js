const Customer = require('../models/Customer');
const Sale = require('../models/Sale');
const Payment = require('../models/Payment');
const Loan = require('../models/Loan');
const ApiError = require('../utils/ApiError');
const { logAction, ACTIONS } = require('../services/auditService');
const { wrapAsync } = require('../middleware/errorHandler');

exports.list = wrapAsync(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const filter = {};
  if (req.query.search?.trim()) {
    const s = new RegExp(req.query.search.trim(), 'i');
    filter.$or = [{ name: s }, { phone: s }, { email: s }];
  }
  if (req.query.status) filter.status = req.query.status;
  if (req.query.withDebt === 'true') filter.outstandingBalance = { $gt: 0 };

  const [customers, total] = await Promise.all([
    Customer.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Customer.countDocuments(filter)
  ]);
  res.json({ success: true, data: { customers, total, page, pages: Math.ceil(total / limit) } });
});

exports.getOne = wrapAsync(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw new ApiError(404, 'Customer not found.');
  const [sales, payments, loans] = await Promise.all([
    Sale.find({ customer: customer._id }).sort({ createdAt: -1 }).limit(50),
    Payment.find({ customer: customer._id }).sort({ createdAt: -1 }).limit(50).populate('receivedBy', 'fullName'),
    Loan.find({ customer: customer._id }).sort({ createdAt: -1 }).limit(50)
  ]);
  res.json({ success: true, data: { customer, sales, payments, loans } });
});

exports.create = wrapAsync(async (req, res) => {
  const { name, phone } = req.body;
  if (!name?.trim() || !phone?.trim()) throw new ApiError(400, 'Customer name and phone are required.');
  if (!/^[0-9+\s-]{7,15}$/.test(phone.trim())) throw new ApiError(400, 'Invalid phone number format.');
  const existing = await Customer.findOne({ phone: phone.trim() });
  if (existing) throw new ApiError(409, `A customer with this phone already exists: "${existing.name}". Search by phone to reuse the record.`);
  const customer = await Customer.create({ ...req.body, phone: phone.trim(), name: name.trim() });
  await logAction({
    user: req.user, action: ACTIONS.CUSTOMER_CREATE, entity: 'Customer', entityId: customer._id,
    description: `Created customer "${customer.name}" (${customer.phone}).`
  });
  res.status(201).json({ success: true, message: 'Customer created', data: { customer } });
});

exports.update = wrapAsync(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw new ApiError(404, 'Customer not found.');
  ['name', 'phone', 'email', 'address', 'status'].forEach((f) => {
    if (req.body[f] !== undefined && req.body[f] !== '') customer[f] = req.body[f];
  });
  await customer.save();
  await logAction({
    user: req.user, action: ACTIONS.CUSTOMER_UPDATE, entity: 'Customer', entityId: customer._id,
    description: `Updated customer "${customer.name}".`
  });
  res.json({ success: true, message: 'Customer updated', data: { customer } });
});

exports.remove = wrapAsync(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw new ApiError(404, 'Customer not found.');
  const saleCount = await Sale.countDocuments({ customer: customer._id });
  if (saleCount > 0) throw new ApiError(400, `Cannot delete: this customer has ${saleCount} purchase record(s). Deactivate instead.`);
  await customer.deleteOne();
  await logAction({
    user: req.user, action: ACTIONS.CUSTOMER_DELETE, entity: 'Customer',
    description: `Deleted customer "${customer.name}".`
  });
  res.json({ success: true, message: 'Customer deleted' });
});
