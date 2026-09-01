const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/supplierDebtController');

router.use(protect);

router.get('/summary', authorize('supplierDebts.read'), ctrl.summary);
router.get('/', authorize('supplierDebts.read'), ctrl.listDebts);
router.get('/:id', authorize('supplierDebts.read'), ctrl.getDebt);

module.exports = router;
