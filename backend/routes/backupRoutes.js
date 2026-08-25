const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const c = require('../controllers/backupController');
const { protect, authorize } = require('../middleware/auth');

const uploadRestore = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25_000_000 },
  fileFilter: (_req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.json') {
      return cb(new Error('Only .json backup files are allowed.'));
    }
    cb(null, true);
  }
});

router.use(protect);

router.post('/', authorize('backups.create'), c.create);
router.get('/', authorize('backups.read'), c.list);
router.get('/:fileName/download', authorize('backups.read'), c.download);
router.delete('/:fileName', authorize('backups.delete'), c.remove);
router.post('/restore', authorize('backups.restore'), uploadRestore.single('file'), c.restore);

module.exports = router;
