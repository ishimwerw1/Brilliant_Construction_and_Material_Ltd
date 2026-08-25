const router = require('express').Router();
const c = require('../controllers/notificationController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', authorize('notifications.read', 'dashboard.read'), c.list);
router.put('/read-all', protect, c.markAllRead);
router.put('/:id/read', c.markRead);

module.exports = router;
