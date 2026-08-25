const Setting = require('../models/Setting');
const { logAction, ACTIONS } = require('../services/auditService');
const { wrapAsync } = require('../middleware/errorHandler');

exports.get = wrapAsync(async (req, res) => {
  const settings = await Setting.getSettings();
  res.json({ success: true, data: { settings } });
});

// Public (no auth) company info for invoices/login page branding
exports.publicInfo = wrapAsync(async (_req, res) => {
  const settings = await Setting.getSettings();
  res.json({
    success: true,
    data: { company: { companyName: settings.companyName, slogan: settings.slogan, phone: settings.phone, email: settings.email, address: settings.address, currency: settings.currency, logoUrl: settings.logoUrl } }
  });
});

exports.update = wrapAsync(async (req, res) => {
  const settings = await Setting.getSettings();
  const fields = ['companyName', 'slogan', 'phone', 'email', 'address', 'currency', 'logoUrl', 'allowBackorders', 'defaultDueDays', 'invoiceFooterNote'];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) settings[f] = req.body[f];
  });
  await settings.save();
  await logAction({
    user: req.user, action: ACTIONS.SETTINGS_UPDATE, entity: 'Setting',
    description: 'Updated system settings.',
    details: req.body
  });
  res.json({ success: true, message: 'Settings updated', data: { settings } });
});
