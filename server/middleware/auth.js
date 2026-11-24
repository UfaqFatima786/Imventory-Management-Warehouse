const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { httpError } = require('../utils/helpers');

exports.protect = async (req, res, next) => {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) throw httpError(401, 'Not authenticated');
  let id;
  try { ({ id } = jwt.verify(h.slice(7), process.env.JWT_SECRET)); } catch { throw httpError(401, 'Invalid or expired token'); }
  const user = await User.findById(id);
  if (!user) throw httpError(401, 'User no longer exists');
  req.user = user;
  next();
};
// Server-side role check (frontend route protection is NOT relied upon)
exports.authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) throw httpError(403, 'You do not have permission to do this');
  next();
};
// Admin: any warehouse. Manager: only assigned ones.
exports.canAccessWarehouse = (user, warehouseId) =>
  user.role === 'admin' || (user.role === 'warehouseManager' && user.assignedWarehouses.some((w) => String(w) === String(warehouseId)));
exports.scopeWarehouseIds = (user) => (user.role === 'admin' ? null : user.assignedWarehouses); // null = unrestricted
