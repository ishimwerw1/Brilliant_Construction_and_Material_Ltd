const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true },
  quantity: { type: Number, required: true, min: [1, 'Quantity must be at least 1'] },
  costPrice: { type: Number, required: true, min: [0, 'Cost price cannot be negative'] },
  subtotal: { type: Number, required: true }
}, { _id: false });

const purchaseSchema = new mongoose.Schema({
  purchaseNumber: { type: String, unique: true, index: true },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  supplierName: { type: String },
  items: { type: [purchaseItemSchema], required: true, validate: [v => v.length > 0, 'At least one item is required'] },
  totalAmount: { type: Number, required: true, min: 0 },
  paymentMethod: { type: String, required: true, enum: ['CASH', 'MOMO', 'BANK'] },
  paymentStatus: { type: String, required: true, enum: ['PAID', 'PARTIALLY_PAID', 'UNPAID'], default: 'UNPAID' },
  amountPaid: { type: Number, default: 0, min: 0 },
  remainingAmount: { type: Number, default: 0, min: 0 },
  dueDate: { type: Date },
  notes: { type: String, trim: true, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

purchaseSchema.index({ supplier: 1 });
purchaseSchema.index({ paymentStatus: 1 });
purchaseSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Purchase', purchaseSchema);
