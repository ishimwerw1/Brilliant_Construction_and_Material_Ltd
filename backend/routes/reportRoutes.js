const router = require('express').Router();
const c = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('reports.read'));
router.get('/sales', c.salesReport);
router.get('/stock', c.stockReport);
router.get('/customers', c.customersReport);
router.get('/loans', c.loansReport);
router.get('/financial', c.financialReport);
router.get('/expenses', c.expenseReport);
router.get('/purchases', c.purchaseReport);
router.get('/user-performance', c.userPerformanceReport);

module.exports = router;
