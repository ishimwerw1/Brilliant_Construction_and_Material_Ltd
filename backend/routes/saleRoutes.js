const router = require('express').Router();
const c = require('../controllers/saleController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(protect);
router.get('/', authorize('sales.read'), c.list);
router.post('/', authorize('sales.create'), c.create);
router.get('/:id', authorize('sales.read'), c.getOne);
router.put('/:id/cancel', authorize('sales.cancel'), c.cancel);
router.patch('/:id/attachment', authorize('sales.create', 'sales.cancel'), upload.single('attachment'), c.attach);
router.delete('/:id', authorize('sales.delete', 'sales.cancel'), c.remove);

module.exports = router;
