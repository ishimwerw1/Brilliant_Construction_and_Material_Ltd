const Supplier = require('../models/Supplier');
const Product = require('../models/Product');
const StockTransaction = require('../models/StockTransaction');
const ApiError = require('../utils/ApiError');
const { logAction, ACTIONS } = require('../services/auditService');
const { wrapAsync } = require('../middleware/errorHandler');

exports.list = wrapAsync(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const filter = {};
  if (req.query.search?.trim()) {
    const s = new RegExp(req.query.search.trim(), 'i');
    filter.$or = [{ name: s }, { companyName: s }, { phone: s }, { email: s }];
  }
  if (req.query.status) filter.status = req.query.status;

  const [suppliers, total] = await Promise.all([
    Supplier.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Supplier.countDocuments(filter)
  ]);

  const counts = await Product.aggregate([{ $group: { _id: '$supplier', products: { $sum: 1 }, stockValue: { $sum: { $multiply: ['$quantity', '$buyingPrice'] } } } }]);
  const map = Object.fromEntries(counts.map((c) => [String(c._id), c]));

  res.json({
    success: true,
    data: {
      suppliers: suppliers.map((s) => ({ ...s.toJSON(), productCount: map[String(s._id)]?.products || 0, stockValue: map[String(s._id)]?.stockValue || 0 })),
      total, page, pages: Math.ceil(total / limit)
    }
  });
});

exports.getOne = wrapAsync(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) throw new ApiError(404, 'Supplier not found.');
  const products = await Product.find({ supplier: supplier._id }).select('name sku quantity sellingPrice unit');
  const purchases = await StockTransaction.find({ supplier: supplier._id }).sort({ createdAt: -1 }).limit(50).populate('performedBy', 'fullName');
  res.json({ success: true, data: { supplier, products, purchases } });
});

exports.create = wrapAsync(async (req, res) => {
  const { name, phone } = req.body;
  if (!name?.trim() || !phone?.trim()) throw new ApiError(400, 'Supplier name and phone are required.');
  const supplier = await Supplier.create(req.body);
  await logAction({
    user: req.user, action: ACTIONS.SUPPLIER_CREATE, entity: 'Supplier', entityId: supplier._id,
    description: `Created supplier "${supplier.name}".`
  });
  res.status(201).json({ success: true, message: 'Supplier created', data: { supplier } });
});

exports.update = wrapAsync(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) throw new ApiError(404, 'Supplier not found.');
  ['name', 'companyName', 'phone', 'email', 'address', 'notes', 'status'].forEach((f) => {
    if (req.body[f] !== undefined) supplier[f] = req.body[f];
  });
  await supplier.save();
  await logAction({
    user: req.user, action: ACTIONS.SUPPLIER_UPDATE, entity: 'Supplier', entityId: supplier._id,
    description: `Updated supplier "${supplier.name}".`
  });
  res.json({ success: true, message: 'Supplier updated', data: { supplier } });
});

exports.remove = wrapAsync(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) throw new ApiError(404, 'Supplier not found.');
  const productCount = await Product.countDocuments({ supplier: supplier._id });
  if (productCount > 0) throw new ApiError(400, `Cannot delete: ${productCount} product(s) reference this supplier. Deactivate it instead.`);
  await supplier.deleteOne();
  await logAction({
    user: req.user, action: ACTIONS.SUPPLIER_DELETE, entity: 'Supplier', entityId: supplier._id,
    description: `Deleted supplier "${supplier.name}" permanently.`
  });
  res.json({ success: true, message: 'Supplier deleted' });
});
