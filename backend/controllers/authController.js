const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { logAction, ACTIONS } = require('../services/auditService');
const { wrapAsync } = require('../middleware/errorHandler');

const signToken = (user) =>
  jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });

exports.login = wrapAsync(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) throw new ApiError(400, 'Username and password are required.');

  const user = await User.findOne({
    $or: [{ username: String(username).toLowerCase() }, { email: String(username).toLowerCase() }]
  }).select('+password').populate('role');

  if (!user || !(await user.comparePassword(password))) {
    await logAction({ action: ACTIONS.LOGIN_FAILED, description: `Failed login attempt for "${username}"` });
    throw new ApiError(401, 'Invalid username or password.');
  }
  if (!user.isActive) throw new ApiError(403, 'Account deactivated. Contact the administrator.');

  user.lastLoginAt = new Date();
  await user.save();

  const token = signToken(user);
  await logAction({ user, action: ACTIONS.LOGIN, description: `${user.fullName} logged in.` });

  res.json({
    success: true,
    message: 'Login successful',
    data: { token, user }
  });
});

exports.logout = wrapAsync(async (req, res) => {
  await logAction({ user: req.user, action: ACTIONS.LOGOUT, description: `${req.user.fullName} logged out.` });
  res.json({ success: true, message: 'Logged out successfully' });
});

exports.getMe = wrapAsync(async (req, res) => {
  res.json({ success: true, data: { user: req.user } });
});

exports.updateProfile = wrapAsync(async (req, res) => {
  const { fullName, email, phone } = req.body;
  const user = req.user;
  if (fullName !== undefined && !fullName.trim()) throw new ApiError(400, 'Name cannot be empty.');
  if (fullName) user.fullName = fullName.trim();
  if (email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, 'Invalid email address.');
    const existing = await User.findOne({ email: email.toLowerCase(), _id: { $ne: user._id } });
    if (existing) throw new ApiError(409, 'Email is already in use.');
    user.email = email.toLowerCase();
  }
  if (phone !== undefined) user.phone = phone;
  await user.save();
  await logAction({ user, action: ACTIONS.USER_UPDATE, entity: 'User', entityId: user._id, description: 'Updated own profile.' });
  res.json({ success: true, message: 'Profile updated', data: { user } });
});

exports.changePassword = wrapAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) throw new ApiError(400, 'Current and new passwords are required.');
  if (newPassword.length < 6) throw new ApiError(400, 'New password must be at least 6 characters.');
  const user = await User.findById(req.user._id);
  if (!(await user.comparePassword(currentPassword))) {
    throw new ApiError(401, 'Current password is incorrect.');
  }
  user.password = newPassword;
  await user.save();
  await logAction({ user, action: ACTIONS.PASSWORD_CHANGE, entity: 'User', entityId: user._id, description: 'Changed own password.' });
  res.json({ success: true, message: 'Password changed successfully' });
});
