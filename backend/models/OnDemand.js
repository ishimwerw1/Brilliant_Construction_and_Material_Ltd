const mongoose = require('mongoose');

const onDemandItemSchema = new mongoose.Schema(
  {
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    supplierCostPrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    totalCost: { type: Number, required: true, min: 0 },
    totalRevenue: { type: Number, required: true, min: 0 },
    profit: { type: Number, default: 0 },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }
  },
  { _id: false }
);

const paymentRecordSchema = new mongoose.Schema(
  {
    paymentNumber: { type: String },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: ['CASH', 'MOMO', 'BANK'], required: true },
    reference: { type: String, trim: true },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    receivedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const onDemandSchema = new mongoose.Schema(
  {
    transactionNumber: { type: String, unique: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerName: { type: String },
    customerPhone: { type: String },
    items: {
      type: [onDemandItemSchema],
      validate: v => Array.isArray(v) && v.length > 0
    },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    supplierName: { type: String },
    supplierCost: { type: Number, required: true, min: 0 },
    customerSellingPrice: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    totalCost: { type: Number, required: true, min: 0 },
    totalProfit: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    balance: { type: Number, default: 0, min: 0 },
    supplierPaid: { type: Number, default: 0, min: 0 },
    supplierBalance: { type: Number, default: 0, min: 0 },
    paymentMethod: { type: String, enum: ['CASH', 'MOMO', 'BANK', 'LOAN', 'CREDIT', 'MIXED'], required: true },
    paymentStatus: { type: String, enum: ['PAID', 'PARTIALLY_PAID', 'UNPAID'], default: 'UNPAID' },
    supplierPaymentStatus: { type: String, enum: ['PAID', 'PARTIALLY_PAID', 'UNPAID'], default: 'UNPAID' },
    status: { type: String, enum: ['ACTIVE', 'COMPLETED', 'CANCELLED'], default: 'ACTIVE' },
    customerPayments: { type: [paymentRecordSchema], default: [] },
    supplierPayments: { type: [paymentRecordSchema], default: [] },
    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
    purchase: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase' },
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

onDemandSchema.index({ customer: 1 });
onDemandSchema.index({ supplier: 1 });
onDemandSchema.index({ createdAt: -1 });

module.exports = mongoose.model('OnDemand', onDemandSchema);
