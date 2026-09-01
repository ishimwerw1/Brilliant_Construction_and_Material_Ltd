const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/expenseController');

router.use(protect);

router.get('/summary', authorize('expenses.read'), ctrl.summary);
router.route('/')
  .get(authorize('expenses.read'), ctrl.list)
  .post(authorize('expenses.create'), ctrl.create);
router.route('/:id')
  .get(authorize('expenses.read'), ctrl.getOne)
  .put(authorize('expenses.update'), ctrl.update)
  .delete(authorize('expenses.delete'), ctrl.remove);

module.exports = router;
