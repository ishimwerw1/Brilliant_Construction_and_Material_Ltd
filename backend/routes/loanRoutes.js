const router = require('express').Router();
const c = require('../controllers/loanController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', authorize('loans.read'), c.list);
router.get('/customer/:customerId', authorize('loans.read'), c.getByCustomer);
router.post('/customer/:customerId/pay', authorize('loans.update', 'payments.create'), c.payCustomer);
router.get('/:id/items/:itemIndex', authorize('loans.read'), c.getItem);
router.put('/:id/items/:itemIndex', authorize('loans.update'), c.updateItem);
router.post('/:id/items/:itemIndex/pay', authorize('loans.update', 'payments.create'), c.payItem);
router.post('/:id/items/:itemIndex/remove', authorize('loans.update', 'loans.cancel'), c.removeItem);
router.post('/:id/repay', authorize('loans.update', 'payments.create'), c.repay);
router.put('/:id/due-date', authorize('loans.update'), c.updateDueDate);
router.put('/:id/cancel', authorize('loans.cancel'), c.cancel);
router.get('/:id', authorize('loans.read'), c.getOne);
router.delete('/:id', authorize('loans.delete', 'loans.cancel'), c.remove);

module.exports = router;
