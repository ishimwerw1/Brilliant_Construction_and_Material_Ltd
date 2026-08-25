const router = require('express').Router();
const c = require('../controllers/loanController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', authorize('loans.read'), c.list);
router.post('/:id/repay', authorize('loans.update', 'payments.create'), c.repay);
router.put('/:id/due-date', authorize('loans.update'), c.updateDueDate);
router.put('/:id/cancel', authorize('loans.cancel'), c.cancel);
router.get('/:id', authorize('loans.read'), c.getOne);

module.exports = router;
