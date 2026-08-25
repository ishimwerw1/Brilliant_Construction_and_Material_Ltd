const Category = require('../models/Category');
const Product = require('../models/Product');
const ApiError = require('../utils/ApiError');
const { logAction, ACTIONS } = require('../services/auditService');
const { wrapAsync } = require('../middleware/errorHandler');

exports.list = wrapAsync(async (req, res) => {
  const categories = await Category.find().sort({ name: 1 }).populate('parent', 'name');
  const productCounts = await Product.aggregate([{ $group: { _id: '$category', count: { $sum: 1 }, totalQty: { $sum: '$quantity' } } }]);
  const map = Object.fromEntries(productCounts.map((c) => [String(c._id), c]));
  res.json({
    success: true,
    data: {
      categories: categories.map((c) => ({
        ...c.toJSON(),
        productCount: map[String(c._id)]?.count || 0,
        totalQuantity: map[String(c._id)]?.totalQty || 0
      }))
    }
  });
});

exports.create = wrapAsync(async (req, res) => {
  const { name, description, parent, isActive } = req.body;
  if (!name?.trim()) throw new ApiError(400, 'Category name is required.');
  if (parent) {
    const parentExists = await Category.findById(parent);
    if (!parentExists) throw new ApiError(404, 'Parent category not found.');
  }
  const category = await Category.create({ name: name.trim(), description, parent: parent || null, isActive });
  await logAction({
    user: req.user, action: ACTIONS.CATEGORY_CREATE, entity: 'Category', entityId: category._id,
    description: `Created category "${category.name}".`
  });
  res.status(201).json({ success: true, message: 'Category created', data: { category } });
});

exports.update = wrapAsync(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new ApiError(404, 'Category not found.');
  if (req.body.parent && String(req.body.parent) === String(category._id)) {
    throw new ApiError(400, 'A category cannot be its own parent.');
  }
  if (req.body.name !== undefined) category.name = req.body.name.trim();
  if (req.body.description !== undefined) category.description = req.body.description;
  if (req.body.parent !== undefined) category.parent = req.body.parent || null;
  if (req.body.isActive !== undefined) category.isActive = req.body.isActive;
  await category.save();
  await logAction({
    user: req.user, action: ACTIONS.CATEGORY_UPDATE, entity: 'Category', entityId: category._id,
    description: `Updated category "${category.name}".`
  });
  res.json({ success: true, message: 'Category updated', data: { category } });
});

exports.remove = wrapAsync(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new ApiError(404, 'Category not found.');
  const productCount = await Product.countDocuments({ category: category._id });
  if (productCount > 0) throw new ApiError(400, `Cannot delete: ${productCount} product(s) belong to this category.`);
  const childCount = await Category.countDocuments({ parent: category._id });
  if (childCount > 0) throw new ApiError(400, `Cannot delete: this category has ${childCount} subcategory/subcategories.`);
  await category.deleteOne();
  await logAction({
    user: req.user, action: ACTIONS.CATEGORY_DELETE, entity: 'Category',
    description: `Deleted category "${category.name}".`
  });
  res.json({ success: true, message: 'Category deleted' });
});
