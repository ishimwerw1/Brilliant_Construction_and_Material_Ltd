const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/purchaseController');

router.use(protect);

router.route('/')
  .get(authorize('purchases.read'), ctrl.list)
  .post(authorize('purchases.create'), ctrl.create);
router.route('/:id')
  .get(authorize('purchases.read'), ctrl.getOne)
  .put(authorize('purchases.update'), ctrl.update)
  .delete(authorize('purchases.delete'), ctrl.remove);

module.exports = router;
