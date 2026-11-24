const router = require('express').Router();
const { Stock, Product, Warehouse } = require('../models');
const { protect, authorize, canAccessWarehouse, scopeWarehouseIds } = require('../middleware/auth');
const { httpError, positiveInt, escapeRe } = require('../utils/helpers');
const { stockIn, stockOut, transferStock, lowStock } = require('../services/stock');
const { recordActivity } = require('../services/activity');

router.use(protect);

async function validate(req) {
  const { product, warehouse, note } = req.body;
  const quantity = positiveInt(req.body.quantity);
  if (!product || !warehouse) throw httpError(400, 'Product and warehouse are required');
  if (!canAccessWarehouse(req.user, warehouse)) throw httpError(403, 'You are not assigned to this warehouse');
  const productDoc = await Product.findById(product).select('name');
  if (!productDoc) throw httpError(404, 'Product not found');
  return { product, productName: productDoc.name, warehouse, quantity, note, user: req.user };
}

router.post('/in', authorize('admin', 'warehouseManager'), async (req, res) => {
  const input = await validate(req);
  const { stock, tx, notification } = await stockIn(input);
  await recordActivity({ action: 'Stock received', details: `${input.quantity} × ${input.productName} received${input.note ? ` · ${input.note}` : ''}`, user: req.user, warehouse: input.warehouse, entityType: 'stock', entityId: stock._id });
  res.status(201).json({ stock, transaction: tx, notification });
});

router.post('/out', authorize('admin', 'warehouseManager'), async (req, res) => {
  const input = await validate(req);
  const { stock, tx, notification } = await stockOut(input);
  await recordActivity({ action: 'Stock removed', details: `${input.quantity} × ${input.productName} removed${input.note ? ` · ${input.note}` : ''}`, user: req.user, warehouse: input.warehouse, entityType: 'stock', entityId: stock._id });
  res.status(201).json({ stock, transaction: tx, notification });
});

router.post('/transfer', authorize('admin', 'warehouseManager'), async (req, res) => {
  const { product, fromWarehouse, toWarehouse, note } = req.body;
  const quantity = positiveInt(req.body.quantity);
  if (!product || !fromWarehouse || !toWarehouse) throw httpError(400, 'Product, source and destination warehouses are required');
  if (!canAccessWarehouse(req.user, fromWarehouse) || !canAccessWarehouse(req.user, toWarehouse)) {
    throw httpError(403, 'You are not assigned to both warehouses');
  }
  const productDoc = await Product.findById(product).select('name sku');
  if (!productDoc) throw httpError(404, 'Product not found');
  const result = await transferStock({ product, fromWarehouse, toWarehouse, quantity, note, user: req.user });
  const warehouses = await Warehouse.find({ _id: { $in: [fromWarehouse, toWarehouse] } }).select('name');
  const from = warehouses.find((w) => String(w._id) === String(fromWarehouse));
  const to = warehouses.find((w) => String(w._id) === String(toWarehouse));
  await recordActivity({
    action: 'Stock transferred',
    details: `${quantity} × ${productDoc.name} moved from ${from?.name || 'source'} to ${to?.name || 'destination'}`,
    user: req.user,
    warehouse: fromWarehouse,
    notificationWarehouses: [fromWarehouse, toWarehouse],
    entityType: 'stock-transfer',
    entityId: result.transactions[0]._id,
  });
  res.status(201).json(result);
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
  if (q) f.product = { $in: await Product.find({ $or: [{ name: new RegExp(escapeRe(q), 'i') }, { sku: new RegExp(escapeRe(q), 'i') }, { barcode: new RegExp(escapeRe(q), 'i') }] }).distinct('_id') };
  res.json(await Stock.find(f).populate('product', 'name sku category price lowStockLimit imageUrl').populate('warehouse', 'name').sort('warehouse'));
});

module.exports = router;
