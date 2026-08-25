const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    sku: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    subtotal: { type: Number, required: true }
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    saleNumber: { type: String, unique: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerName: { type: String },
    items: {
      type: [saleItemSchema],
      validate: v => Array.isArray(v) && v.length > 0
    },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    balance: { type: Number, default: 0, min: 0 },
    paymentMethod: { type: String, enum: ['CASH', 'MOMO', 'BANK', 'LOAN', 'MIXED'], required: true },
    paymentStatus: { type: String, enum: ['PAID', 'PARTIALLY_PAID', 'UNPAID'], default: 'UNPAID' },
    paymentReference: { type: String, trim: true },
    status: { type: String, enum: ['COMPLETED', 'CANCELLED'], default: 'COMPLETED' },
    cashier: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    notes: { type: String, trim: true },
    cancelledReason: { type: String }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Sale', saleSchema);
