const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema(
  {
    companyName: { type: String, default: 'Brilliant Construction and Materials Ltd' },
    slogan: { type: String, default: 'Quality Plumbing & Water Solutions' },
    phone: { type: String, default: '+250 700 000 000' },
    email: { type: String, default: 'info@brilliantconstruction.rw' },
    address: { type: String, default: 'Kigali, Rwanda' },
    currency: { type: String, default: 'RWF' },
    logoUrl: { type: String, default: '/logo.png' },
    allowBackorders: { type: Boolean, default: false },
    defaultDueDays: { type: Number, default: 30 },
    invoiceFooterNote: { type: String, default: 'Thank you for your business!' }
  },
  { timestamps: true }
);

settingSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) settings = await this.create({});
  return settings;
};

module.exports = mongoose.model('Setting', settingSchema);
