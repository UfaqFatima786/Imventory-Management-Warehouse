const router = require('express').Router();
const { SupplyRequest, Product } = require('../models');
const { protect, authorize, canAccessWarehouse } = require('../middleware/auth');
const { httpError, positiveInt } = require('../utils/helpers');

router.use(protect);
const populate = (q) => q.populate('supplier', 'name').populate('product', 'name sku').populate('warehouse', 'name').populate('reviewedBy', 'name');

router.post('/', authorize('supplier'), async (req, res) => {
  const { product, warehouse, note } = req.body;
  const quantity = positiveInt(req.body.quantity);
  const p = await Product.findById(product);
  if (!p || String(p.supplier) !== String(req.user._id)) throw httpError(403, 'You can only supply your own products');
  if (!warehouse) throw httpError(400, 'Select a warehouse');
  const r = await SupplyRequest.create({ supplier: req.user._id, product, warehouse, quantity, note });
  res.status(201).json(await populate(SupplyRequest.findById(r._id)));
});

router.get('/', authorize('admin', 'warehouseManager', 'supplier'), async (req, res) => {
  const f = {};
  if (req.query.status) f.status = req.query.status;
  if (req.user.role === 'supplier') f.supplier = req.user._id;
  if (req.user.role === 'warehouseManager') f.warehouse = { $in: req.user.assignedWarehouses };
  res.json(await populate(SupplyRequest.find(f).sort('-createdAt')));
});

router.put('/:id/status', authorize('admin', 'warehouseManager'), async (req, res) => {
  const { status } = req.body;
  if (!['Approved', 'Rejected'].includes(status)) throw httpError(400, 'Status must be Approved or Rejected');
  const r = await SupplyRequest.findById(req.params.id);
  if (!r) throw httpError(404, 'Request not found');
  if (!canAccessWarehouse(req.user, r.warehouse)) throw httpError(403, 'This request targets a warehouse you are not assigned to');
  const upd = await SupplyRequest.findOneAndUpdate({ _id: r._id, status: 'Pending' }, { status, reviewedBy: req.user._id }, { new: true });
  if (!upd) throw httpError(400, 'This request has already been reviewed');
  res.json(await populate(SupplyRequest.findById(upd._id)));
});

module.exports = router;
