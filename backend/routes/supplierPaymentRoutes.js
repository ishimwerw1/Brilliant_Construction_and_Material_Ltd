const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/supplierDebtController');

router.use(protect);

router.post('/', authorize('supplierDebts.pay'), ctrl.recordPayment);
router.delete('/:id', authorize('purchases.delete', 'supplierDebts.pay'), ctrl.removePayment);

module.exports = router;
