const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema(
  {
    loanNumber: { type: String, unique: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerName: { type: String },
    customerPhone: { type: String },
    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', required: true },
    saleNumber: { type: String },
    items: [
      {
        productName: { type: String, required: true },
        quantity: { type: Number, required: true },
        unitPrice: { type: Number, required: true }
      }
    ],
    totalAmount: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    outstandingBalance: { type: Number, default: 0, min: 0 },
    dueDate: { type: Date },
    status: {
      type: String,
      enum: ['ACTIVE', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'],
      default: 'ACTIVE'
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    cancelReason: { type: String }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Loan', loanSchema);
