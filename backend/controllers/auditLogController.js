const AuditLog = require('../models/AuditLog');
const { wrapAsync } = require('../middleware/errorHandler');

exports.list = wrapAsync(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(200, Number(req.query.limit) || 30);
  const filter = {};
  if (req.query.search?.trim()) {
    const s = new RegExp(req.query.search.trim(), 'i');
    filter.$or = [{ userName: s }, { description: s }, { action: s }];
  }
  if (req.query.action && req.query.action !== 'ALL') filter.action = req.query.action;
  if (req.query.user) filter.user = req.query.user;
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(`${req.query.to}T23:59:59.999Z`);
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    AuditLog.countDocuments(filter)
  ]);

  const actions = await AuditLog.distinct('action');
  res.json({ success: true, data: { logs, total, page, pages: Math.ceil(total / limit), availableActions: actions.sort() } });
});
