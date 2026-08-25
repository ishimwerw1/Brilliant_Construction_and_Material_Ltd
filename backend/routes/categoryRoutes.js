const router = require('express').Router();
const c = require('../controllers/categoryController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', authorize('categories.read', 'products.read'), c.list);
router.post('/', authorize('categories.create'), c.create);
router.put('/:id', authorize('categories.update'), c.update);
router.delete('/:id', authorize('categories.delete'), c.remove);

module.exports = router;
