const router = require('express').Router();
const c = require('../controllers/supplierController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', authorize('suppliers.read'), c.list);
router.get('/:id', authorize('suppliers.read'), c.getOne);
router.post('/', authorize('suppliers.create'), c.create);
router.put('/:id', authorize('suppliers.update'), c.update);
router.delete('/:id', authorize('suppliers.delete'), c.remove);

module.exports = router;
