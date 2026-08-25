const router = require('express').Router();
const c = require('../controllers/stockController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/movements', authorize('stock.read'), c.movements);
router.get('/low', authorize('products.read'), c.lowStock);
router.get('/out-of-stock', authorize('products.read'), c.outOfStock);
router.post('/in', authorize('stock.create'), c.stockIn);
router.post('/adjustments', authorize('stock.adjust'), c.adjust);

module.exports = router;
