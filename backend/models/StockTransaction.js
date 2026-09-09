const mongoose = require('mongoose');

const stockTransactionSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    productName: { type: String },
    sku: { type: String },
    type: {
      type: String,
      required: true,
      enum: ['OPENING_STOCK', 'STOCK_IN', 'STOCK_IN_ON_DEMAND', 'SALE', 'ON_DEMAND_SALE', 'RETURN', 'DAMAGED', 'LOST', 'ADJUSTMENT', 'TRANSFER', 'SALE_CANCEL', 'STOCK_IN_REVERSE', 'ADJUSTMENT_REVERSE']
    },
    quantity: { type: Number, required: true },
    previousQuantity: { type: Number, required: true },
    newQuantity: { type: Number, required: true },
    unitPrice: { type: Number, default: 0 },
    reason: { type: String, trim: true },
    reference: { type: String, trim: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('StockTransaction', stockTransactionSchema);
