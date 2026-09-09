const router = require('express').Router();
const c = require('../controllers/onDemandController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', authorize('onDemand.read', 'sales.read'), c.list);
router.post('/', authorize('onDemand.create', 'sales.create'), c.create);
router.get('/:id', authorize('onDemand.read', 'sales.read'), c.getOne);
router.post('/:id/pay', authorize('onDemand.pay', 'sales.create'), c.recordPayment);
router.put('/:id/cancel', authorize('onDemand.cancel'), c.cancel);
router.delete('/:id', authorize('onDemand.delete', 'onDemand.cancel'), c.remove);

module.exports = router;