const router = require('express').Router();
const c = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', authorize('orders.read'), c.list);
router.post('/', authorize('orders.create'), c.create);
router.get('/:id', authorize('orders.read'), c.getOne);
router.post('/:id/fulfill', authorize('sales.create'), c.convertToSale);
router.put('/:id/cancel', authorize('orders.cancel'), c.cancel);

module.exports = router;
