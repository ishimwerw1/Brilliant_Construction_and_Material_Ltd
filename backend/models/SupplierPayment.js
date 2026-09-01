const mongoose = require('mongoose');

const supplierPaymentSchema = new mongoose.Schema({
  paymentNumber: { type: String, unique: true, index: true },
  purchase: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase', required: true },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  amount: { type: Number, required: true, min: [0.01, 'Amount must be greater than 0'] },
  paymentMethod: { type: String, required: true, enum: ['CASH', 'MOMO', 'BANK'] },
  reference: { type: String, trim: true, default: '' },
  notes: { type: String, trim: true, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: { createdAt: true, updatedAt: false } });

supplierPaymentSchema.index({ purchase: 1 });
supplierPaymentSchema.index({ supplier: 1 });
supplierPaymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('SupplierPayment', supplierPaymentSchema);
