const router = require('express').Router();
const { User, Warehouse } = require('../models');
const { protect, authorize } = require('../middleware/auth');
const { httpError, escapeRe, applyImage, assertImage, removeFile } = require('../utils/helpers');
const { recordActivity } = require('../services/activity');

router.use(protect);

// Lightweight supplier list for product/supply forms (any signed-in user)
router.get('/suppliers', async (req, res) => {
  res.json(await User.find({ role: 'supplier' }).select('name image').sort('name'));
});

router.get('/', authorize('admin'), async (req, res) => {
  const { role, q } = req.query;
  const f = {};
  if (role) f.role = role;
  if (q) f.$or = [{ name: new RegExp(escapeRe(q), 'i') }, { email: new RegExp(escapeRe(q), 'i') }];
  res.json(await User.find(f).populate('assignedWarehouses', 'name').sort('-createdAt'));
});

// Keep Warehouse.manager and User.assignedWarehouses consistent
async function syncAssignments(user) {
  const ids = user.assignedWarehouses;
  if (user.role !== 'warehouseManager') {
    user.assignedWarehouses = [];
    await user.save();
    await Warehouse.updateMany({ manager: user._id }, { manager: null });
    return;
  }
  await Warehouse.updateMany({ manager: user._id, _id: { $nin: ids } }, { manager: null });
  await Warehouse.updateMany({ _id: { $in: ids } }, { manager: user._id });
  await User.updateMany({ _id: { $ne: user._id }, assignedWarehouses: { $in: ids } }, { $pull: { assignedWarehouses: { $in: ids } } });
}

router.post('/', authorize('admin'), async (req, res) => {
  const { name, email, password, phone, role, assignedWarehouses = [], image, imageFileId } = req.body;
  if (!name || !email || !password || !role) throw httpError(400, 'Name, email, password and role are required');
  if (password.length < 6) throw httpError(400, 'Password must be at least 6 characters');
  assertImage(image);
  const user = await User.create({ name, email, password, phone, role, assignedWarehouses, image, imageFileId });
  await syncAssignments(user);
  await recordActivity({ action: 'User created', details: `User ${user.name} created with role ${user.role}`, user: req.user, recipients: [user._id], entityType: 'user', entityId: user._id });
  res.status(201).json(user);
});

router.put('/:id', async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  if (!isAdmin && String(req.user._id) !== req.params.id) throw httpError(403, 'You can only edit your own profile');
  const user = await User.findById(req.params.id);
  if (!user) throw httpError(404, 'User not found');
  const b = req.body;
  ['name', 'phone'].forEach((k) => b[k] !== undefined && (user[k] = b[k]));
  if (b.email && isAdmin) user.email = b.email;
  if (b.password) {
    if (b.password.length < 6) throw httpError(400, 'Password must be at least 6 characters');
    user.password = b.password;
  }
  await applyImage(user, b, 'image', 'imageFileId');
  if (isAdmin) {
    if (b.role) user.role = b.role;
    if (b.assignedWarehouses) user.assignedWarehouses = b.assignedWarehouses;
  }
  await user.save();
  if (isAdmin) await syncAssignments(user);
  await recordActivity({ action: 'User updated', details: `User ${user.name} profile updated`, user: req.user, recipients: [user._id], entityType: 'user', entityId: user._id });
  res.json(await User.findById(user._id).populate('assignedWarehouses', 'name'));
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  if (String(req.user._id) === req.params.id) throw httpError(400, 'You cannot delete your own account');
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw httpError(404, 'User not found');
  await removeFile(user.imageFileId);
  await Warehouse.updateMany({ manager: user._id }, { manager: null });
  await recordActivity({ action: 'User deleted', details: `User ${user.name} deleted`, user: req.user, entityType: 'user', entityId: user._id });
  res.json({ message: 'User deleted' });
});

module.exports = router;
