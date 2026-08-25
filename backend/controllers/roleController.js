const Role = require('../models/Role');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { ALL_PERMISSIONS } = require('../utils/permissions');
const { logAction, ACTIONS } = require('../services/auditService');
const { wrapAsync } = require('../middleware/errorHandler');

exports.list = wrapAsync(async (req, res) => {
  const roles = await Role.find().sort({ name: 1 });
  const counts = await User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]);
  const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));
  res.json({
    success: true,
    data: {
      roles: roles.map((r) => ({ ...r.toJSON(), userCount: countMap[String(r._id)] || 0 })),
      allPermissions: ALL_PERMISSIONS
    }
  });
});

exports.create = wrapAsync(async (req, res) => {
  const { name, description, permissions } = req.body;
  if (!name?.trim()) throw new ApiError(400, 'Role name is required.');
  const invalid = (permissions || []).filter((p) => !ALL_PERMISSIONS.includes(p));
  if (invalid.length) throw new ApiError(400, `Unknown permissions: ${invalid.join(', ')}`);
  const role = await Role.create({ name: name.trim(), description, permissions: permissions || [] });
  await logAction({ user: req.user, action: ACTIONS.ROLE_CREATE, entity: 'Role', entityId: role._id, description: `Created role "${role.name}".` });
  res.status(201).json({ success: true, message: 'Role created', data: { role } });
});

exports.update = wrapAsync(async (req, res) => {
  const role = await Role.findById(req.params.id);
  if (!role) throw new ApiError(404, 'Role not found.');
  if (role.isSystem && role.name === 'Super Admin') {
    throw new ApiError(400, 'The Super Admin role cannot be modified.');
  }
  const { name, description, permissions } = req.body;
  if (name !== undefined) role.name = name.trim();
  if (description !== undefined) role.description = description;
  if (permissions !== undefined) {
    const invalid = permissions.filter((p) => !ALL_PERMISSIONS.includes(p));
    if (invalid.length) throw new ApiError(400, `Unknown permissions: ${invalid.join(', ')}`);
    role.permissions = permissions;
  }
  await role.save();
  await logAction({ user: req.user, action: ACTIONS.ROLE_UPDATE, entity: 'Role', entityId: role._id, description: `Updated role "${role.name}".` });
  res.json({ success: true, message: 'Role updated', data: { role } });
});

exports.remove = wrapAsync(async (req, res) => {
  const role = await Role.findById(req.params.id);
  if (!role) throw new ApiError(404, 'Role not found.');
  if (role.isSystem) throw new ApiError(400, 'System roles cannot be deleted.');
  const inUse = await User.countDocuments({ role: role._id });
  if (inUse > 0) throw new ApiError(400, `${inUse} user(s) still have this role. Reassign them first.`);
  await role.deleteOne();
  await logAction({ user: req.user, action: ACTIONS.ROLE_DELETE, entity: 'Role', description: `Deleted role "${role.name}".` });
  res.json({ success: true, message: 'Role deleted' });
});
