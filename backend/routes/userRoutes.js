const router = require('express').Router();
const c = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', authorize('users.read'), c.list);
router.get('/:id', authorize('users.read'), c.getOne);
router.post('/', authorize('users.create'), c.create);
router.put('/:id', authorize('users.update'), c.update);
router.put('/:id/reset-password', authorize('users.update'), c.resetPassword);
router.delete('/:id', authorize('users.delete'), c.remove);

module.exports = router;
