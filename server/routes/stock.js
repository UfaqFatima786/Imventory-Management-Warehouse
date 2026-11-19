const router = require('express').Router();
const { Stock, Product } = require('../models');
const { protect, authorize, canAccessWarehouse, scopeWarehouseIds } = require('../middleware/auth');
const { httpError, positiveInt, escapeRe } = require('../utils/helpers');
const { stockIn, stockOut, lowStock } = require('../services/stock');

router.use(protect);

async function validate(req) {
  const { product, warehouse, note } = req.body;
  const quantity = positiveInt(req.body.quantity);
  if (!product || !warehouse) throw httpError(400, 'Product and warehouse are required');
  if (!canAccessWarehouse(req.user, warehouse)) throw httpError(403, 'You are not assigned to this warehouse');
  if (!(await Product.exists({ _id: product }))) throw httpError(404, 'Product not found');
  return { product, warehouse, quantity, note, user: req.user };
}

router.post('/in', authorize('admin', 'warehouseManager'), async (req, res) => {
  const { stock, tx } = await stockIn(await validate(req));
  res.status(201).json({ stock, transaction: tx });
});

router.post('/out', authorize('admin', 'warehouseManager'), async (req, res) => {
  const { stock, tx } = await stockOut(await validate(req));
  res.status(201).json({ stock, transaction: tx });
});

router.get('/low', authorize('admin', 'warehouseManager'), async (req, res) => {
  res.json(await lowStock(scopeWarehouseIds(req.user)));
});

router.get('/', async (req, res) => {
  const { warehouse, q } = req.query;
  const f = {};
  if (req.user.role === 'warehouseManager') {
    if (warehouse && !canAccessWarehouse(req.user, warehouse)) throw httpError(403, 'You are not assigned to this warehouse');
    f.warehouse = warehouse || { $in: req.user.assignedWarehouses };
  } else if (!['admin', 'salesRepresentative'].includes(req.user.role)) throw httpError(403, 'Not allowed');
  else if (warehouse) f.warehouse = warehouse;
  if (q) f.product = { $in: await Product.find({ $or: [{ name: new RegExp(escapeRe(q), 'i') }, { sku: new RegExp(escapeRe(q), 'i') }] }).distinct('_id') };
  res.json(await Stock.find(f).populate('product', 'name sku category price lowStockLimit imageUrl').populate('warehouse', 'name').sort('warehouse'));
});

module.exports = router;
