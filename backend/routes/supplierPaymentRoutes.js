const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/supplierDebtController');

router.use(protect);

router.post('/', authorize('supplierDebts.pay'), ctrl.recordPayment);

module.exports = router;
