const router = require('express').Router();
const c = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', authorize('orders.read'), c.list);
router.post('/', authorize('orders.create'), c.create);
router.post('/:id/pay', authorize('orders.pay', 'sales.create', 'payments.create'), c.pay);
router.get('/:id', authorize('orders.read'), c.getOne);
router.put('/:id/status', authorize('orders.update'), c.updateStatus);
router.post('/:id/fulfill', authorize('sales.create', 'orders.pay'), c.convertToSale);
router.put('/:id/cancel', authorize('orders.cancel'), c.cancel);

module.exports = router;