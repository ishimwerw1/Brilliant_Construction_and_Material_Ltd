const mongoose = require('mongoose');
const Product = require('../models/Product');
const StockTransaction = require('../models/StockTransaction');
const ApiError = require('../utils/ApiError');
const { checkLowStock } = require('./notificationService');

const IN_TYPES = ['STOCK_IN', 'RETURN', 'OPENING_STOCK'];
const OUT_TYPES = ['SALE', 'DAMAGED', 'LOST'];

/**
 * Applies a stock movement to a product, creating a traceable transaction.
 * quantity must be positive, except for ADJUSTMENT where it is a signed difference.
 */
const applyStockMovement = async ({
  productId,
  type,
  quantity,
  reason,
  reference,
  unitPrice = 0,
  supplier = null,
  sale = null,
  user,
  session
}) => {
  const product = await Product.findById(productId).session(session);
  if (!product) throw new ApiError(404, 'Product not found.');

  // ADJUSTMENT receives a signed difference; every other type requires a positive quantity.
  if (type === 'ADJUSTMENT') {
    if (!Number.isFinite(Number(quantity)) || Number(quantity) === 0) {
      throw new ApiError(400, 'Adjustment difference cannot be zero.');
    }
  } else if (!quantity || !Number.isFinite(Number(quantity)) || Number(quantity) <= 0) {
    throw new ApiError(400, 'Quantity must be greater than zero.');
  }

  const previousQuantity = product.quantity;
  let newQuantity;

  if (IN_TYPES.includes(type)) {
    newQuantity = previousQuantity + quantity;
  } else if (OUT_TYPES.includes(type)) {
    newQuantity = previousQuantity - quantity;
    if (newQuantity < 0) {
      throw new ApiError(
        400,
        `Insufficient stock for "${product.name}". Available: ${previousQuantity}, requested: ${quantity}.`
      );
    }
  } else if (type === 'ADJUSTMENT') {
    // quantity here is the signed difference
    newQuantity = previousQuantity + quantity;
    if (newQuantity < 0) throw new ApiError(400, 'Stock cannot become negative.');
  } else if (type === 'TRANSFER' || type === 'SALE_CANCEL') {
    newQuantity = type === 'SALE_CANCEL' ? previousQuantity + quantity : previousQuantity - quantity;
    if (newQuantity < 0) throw new ApiError(400, 'Stock cannot become negative.');
  } else {
    throw new ApiError(400, `Unknown stock transaction type: ${type}`);
  }

  product.quantity = newQuantity;
  await product.save({ session });

  await StockTransaction.create(
    [
      {
        product: product._id,
        productName: product.name,
        sku: product.sku,
        type,
        quantity,
        previousQuantity,
        newQuantity,
        unitPrice,
        reason,
        reference,
        supplier,
        sale,
        performedBy: user._id
      }
    ],
    { session }
  );

  await checkLowStock(product, session);

  return { product, transaction: { previousQuantity, newQuantity } };
};

module.exports = { applyStockMovement };
