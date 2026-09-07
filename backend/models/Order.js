const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    sku: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    costPriceAtOrder: { type: Number, default: 0, min: 0 },
    totalCost: { type: Number, default: 0, min: 0 },
    totalRevenue: { type: Number, default: 0, min: 0 },
    profit: { type: Number, default: 0 },
    subtotal: { type: Number, required: true }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    items: {
      type: [orderItemSchema],
      validate: v => Array.isArray(v) && v.length > 0
    },
    total: { type: Number, required: true, min: 0 },
    totalCost: { type: Number, default: 0, min: 0 },
    totalProfit: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    balance: { type: Number, default: 0, min: 0 },
    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
    paymentMethod: { type: String, enum: ['CASH', 'MOMO', 'BANK', 'LOAN', 'CREDIT', 'MIXED'] },
    paymentReference: { type: String, trim: true },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'PARTIALLY_PAID', 'PAID', 'COMPLETED', 'CANCELLED'],
      default: 'PENDING'
    },
    expectedDeliveryDate: { type: Date },
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
