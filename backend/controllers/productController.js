const Product = require('../models/Product');
const Category = require('../models/Category');
const ApiError = require('../utils/ApiError');
const { logAction, ACTIONS } = require('../services/auditService');
const { wrapAsync } = require('../middleware/errorHandler');
const { nextSequence } = require('../utils/generateCode');

const MAX_IMAGE_BYTES = 1_500_000;

// Build a short uppercase code from a category name, e.g.
// "PVC Pipes" -> "PVC", "Taps & Mixers" -> "TAM", "Steel" -> "STE"
const prefixFromCategoryName = (name) => {
  const words = String(name || '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  if (!words.length) return 'PRD';
  if (words.length === 1) return words[0].slice(0, 3);
  return words.slice(0, 3).map((w) => w[0]).join('');
};

// Generate the next available SKU like "PVC-0007" scoped to the category
const generateSku = async (categoryId) => {
  let base = 'PRD';
  if (categoryId) {
    const cat = await Category.findById(categoryId).populate('parent', 'name');
    if (cat) {
      const name = cat.parent ? `${cat.parent.name} ${cat.name}` : cat.name;
      base = prefixFromCategoryName(name);
    }
  }
  // Guarantee uniqueness even if similar manual SKUs exist
  for (let i = 0; i < 25; i += 1) {
    const candidate = await nextSequence(`sku_${base}`, base, null, 4);
    const taken = await Product.exists({ sku: candidate });
    if (!taken) return candidate;
  }
  return `PRD-${Date.now().toString().slice(-6)}`;
};

exports.nextSku = wrapAsync(async (req, res) => {
  const sku = await generateSku(req.query.categoryId);
  res.json({ success: true, data: { sku } });
});

const buildFilter = (query) => {
  const filter = {};
  if (query.category) {
    const ids = Array.isArray(query.category) ? query.category : [query.category];
    filter.category = { $in: ids };
  }
  if (query.status) filter.status = query.status;
  if (query.supplier) filter.supplier = query.supplier;
  if (query.search?.trim()) {
    const s = new RegExp(query.search.trim(), 'i');
    filter.$or = [{ name: s }, { sku: s }, { barcode: s }, { brand: s }];
  }
  if (query.stockState === 'low') {
    filter.quantity = { $gt: 0 };
    filter.$expr = { $lte: ['$quantity', '$minStockLevel'] };
    if (!filter.status) filter.status = 'ACTIVE';
  }
  if (query.stockState === 'out') {
    filter.quantity = 0;
    filter.status = 'ACTIVE';
  }
  return filter;
};

exports.list = wrapAsync(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(200, Number(req.query.limit) || 20);
  const filter = buildFilter(req.query);

  const sortMap = {
    name: 'name', '-name': '-name',
    quantity: 'quantity', '-quantity': '-quantity',
    price: 'sellingPrice', '-price': '-sellingPrice',
    newest: '-createdAt', oldest: 'createdAt'
  };
  const sort = sortMap[req.query.sort] || '-createdAt';

  const [products, total] = await Promise.all([
    Product.find(filter).populate('category', 'name parent').populate('supplier', 'name').sort(sort)
      .skip((page - 1) * limit).limit(limit),
    Product.countDocuments(filter)
  ]);

  res.json({ success: true, data: { products, total, page, pages: Math.ceil(total / limit) } });
});

exports.getOne = wrapAsync(async (req, res) => {
  const product = await Product.findById(req.params.id).populate('category').populate('supplier');
  if (!product) throw new ApiError(404, 'Product not found.');
  res.json({ success: true, data: { product } });
});

const validateProductInput = async ({ body, existingId }) => {
  const errors = [];
  if (!body.name?.trim()) errors.push('Product name is required.');
  if (body.sku !== undefined && !String(body.sku).trim() && existingId) errors.push('SKU is required.');
  if (body.buyingPrice === undefined || body.buyingPrice === null || Number(body.buyingPrice) < 0) errors.push('Buying price must be a non-negative number.');
  if (!body.sellingPrice || Number(body.sellingPrice) < 0) errors.push('Selling price must be a non-negative number.');
  if (Number(body.buyingPrice) > Number(body.sellingPrice)) errors.push('Selling price should not be below the buying price.');
  if (!body.category) errors.push('Category is required.');
  if (errors.length) throw new ApiError(400, errors[0], errors);

  // Uniqueness check only applies when a SKU is explicitly provided;
  // empty SKU on create means the system generates one.
  if (String(body.sku || '').trim()) {
    const dup = await Product.findOne({ sku: String(body.sku).toUpperCase(), ...(existingId ? { _id: { $ne: existingId } } : {}) });
    if (dup) throw new ApiError(409, `SKU "${body.sku}" is already used by another product.`);
  }
};

exports.create = wrapAsync(async (req, res) => {
  // Auto-generate a SKU when none was provided
  if (!String(req.body.sku || '').trim()) {
    req.body.sku = await generateSku(req.body.category);
  }

  await validateProductInput({ body: req.body });

  let image;
  if (req.file) {
    if (req.file.size > MAX_IMAGE_BYTES) throw new ApiError(400, 'Image must be smaller than 1.5MB.');
    image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  }

  const product = await Product.create({
    name: req.body.name.trim(),
    sku: String(req.body.sku).toUpperCase(),
    barcode: req.body.barcode,
    category: req.body.category,
    subcategory: req.body.subcategory,
    brand: req.body.brand,
    description: req.body.description,
    unit: req.body.unit || 'piece',
    buyingPrice: Number(req.body.buyingPrice),
    sellingPrice: Number(req.body.sellingPrice),
    quantity: Number(req.body.quantity) || 0,
    minStockLevel: Number(req.body.minStockLevel ?? 5),
    supplier: req.body.supplier || undefined,
    location: req.body.location,
    status: req.body.status || 'ACTIVE',
    image
  });

  // Record opening stock as a traceable transaction when provided
  if (product.quantity > 0) {
    const StockTransaction = require('../models/StockTransaction');
    await StockTransaction.create([{
      product: product._id,
      productName: product.name,
      sku: product.sku,
      type: 'OPENING_STOCK',
      quantity: product.quantity,
      previousQuantity: 0,
      newQuantity: product.quantity,
      unitPrice: product.buyingPrice,
      reason: 'Initial stock on product creation',
      reference: `PRD-${String(product._id).slice(-6).toUpperCase()}`,
      performedBy: req.user._id
    }]);
  }

  await logAction({
    user: req.user, action: ACTIONS.PRODUCT_CREATE, entity: 'Product', entityId: product._id,
    description: `Created product "${product.name}" (${product.sku}).`
  });
  res.status(201).json({ success: true, message: 'Product created', data: { product } });
});

exports.update = wrapAsync(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found.');

  await validateProductInput({ body: { ...req.body, sku: req.body.sku ?? product.sku }, existingId: product._id });

  if (req.file) {
    if (req.file.size > MAX_IMAGE_BYTES) throw new ApiError(400, 'Image must be smaller than 1.5MB.');
    product.image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  }

  const fields = ['name', 'sku', 'barcode', 'brand', 'description', 'unit', 'location', 'status'];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) product[f] = f === 'sku' ? String(req.body[f]).toUpperCase() : req.body[f];
  });
  ['category', 'subcategory', 'supplier'].forEach((f) => {
    if (req.body[f] !== undefined) product[f] = req.body[f] || undefined;
  });
  ['buyingPrice', 'sellingPrice', 'minStockLevel'].forEach((f) => {
    if (req.body[f] !== undefined && req.body[f] !== '') product[f] = Number(req.body[f]);
  });

  // Direct quantity edits are forbidden; use stock adjustments.
  if (req.body.quantity !== undefined && Number(req.body.quantity) !== product.quantity) {
    throw new ApiError(400, 'Use the Stock Adjustment feature to change quantities. Direct edits are not allowed.');
  }

  await product.save();
  await logAction({
    user: req.user, action: ACTIONS.PRODUCT_UPDATE, entity: 'Product', entityId: product._id,
    description: `Updated product "${product.name}".`
  });
  res.json({ success: true, message: 'Product updated', data: { product } });
});

exports.remove = wrapAsync(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found.');
  product.status = 'INACTIVE';
  await product.save();
  await logAction({
    user: req.user, action: ACTIONS.PRODUCT_DELETE, entity: 'Product', entityId: product._id,
    description: `Deactivated product "${product.name}" (${product.sku}).`
  });
  res.json({ success: true, message: 'Product deactivated' });
});
