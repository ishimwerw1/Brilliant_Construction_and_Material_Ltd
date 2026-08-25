const router = require('express').Router();
const auth = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/login', authLimiter, auth.login);
router.post('/logout', protect, auth.logout);
router.get('/me', protect, auth.getMe);
router.put('/profile', protect, auth.updateProfile);
router.put('/change-password', protect, auth.changePassword);

module.exports = router;
