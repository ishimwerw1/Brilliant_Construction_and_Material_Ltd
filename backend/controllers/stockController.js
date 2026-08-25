const StockTransaction = require('../models/StockTransaction');
const Product = require('../models/Product');
const Setting = require('../models/Setting');
const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const { nextSequence } = require('../utils/generateCode');
const { applyStockMovement } = require('../services/stockService');
const { notify } = require('../services/notificationService');
const { logAction, ACTIONS } = require('../services/auditService');
const { wrapAsync } = require('../middleware/errorHandler');

/** GET /api/stock/movements - full movement history with filters */
exports.movements = wrapAsync(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(200, Number(req.query.limit) || 30);
  const filter = {};
  if (req.query.product) filter.product = req.query.product;
  if (req.query.type && req.query.type !== 'ALL') filter.type = req.query.type;
  if (req.query.search?.trim()) {
    const s = new RegExp(req.query.search.trim(), 'i');
    filter.$or = [{ productName: s }, { sku: s }, { reference: s }];
  }
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(`${req.query.to}T23:59:59.999Z`);
  }

  const [transactions, total] = await Promise.all([
    StockTransaction.find(filter).populate('product', 'name unit').populate('performedBy', 'fullName')
      .populate('supplier', 'name').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    StockTransaction.countDocuments(filter)
  ]);
  res.json({ success: true, data: { transactions, total, page, pages: Math.ceil(total / limit) } });
});

/** POST /api/stock/in - receive goods from a supplier (supports multiple products in one receipt) */
exports.stockIn = wrapAsync(async (req, res) => {
  const { supplier, items, reference, reason } = req.body;
  if (!Array.isArray(items) || items.length === 0) throw new ApiError(400, 'At least one product line is required.');

  const settings = await Setting.getSettings();
  const grn = reference || `GRN-${Date.now().toString().slice(-8)}`;
  const session = await mongoose.startSession();

  try {
    let result;
    await session.withTransaction(async () => {
      const results = [];
      for (const item of items) {
        if (!item.product || !item.quantity || Number(item.quantity) <= 0) {
          throw new ApiError(400, 'Each line needs a product and a positive quantity.');
        }
        const product = await Product.findById(item.product).session(session);
        if (!product) throw new ApiError(404, 'Product not found in stock-in line.');
        const { product: updated, transaction } = await applyStockMovement({
          productId: item.product,
          type: 'STOCK_IN',
          quantity: Number(item.quantity),
          reason: reason || `Goods received from supplier (${grn})`,
          reference: grn,
          unitPrice: Number(item.buyingPrice ?? product.buyingPrice),
          supplier: supplier || null,
          user: req.user,
          session
        });
        // Optionally update buying price when provided
        const newBuyingPrice = item.buyingPrice !== undefined && item.buyingPrice !== '' ? Number(item.buyingPrice) : null;
        if (newBuyingPrice !== null && newBuyingPrice >= 0 && newBuyingPrice !== updated.buyingPrice) {
          updated.buyingPrice = newBuyingPrice;
          await updated.save({ session });
        }
        if (supplier && String(updated.supplier || '') !== String(supplier)) {
          updated.supplier = supplier;
          await updated.save({ session });
        }
        results.push({ product: updated.name, previousQuantity: transaction.previousQuantity, newQuantity: transaction.newQuantity });
      }

      await notify({
        type: 'STOCK_IN',
        title: 'Stock Received',
        message: `${items.length} product line(s) received via ${grn}.`,
        link: '/stock/movements',
        meta: { grn },
        session
      });

      await logAction({
        user: req.user, action: ACTIONS.STOCK_IN, entity: 'StockTransaction',
        description: `Stock In ${grn}: ${results.map((r) => `${r.product} (+${r.newQuantity - r.previousQuantity})`).join(', ')}.`,
        details: { grn, results },
        session
      });

      result = { reference: grn, results };
    });
    res.status(201).json({ success: true, message: `Stock received successfully (${result.reference})`, data: result });
  } finally {
    session.endSession();
  }
});

/** POST /api/stock/adjustments - controlled quantity corrections */
exports.adjust = wrapAsync(async (req, res) => {
  const { productId, actualQuantity, reason } = req.body;
  if (!productId) throw new ApiError(400, 'Product is required.');
  const parsedActual = Number(actualQuantity);
  if (
    actualQuantity === undefined || actualQuantity === null || actualQuantity === '' ||
    !Number.isFinite(parsedActual) || parsedActual < 0
  ) {
    throw new ApiError(400, 'Actual (counted) quantity must be a valid number, zero or more.');
  }
  if (!reason?.trim()) throw new ApiError(400, 'An adjustment reason is required.');

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const product = await Product.findById(productId).session(session);
      if (!product) throw new ApiError(404, 'Product not found.');
      const systemQty = product.quantity;
      const actualQty = Number(actualQuantity);
      const diff = actualQty - systemQty;

      if (diff === 0) throw new ApiError(400, 'System and counted quantities already match. No adjustment needed.');

      await applyStockMovement({
        productId,
        type: 'ADJUSTMENT',
        quantity: diff,
        reason: reason.trim(),
        reference: `ADJ-${await nextSequence('adjustmentNumber', '', session).catch(() => Date.now())}`,
        user: req.user,
        session
      });

      await notify({
        type: 'STOCK_ADJUSTMENT',
        title: 'Stock Adjusted',
        message: `"${product.name}": ${systemQty} -> ${actualQty} (${diff > 0 ? '+' : ''}${diff}). Reason: ${reason.trim()}`,
        link: '/stock/adjustments',
        session
      });

      await logAction({
        user: req.user, action: ACTIONS.STOCK_ADJUSTMENT, entity: 'Product', entityId: product._id,
        description: `Adjusted "${product.name}" from ${systemQty} to ${actualQty} (diff ${diff}). Reason: ${reason.trim()}`,
        details: { oldQuantity: systemQty, newQuantity: actualQty, difference: diff, reason },
        session
      });

      result = { productName: product.name, systemQuantity: systemQty, actualQuantity: actualQty, difference: diff };
    });
    res.json({ success: true, message: 'Stock adjusted successfully', data: result });
  } finally {
    session.endSession();
  }
});

/** GET /api/stock/low */
exports.lowStock = wrapAsync(async (req, res) => {
  const products = await Product.find({
    status: 'ACTIVE',
    quantity: { $gt: 0 },
    $expr: { $lte: ['$quantity', '$minStockLevel'] }
  }).sort({ quantity: 1 }).populate('category', 'name').limit(200);
  res.json({ success: true, data: { products } });
});

/** GET /api/stock/out-of-stock */
exports.outOfStock = wrapAsync(async (req, res) => {
  const products = await Product.find({ status: 'ACTIVE', quantity: 0 }).sort({ name: 1 }).populate('category', 'name').limit(200);
  res.json({ success: true, data: { products } });
});
