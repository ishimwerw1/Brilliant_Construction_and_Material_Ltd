const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['LOW_STOCK', 'OUT_OF_STOCK', 'NEW_SALE', 'NEW_ORDER', 'LOAN_CREATED', 'LOAN_REPAYMENT', 'LOAN_OVERDUE', 'STOCK_IN', 'STOCK_ADJUSTMENT', 'SYSTEM'],
      required: true
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    meta: { type: mongoose.Schema.Types.Mixed }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
