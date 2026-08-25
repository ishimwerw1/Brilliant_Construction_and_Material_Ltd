const router = require('express').Router();
const c = require('../controllers/roleController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', protect, c.list);
router.post('/', authorize('roles.manage'), c.create);
router.put('/:id', authorize('roles.manage'), c.update);
router.delete('/:id', authorize('roles.manage'), c.remove);

module.exports = router;
