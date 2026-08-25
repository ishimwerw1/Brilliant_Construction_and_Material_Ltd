const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');
const { wrapAsync } = require('../middleware/errorHandler');

exports.list = wrapAsync(async (req, res) => {
  const limit = Math.min(100, Number(req.query.limit) || 30);
  const notifications = await Notification.find().sort({ createdAt: -1 }).limit(limit);
  res.json({ success: true, data: { notifications } });
});

exports.markRead = wrapAsync(async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  if (!notification) throw new ApiError(404, 'Notification not found.');
  if (!notification.readBy.some((id) => String(id) === String(req.user._id))) {
    notification.readBy.push(req.user._id);
    await notification.save();
  }
  res.json({ success: true, message: 'Marked as read' });
});

exports.markAllRead = wrapAsync(async (req, res) => {
  const unread = await Notification.find({ readBy: { $ne: req.user._id } });
  for (const n of unread) {
    n.readBy.push(req.user._id);
    await n.save();
  }
  res.json({ success: true, message: 'All notifications marked as read', data: { count: unread.length } });
});
