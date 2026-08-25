const router = require('express').Router();
const c = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', authorize('payments.read'), c.list);
router.post('/repay-loan', authorize('payments.create', 'loans.update'), c.repayLoan);

module.exports = router;
