const router = require('express').Router();
const c = require('../controllers/productController');
const upload = require('../middleware/upload');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/next-sku', authorize('products.read', 'products.create', 'stock.read', 'sales.read', 'sales.create'), c.nextSku);
router.get('/', authorize('products.read', 'stock.read', 'sales.read', 'sales.create'), c.list);
router.get('/:id', authorize('products.read', 'stock.read', 'sales.read', 'sales.create'), c.getOne);
router.post('/', authorize('products.create'), upload.single('image'), c.create);
router.put('/:id', authorize('products.update'), upload.single('image'), c.update);
router.delete('/:id', authorize('products.delete'), c.remove);

module.exports = router;
