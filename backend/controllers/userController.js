const User = require('../models/User');
const Role = require('../models/Role');
const ApiError = require('../utils/ApiError');
const { logAction, ACTIONS } = require('../services/auditService');
const { wrapAsync } = require('../middleware/errorHandler');
const { isSuperAdmin } = require('../middleware/auth');

exports.list = wrapAsync(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const search = req.query.search?.trim();
  const filter = {};
  if (search) filter.$or = [
    { fullName: new RegExp(search, 'i') },
    { username: new RegExp(search, 'i') },
    { email: new RegExp(search, 'i') }
  ];

  const [users, total] = await Promise.all([
    User.find(filter).populate('role').populate('addedBy', 'fullName username').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter)
  ]);

  res.json({ success: true, data: { users, total, page, pages: Math.ceil(total / limit) } });
});

exports.getOne = wrapAsync(async (req, res) => {
  const user = await User.findById(req.params.id).populate('role');
  if (!user) throw new ApiError(404, 'User not found.');
  res.json({ success: true, data: { user } });
});

exports.create = wrapAsync(async (req, res) => {
  const { fullName, username, email, phone, password, role: roleId } = req.body;
  if (!fullName || !username || !email || !password || !roleId) {
    throw new ApiError(400, 'Full name, username, email, password and role are required.');
  }
  if (password.length < 6) throw new ApiError(400, 'Password must be at least 6 characters.');
  const role = await Role.findById(roleId);
  if (!role) throw new ApiError(404, 'Role not found.');
  if (role.name === 'Super Admin' && !isSuperAdmin(req.user)) {
    throw new ApiError(403, 'Only a Super Admin can create Super Admin accounts.');
  }

  const user = await User.create({ fullName, username, email, phone, password, role: roleId, addedBy: req.user._id });
  await user.populate('role');
  await logAction({
    user: req.user, action: ACTIONS.USER_CREATE, entity: 'User', entityId: user._id,
    description: `Created user "${user.fullName}" (${user.username}) with role ${role.name}.`
  });
  res.status(201).json({ success: true, message: 'User created', data: { user } });
});

exports.update = wrapAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found.');
  if (!isSuperAdmin(req.user)) {
    const targetRole = await Role.findById(user.role);
    if (targetRole?.name === 'Super Admin') throw new ApiError(403, 'Cannot modify Super Admin accounts.');
  }
  const { fullName, email, phone, role: roleId, isActive } = req.body;
  if (fullName !== undefined) user.fullName = fullName;
  if (email !== undefined) user.email = String(email).toLowerCase();
  if (phone !== undefined) user.phone = phone;
  if (isActive !== undefined) user.isActive = Boolean(isActive);
  if (roleId) {
    const role = await Role.findById(roleId);
    if (!role) throw new ApiError(404, 'Role not found.');
    if (role.name === 'Super Admin' && !isSuperAdmin(req.user)) {
      throw new ApiError(403, 'Only a Super Admin can assign the Super Admin role.');
    }
    user.role = roleId;
  }
  await user.save();
  await user.populate('role');
  await logAction({
    user: req.user, action: ACTIONS.USER_UPDATE, entity: 'User', entityId: user._id,
    description: `Updated user "${user.fullName}".`
  });
  res.json({ success: true, message: 'User updated', data: { user } });
});

exports.remove = wrapAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found.');
  if (String(user._id) === String(req.user._id)) throw new ApiError(400, 'You cannot delete your own account.');
  const targetRole = await Role.findById(user.role);
  if (targetRole?.name === 'Super Admin') {
    throw new ApiError(400, 'Super Admin accounts cannot be deleted. Deactivate the account instead if needed.');
  }
  await user.deleteOne();
  await logAction({
    user: req.user, action: ACTIONS.USER_DELETE, entity: 'User', entityId: user._id,
    description: `Deleted user "${user.fullName}" (@${user.username}).`
  });
  res.json({ success: true, message: 'User deleted' });
});

exports.resetPassword = wrapAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found.');
  const tempPassword = `Bc@${Math.random().toString(36).slice(-8)}1`;
  user.password = tempPassword;
  await user.save();
  await logAction({
    user: req.user, action: ACTIONS.PASSWORD_RESET, entity: 'User', entityId: user._id,
    description: `Reset password for "${user.fullName}".`
  });
  res.json({ success: true, message: 'Password reset. Share the temporary password securely.', data: { temporaryPassword: tempPassword } });
});
