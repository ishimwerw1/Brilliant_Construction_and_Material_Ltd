const Order = require('../models/Order');
const ApiError = require('../utils/ApiError');
const { createOrder, payOrder, cancelOrder } = require('../services/orderService');
const { wrapAsync } = require('../middleware/errorHandler');

exports.list = wrapAsync(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const filter = {};
  if (req.query.status && req.query.status !== 'ALL') filter.status = req.query.status;
  if (req.query.customer) filter.customer = req.query.customer;
  if (req.query.search?.trim()) {
    const s = new RegExp(req.query.search.trim(), 'i');
    filter.$or = [{ orderNumber: s }, { customerName: s }];
  }
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(`${req.query.to}T23:59:59.999Z`);
  }

  const [orders, total] = await Promise.all([
    Order.find(filter).populate('customer', 'name phone').populate('createdBy', 'fullName')
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Order.countDocuments(filter)
  ]);

  const [stats] = await Order.aggregate([
    { $match: {} },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] } },
        confirmed: { $sum: { $cond: [{ $eq: ['$status', 'CONFIRMED'] }, 1, 0] } },
        partiallyPaid: { $sum: { $cond: [{ $eq: ['$status', 'PARTIALLY_PAID'] }, 1, 0] } },
        paid: { $sum: { $cond: [{ $eq: ['$status', 'PAID'] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] } },
        value: { $sum: '$total' },
        outstanding: { $sum: '$balance' }
      }
    }
  ]);

  res.json({
    success: true,
    data: {
      orders,
      stats: stats || { total: 0, pending: 0, confirmed: 0, partiallyPaid: 0, paid: 0, completed: 0, cancelled: 0, value: 0, outstanding: 0 },
      total, page, pages: Math.ceil(total / limit)
    }
  });
});

exports.getOne = wrapAsync(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('customer', 'name phone email address')
    .populate('createdBy', 'fullName')
    .populate('sale', 'saleNumber');
  if (!order) throw new ApiError(404, 'Order not found.');
  const Payment = require('../models/Payment');
  const payments = await Payment.find({ order: order._id }).sort({ createdAt: -1 }).populate('receivedBy', 'fullName');
  res.json({ success: true, data: { order, payments } });
});

exports.create = wrapAsync(async (req, res) => {
  const order = await createOrder({ payload: req.body, user: req.user });
  const populated = await Order.findById(order._id).populate('customer', 'name phone');
  res.status(201).json({ success: true, message: `Order ${order.orderNumber} created`, data: { order: populated } });
});

/** Records a payment against the order. Fully paid orders are converted into a sale automatically. */
exports.pay = wrapAsync(async (req, res) => {
  const { amount, method = 'CASH', reference, notes } = req.body;
  if (!amount) throw new ApiError(400, 'Payment amount is required.');
  const { order, sale } = await payOrder({
    orderId: req.params.id,
    amount,
    method,
    reference,
    notes,
    user: req.user
  });
  if (sale) {
    return res.status(201).json({
      success: true,
      message: `Order ${order.orderNumber} fully paid and converted to sale ${sale.saleNumber}.`,
      data: { order, sale }
    });
  }
  res.status(201).json({
    success: true,
    message: `Payment recorded on ${order.orderNumber}. Outstanding: ${order.balance.toLocaleString()} RWF.`,
    data: { order }
  });
});

/** Backwards-compatible alias: converts a fully-paid open order into a completed sale. */
exports.convertToSale = wrapAsync(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found.');
  if (order.sale) throw new ApiError(400, 'Order already converted to sale.');
  if (['CANCELLED', 'COMPLETED'].includes(order.status)) throw new ApiError(400, `Order is already ${order.status}.`);

  // The order balance is authoritative: pay the remaining value (legacy orders had no balance field).
  const remaining = Math.max(0, order.total - (order.amountPaid || 0));
  if (remaining > 0.001 && !req.body.amountPaid) {
    throw new ApiError(400, `Record the outstanding payment of ${remaining.toLocaleString()} RWF (amountPaid) to fulfill this order.`);
  }

  const amount = req.body.amountPaid !== undefined ? Math.min(Number(req.body.amountPaid), remaining) : remaining;
  const { order: updated, sale } = await payOrder({
    orderId: order._id,
    amount,
    method: req.body.paymentMethod === 'LOAN' || req.body.paymentMethod === 'CREDIT' ? 'CASH' : (req.body.paymentMethod || 'CASH'),
    reference: req.body.paymentReference || order.paymentReference,
    notes: `Fulfilled from order ${order.orderNumber}`,
    user: req.user
  });
  res.status(201).json({ success: true, message: `Order fulfilled as sale ${sale.saleNumber}`, data: { sale, order: updated } });
});

exports.updateStatus = wrapAsync(async (req, res) => {
  const allowed = ['PENDING', 'CONFIRMED'];
  const { status } = req.body;
  if (!allowed.includes(status)) throw new ApiError(400, 'Only PENDING or CONFIRMED can be set manually.');
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found.');
  if (['COMPLETED', 'CANCELLED'].includes(order.status)) throw new ApiError(400, 'Closed orders cannot be edited.');
  order.status = status;
  await order.save();
  res.json({ success: true, message: `Order ${order.orderNumber} marked ${status}`, data: { order } });
});

exports.cancel = wrapAsync(async (req, res) => {
  const { reason } = req.body;
  if (!reason?.trim()) throw new ApiError(400, 'A cancellation reason is required.');
  const order = await cancelOrder({ orderId: req.params.id, reason: reason.trim(), user: req.user });
  res.json({ success: true, message: `Order ${order.orderNumber} cancelled`, data: { order } });
});