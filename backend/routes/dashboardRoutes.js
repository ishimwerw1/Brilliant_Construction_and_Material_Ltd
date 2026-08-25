const router = require('express').Router();
const c = require('../controllers/dashboardController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('dashboard.read'));
router.get('/overview', c.overview);

module.exports = router;
