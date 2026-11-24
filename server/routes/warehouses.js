const router = require('express').Router();
const { Warehouse, Stock, User } = require('../models');
const { protect, authorize } = require('../middleware/auth');
const { httpError } = require('../utils/helpers');
const { recordActivity } = require('../services/activity');

router.use(protect);

async function syncManager(wh, prevManager) {
  if (prevManager && String(prevManager) !== String(wh.manager)) await User.updateOne({ _id: prevManager }, { $pull: { assignedWarehouses: wh._id } });
  if (wh.manager) await User.updateOne({ _id: wh.manager }, { $addToSet: { assignedWarehouses: wh._id } });
}
async function checkManager(id) {
  if (!id) return;
  const u = await User.findById(id);
  if (!u || u.role !== 'warehouseManager') throw httpError(400, 'Selected user is not a warehouse manager');
}

router.get('/', async (req, res) => {
  const f = req.user.role === 'warehouseManager' ? { _id: { $in: req.user.assignedWarehouses } } : {};
  const list = await Warehouse.find(f).populate('manager', 'name').sort('name');
  const totals = await Stock.aggregate([{ $group: { _id: '$warehouse', units: { $sum: '$quantity' }, items: { $sum: 1 } } }]);
  const map = Object.fromEntries(totals.map((t) => [String(t._id), t]));
  res.json(list.map((w) => ({ ...w.toObject(), units: map[String(w._id)]?.units || 0, items: map[String(w._id)]?.items || 0 })));
});

router.post('/', authorize('admin'), async (req, res) => {
  const { name, location, capacity, manager } = req.body;
  await checkManager(manager);
  const wh = await Warehouse.create({ name, location, capacity, manager: manager || undefined });
  await syncManager(wh);
  await recordActivity({ action: 'Warehouse created', details: `Warehouse ${wh.name} created`, user: req.user, warehouse: wh._id, entityType: 'warehouse', entityId: wh._id });
  res.status(201).json(wh);
});

router.put('/:id', authorize('admin'), async (req, res) => {
  const wh = await Warehouse.findById(req.params.id);
  if (!wh) throw httpError(404, 'Warehouse not found');
  const prev = wh.manager;
  const { name, location, capacity, manager } = req.body;
  await checkManager(manager);
  Object.assign(wh, { name, location, capacity, manager: manager || null });
  await wh.save();
  await syncManager(wh, prev);
  await recordActivity({ action: 'Warehouse updated', details: `Warehouse ${wh.name} updated`, user: req.user, warehouse: wh._id, recipients: [prev, wh.manager], entityType: 'warehouse', entityId: wh._id });
  res.json(wh);
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  const inUse = await Stock.exists({ warehouse: req.params.id, quantity: { $gt: 0 } });
  if (inUse) throw httpError(400, 'Cannot delete a warehouse that still holds stock');
  const wh = await Warehouse.findById(req.params.id);
  if (!wh) throw httpError(404, 'Warehouse not found');
  await wh.deleteOne();
  await Stock.deleteMany({ warehouse: wh._id });
  await User.updateMany({}, { $pull: { assignedWarehouses: wh._id } });
  await recordActivity({ action: 'Warehouse deleted', details: `Warehouse ${wh.name} deleted`, user: req.user, recipients: [wh.manager], entityType: 'warehouse', entityId: wh._id });
  res.json({ message: 'Warehouse deleted' });
});

module.exports = router;
