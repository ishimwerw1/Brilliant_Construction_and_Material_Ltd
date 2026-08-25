const router = require('express').Router();
const c = require('../controllers/auditLogController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('auditLogs.read'));
router.get('/', c.list);

module.exports = router;
