const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/purchaseController');
const upload = require('../middleware/upload');

router.use(protect);

router.route('/')
  .get(authorize('purchases.read'), ctrl.list)
  .post(authorize('purchases.create'), upload.single('attachment'), ctrl.create);
router.patch('/:id/attachment', authorize('purchases.create', 'purchases.update'), upload.single('attachment'), ctrl.attach);
router.route('/:id')
  .get(authorize('purchases.read'), ctrl.getOne)
  .put(authorize('purchases.update'), ctrl.update)
  .delete(authorize('purchases.delete'), ctrl.remove);

module.exports = router;