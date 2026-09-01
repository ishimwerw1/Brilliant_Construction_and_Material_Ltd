const mongoose = require('mongoose');
const Purchase = require('../models/Purchase');
const ApiError = require('../utils/ApiError');
const { wrapAsync } = require('../middleware/errorHandler');
const { logAction, ACTIONS } = require('../services/auditService');
const { nextSequence } = require('../utils/generateCode');
const { applyStockMovement } = require('../services/stockService');

exports.list = wrapAsync(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const filter = {};
  if (req.query.search?.trim()) {
    const s = new RegExp(req.query.search.trim(), 'i');
    filter.$or = [{ purchaseNumber: s }, { supplierName: s }, { notes: s }];
  }
  if (req.query.supplier) filter.supplier = req.query.supplier;
  if (req.query.paymentStatus && req.query.paymentStatus !== 'ALL') filter.paymentStatus = req.query.paymentStatus;
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(`${req.query.to}T23:59:59.999Z`);
  }

  const [purchases, total] = await Promise.all([
    Purchase.find(filter).populate('supplier', 'name phone').populate('createdBy', 'fullName')
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Purchase.countDocuments(filter)
  ]);

  res.json({ success: true, data: { purchases, total, page, pages: Math.ceil(total / limit) } });
});

exports.getOne = wrapAsync(async (req, res) => {
  const purchase = await Purchase.findById(req.params.id)
    .populate('supplier', 'name phone email')
    .populate('items.product', 'name sku')
    .populate('createdBy', 'fullName');
  if (!purchase) throw new ApiError(404, 'Purchase not found.');
  res.json({ success: true, data: { purchase } });
});

exports.create = wrapAsync(async (req, res) => {
  const { supplier, supplierName, items, paymentMethod, amountPaid, dueDate, notes } = req.body;
  if (!supplier) throw new ApiError(400, 'Supplier is required.');
  if (!items?.length) throw new ApiError(400, 'At least one item is required.');
  if (!paymentMethod) throw new ApiError(400, 'Payment method is required.');

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let totalAmount = 0;
    const purchaseItems = items.map((item) => {
      const subtotal = item.quantity * item.costPrice;
      totalAmount += subtotal;
      return {
        product: item.product,
        productName: item.productName,
        quantity: item.quantity,
        costPrice: item.costPrice,
        subtotal
      };
    });

    const paid = Number(amountPaid) || 0;
    let paymentStatus = 'UNPAID';
    let remainingAmount = totalAmount;
    if (paid >= totalAmount) {
      paymentStatus = 'PAID';
      remainingAmount = 0;
    } else if (paid > 0) {
      paymentStatus = 'PARTIALLY_PAID';
      remainingAmount = totalAmount - paid;
    }

    const purchaseNumber = await nextSequence('purchase', 'PUR', session);

    const [purchase] = await Purchase.create([{
      purchaseNumber,
      supplier,
      supplierName: supplierName || '',
      items: purchaseItems,
      totalAmount,
      paymentMethod,
      paymentStatus,
      amountPaid: paid,
      remainingAmount,
      dueDate: dueDate || undefined,
      notes: notes?.trim() || '',
      createdBy: req.user._id
    }], { session });

    for (const item of purchaseItems) {
      await applyStockMovement({
        productId: item.product,
        type: 'STOCK_IN',
        quantity: item.quantity,
        reason: `Purchase ${purchaseNumber}`,
        reference: purchase._id,
        unitPrice: item.costPrice,
        supplier,
        user: req.user,
        session
      });
    }

    await logAction({
      user: req.user,
      action: ACTIONS.PURCHASE_CREATE,
      entity: 'Purchase',
      entityId: purchase._id,
      description: `Purchase created: ${purchaseNumber} - RWF ${totalAmount}`
    });

    await session.commitTransaction();
    session.endSession();

    const populated = await Purchase.findById(purchase._id)
      .populate('supplier', 'name phone')
      .populate('items.product', 'name sku')
      .populate('createdBy', 'fullName');

    res.status(201).json({ success: true, message: `Purchase ${purchaseNumber} created successfully.`, data: { purchase: populated } });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
});

exports.update = wrapAsync(async (req, res) => {
  const purchase = await Purchase.findById(req.params.id);
  if (!purchase) throw new ApiError(404, 'Purchase not found.');

  const { notes, dueDate } = req.body;
  if (notes !== undefined) purchase.notes = notes?.trim() || '';
  if (dueDate !== undefined) purchase.dueDate = dueDate || undefined;

  await purchase.save();

  await logAction({
    user: req.user,
    action: ACTIONS.PURCHASE_UPDATE,
    entity: 'Purchase',
    entityId: purchase._id,
    description: `Purchase updated: ${purchase.purchaseNumber}`
  });

  const populated = await Purchase.findById(purchase._id)
    .populate('supplier', 'name phone')
    .populate('items.product', 'name sku')
    .populate('createdBy', 'fullName');

  res.json({ success: true, message: 'Purchase updated successfully.', data: { purchase: populated } });
});

exports.remove = wrapAsync(async (req, res) => {
  const purchase = await Purchase.findById(req.params.id);
  if (!purchase) throw new ApiError(404, 'Purchase not found.');

  const SupplierPayment = require('../models/SupplierPayment');
  const payments = await SupplierPayment.countDocuments({ purchase: purchase._id });
  if (payments > 0) {
    throw new ApiError(400, `Cannot delete purchase ${purchase.purchaseNumber}. ${payments} supplier payment(s) exist against this purchase.`);
  }

  await logAction({
    user: req.user,
    action: ACTIONS.PURCHASE_DELETE,
    entity: 'Purchase',
    entityId: purchase._id,
    description: `Purchase deleted: ${purchase.purchaseNumber}`
  });

  await purchase.deleteOne();
  res.json({ success: true, message: `Purchase ${purchase.purchaseNumber} deleted successfully.` });
});
