const router = require('express').Router();
const c = require('../controllers/customerController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', authorize('customers.read'), c.list);
router.get('/:id', authorize('customers.read'), c.getOne);
router.post('/', authorize('customers.create', 'sales.create'), c.create);
router.put('/:id', authorize('customers.update'), c.update);
router.delete('/:id', authorize('customers.delete'), c.remove);

module.exports = router;
