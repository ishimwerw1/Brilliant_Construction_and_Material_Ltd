const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    paymentNumber: { type: String, unique: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    method: { type: String, enum: ['CASH', 'MOMO', 'BANK'], required: true },
    reference: { type: String, trim: true },
    type: { type: String, enum: ['SALE_PAYMENT', 'LOAN_REPAYMENT'], default: 'SALE_PAYMENT' },
    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
    loan: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan' },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerName: { type: String },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
