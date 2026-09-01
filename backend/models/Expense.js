const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  category: { type: String, required: true, enum: ['Transport', 'Rent', 'Food', 'Electricity', 'Water', 'Salaries', 'Maintenance', 'Airtime', 'Internet', 'Office', 'Other'], trim: true },
  amount: { type: Number, required: true, min: [0.01, 'Amount must be greater than 0'] },
  paymentMethod: { type: String, required: true, enum: ['CASH', 'MOMO', 'BANK'], trim: true },
  date: { type: Date, required: true, default: Date.now },
  description: { type: String, trim: true, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

expenseSchema.index({ date: -1 });
expenseSchema.index({ category: 1 });
expenseSchema.index({ createdBy: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
