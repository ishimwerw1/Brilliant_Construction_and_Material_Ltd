const Order = require('../models/Order');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const ApiError = require('../utils/ApiError');
const { nextSequence } = require('../utils/generateCode');
const { createSale } = require('../services/saleService');
const { notify } = require('../services/notificationService');
const { logAction, ACTIONS } = require('../services/auditService');
const { wrapAsync } = require('../middleware/errorHandler');

exports.list = wrapAsync(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const filter = {};
  if (req.query.status && req.query.status !== 'ALL') filter.status = req.query.status;
  if (req.query.search?.trim()) {
    const s = new RegExp(req.query.search.trim(), 'i');
    filter.$or = [{ orderNumber: s }];
  }

  const [orders, total] = await Promise.all([
    Order.find(filter).populate('customer', 'name phone').populate('createdBy', 'fullName')
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Order.countDocuments(filter)
  ]);
  res.json({ success: true, data: { orders, total, page, pages: Math.ceil(total / limit) } });
});

exports.getOne = wrapAsync(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('customer', 'name phone email address').populate('createdBy', 'fullName');
  if (!order) throw new ApiError(404, 'Order not found.');
  res.json({ success: true, data: { order } });
});

exports.create = wrapAsync(async (req, res) => {
  const { customer: customerId, items, expectedDeliveryDate, notes } = req.body;
  if (!customerId || !Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'Customer and at least one product line are required.');
  }
  const customer = await Customer.findById(customerId);
  if (!customer) throw new ApiError(404, 'Customer not found.');

  const orderItems = [];
  for (const item of items) {
    const product = await Product.findById(item.product);
    if (!product) throw new ApiError(404, `Product not found: ${item.product}`);
    const qty = Number(item.quantity);
    if (!qty || qty <= 0) throw new ApiError(400, `Invalid quantity for "${product.name}".`);
    const unitPrice = Number(item.unitPrice ?? product.sellingPrice);
    orderItems.push({ product: product._id, productName: product.name, quantity: qty, unitPrice, subtotal: qty * unitPrice });
  }

  const total = orderItems.reduce((s, i) => s + i.subtotal, 0);
  const session = await Order.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      const orderNumber = await nextSequence('orderNumber', 'ORD', session);
      [order] = await Order.create([{
        orderNumber,
        customer: customerId,
        items: orderItems,
        total,
        expectedDeliveryDate,
        notes,
        createdBy: req.user._id
      }], { session });

      await notify({
        type: 'NEW_ORDER',
        title: 'New Order',
        message: `${order.orderNumber}: ${customer.name} ordered ${orderItems.length} product(s), total ${total.toLocaleString()} RWF.`,
        link: '/orders',
        meta: { orderId: order._id },
        session
      });

      await logAction({
        user: req.user, action: ACTIONS.ORDER_CREATE, entity: 'Order', entityId: order._id,
        description: `Created order ${order.orderNumber} for ${customer.name} (${total} RWF).`,
        session
      });
    });
  } finally {
    session.endSession();
  }

  res.status(201).json({ success: true, message: `Order ${order.orderNumber} created`, data: { order } });
});

/** Converts a pending order into a completed sale using the sale service. */
exports.convertToSale = wrapAsync(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found.');
  if (order.status !== 'PENDING') throw new ApiError(400, `Only pending orders can be converted. This one is ${order.status}.`);

  const payload = {
    customer: order.customer,
    items: order.items.map((i) => ({ product: i.product, quantity: i.quantity, unitPrice: i.unitPrice })),
    paymentMethod: req.body.paymentMethod || 'CASH',
    amountPaid: req.body.amountPaid ?? undefined,
    paymentReference: req.body.paymentReference,
    discount: req.body.discount ?? 0,
    notes: `Fulfilled from order ${order.orderNumber}`,
    order: order._id
  };

  const sale = await createSale({ payload, user: req.user });
  order.status = 'COMPLETED';
  await order.save();
  res.status(201).json({ success: true, message: `Order fulfilled as sale ${sale.saleNumber}`, data: { sale, order } });
});

exports.cancel = wrapAsync(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found.');
  if (order.status !== 'PENDING') throw new ApiError(400, 'Only pending orders can be cancelled.');
  order.status = 'CANCELLED';
  await order.save();
  await logAction({
    user: req.user, action: ACTIONS.ORDER_CANCEL, entity: 'Order', entityId: order._id,
    description: `Cancelled order ${order.orderNumber}.`
  });
  res.json({ success: true, message: 'Order cancelled', data: { order } });
});
