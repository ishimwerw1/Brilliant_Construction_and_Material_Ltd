const router = require('express').Router();
const c = require('../controllers/settingController');
const { protect, authorize } = require('../middleware/auth');

router.get('/public', c.publicInfo);
router.use(protect);
router.get('/', c.get);
router.put('/', authorize('settings.manage'), c.update);

module.exports = router;
