const router = require('express').Router();
const c = require('../controllers/saleController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', authorize('sales.read'), c.list);
router.post('/', authorize('sales.create'), c.create);
router.get('/:id', authorize('sales.read'), c.getOne);
router.put('/:id/cancel', authorize('sales.cancel'), c.cancel);

module.exports = router;
