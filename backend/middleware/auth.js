const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new ApiError(401, 'Not authenticated. Please log in.');
    }
    const token = header.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') throw new ApiError(401, 'Session expired. Please log in again.');
      throw new ApiError(401, 'Invalid authentication token.');
    }
    const user = await User.findById(decoded.id).populate('role');
    if (!user) throw new ApiError(401, 'User no longer exists.');
    if (!user.isActive) throw new ApiError(403, 'Your account has been deactivated. Contact the administrator.');
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

const isSuperAdmin = (user) => user.role && user.role.name === 'Super Admin';

const getUserPermissions = (user) => new Set(isSuperAdmin(user) ? ['*'] : (user.role?.permissions || []));

const can = (user, permission) => {
  if (!user || !user.role) return false;
  if (isSuperAdmin(user)) return true;
  return getUserPermissions(user).has(permission);
};

const authorize = (...requiredPermissions) => (req, res, next) => {
  // Access is granted when the user holds at least ONE of the required permissions
  const allowed = requiredPermissions.some((p) => can(req.user, p));
  if (!allowed) {
    return next(new ApiError(403, `Access denied. Requires one of: ${requiredPermissions.join(', ')}`));
  }
  next();
};

module.exports = { protect, authorize, isSuperAdmin, getUserPermissions, can };
