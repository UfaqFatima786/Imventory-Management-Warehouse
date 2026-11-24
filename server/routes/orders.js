const router = require('express').Router();
const { Order, Product, Stock, StockTransaction } = require('../models');
const { protect, authorize, canAccessWarehouse } = require('../middleware/auth');
const { httpError, positiveInt } = require('../utils/helpers');
const { stockOut } = require('../services/stock');
const { recordActivity } = require('../services/activity');
const { notifyLowStock } = require('../services/notifications');

router.use(protect);

const populate = (q) => q.populate('createdBy', 'name email').populate('warehouse', 'name').populate('products.product', 'name sku imageUrl');
const canSee = (user, o) =>
  user.role === 'admin' ||
  (user.role === 'salesRepresentative' && String(o.createdBy._id || o.createdBy) === String(user._id)) ||
  (user.role === 'warehouseManager' && canAccessWarehouse(user, o.warehouse._id || o.warehouse));

router.post('/', authorize('salesRepresentative'), async (req, res) => {
  const { customerName, customerPhone, warehouse, products } = req.body;
  if (!customerName) throw httpError(400, 'Customer name is required');
  if (!warehouse) throw httpError(400, 'Select a warehouse');
  if (!Array.isArray(products) || !products.length) throw httpError(400, 'Add at least one product');

  const wanted = new Map(); // merge duplicate lines
  for (const l of products) wanted.set(String(l.product), (wanted.get(String(l.product)) || 0) + positiveInt(l.quantity));

  const lines = [];
  for (const [pid, quantity] of wanted) {
    const product = await Product.findById(pid);
    if (!product) throw httpError(404, 'A selected product no longer exists');
    const stock = await Stock.findOne({ product: pid, warehouse });
    const available = stock?.quantity || 0;
    if (available < quantity) throw httpError(400, `Insufficient stock for ${product.name}: requested ${quantity}, available ${available}`);
    lines.push({ product: pid, quantity, price: product.price }); // price always taken from the server
  }
  const totalAmount = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const order = await Order.create({
    orderNumber: `ORD-${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`,
    customerName, customerPhone, warehouse, products: lines, totalAmount, createdBy: req.user._id, status: 'Pending',
  });
  await recordActivity({ action: 'Order created', details: `Order ${order.orderNumber} for ${customerName} created`, user: req.user, warehouse, entityType: 'order', entityId: order._id });
  res.status(201).json(await populate(Order.findById(order._id)));
});

router.get('/', authorize('admin', 'warehouseManager', 'salesRepresentative'), async (req, res) => {
  const f = {};
  if (req.query.status) f.status = req.query.status;
  if (req.user.role === 'salesRepresentative') f.createdBy = req.user._id;
  if (req.user.role === 'warehouseManager') f.warehouse = { $in: req.user.assignedWarehouses };
  res.json(await populate(Order.find(f).sort('-createdAt')));
});

router.get('/:id', async (req, res) => {
  const order = await populate(Order.findById(req.params.id));
  if (!order) throw httpError(404, 'Order not found');
  if (!canSee(req.user, order)) throw httpError(403, 'You cannot view this order');
  res.json(order);
});

const FLOW = { Pending: ['Processing', 'Cancelled'], Processing: ['Completed'] };

router.put('/:id/status', authorize('admin', 'warehouseManager'), async (req, res) => {
  const next = req.body.status;
  const order = await Order.findById(req.params.id);
  if (!order) throw httpError(404, 'Order not found');
  if (!canAccessWarehouse(req.user, order.warehouse)) throw httpError(403, 'This order belongs to a warehouse you are not assigned to');
  if (!FLOW[order.status]?.includes(next)) throw httpError(400, `Cannot change an order from ${order.status} to ${next}`);

  if (next !== 'Processing') {
    const update = { status: next };
    if (next === 'Completed') update.completedAt = new Date();
    const upd = await Order.findOneAndUpdate({ _id: order._id, status: order.status }, update, { new: true });
    if (!upd) throw httpError(409, 'Order status changed in the meantime');
    await recordActivity({ action: 'Order status changed', details: `Order ${order.orderNumber} marked ${next}`, user: req.user, warehouse: order.warehouse, recipients: [order.createdBy], entityType: 'order', entityId: order._id });
    return res.json(upd);
  }

  // Claim the Pending -> Processing transition atomically so stock is deducted exactly once.
  const claimed = await Order.findOneAndUpdate({ _id: order._id, status: 'Pending' }, { status: 'Processing' }, { new: true });
  if (!claimed) throw httpError(409, 'Order has already been processed');
  const done = [];
  try {
    for (const l of order.products) {
      const r = await stockOut({ product: l.product, warehouse: order.warehouse, quantity: l.quantity, note: `Order ${order.orderNumber}`, user: req.user, sendNotification: false });
      done.push({ l, tx: r.tx, stock: r.stock });
    }
  } catch (e) {
    for (const { l, tx } of done) { // roll back partial deductions
      await Stock.updateOne({ product: l.product, warehouse: order.warehouse }, { $inc: { quantity: l.quantity } });
      await StockTransaction.deleteOne({ _id: tx._id });
    }
    await Order.updateOne({ _id: order._id }, { status: 'Pending' });
    throw httpError(400, 'Cannot process order: insufficient stock for one or more products');
  }
  await Promise.all(done.map(({ l, stock }) => notifyLowStock({
    productId: l.product,
    warehouseId: order.warehouse,
    previousQuantity: stock.quantity + l.quantity,
    quantity: stock.quantity,
  })));
  await recordActivity({ action: 'Order processed', details: `Order ${order.orderNumber} processed and stock deducted`, user: req.user, warehouse: order.warehouse, recipients: [order.createdBy], entityType: 'order', entityId: order._id });
  res.json(claimed);
});

router.put('/:id/cancel', authorize('admin', 'salesRepresentative'), async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw httpError(404, 'Order not found');
  if (req.user.role === 'salesRepresentative' && String(order.createdBy) !== String(req.user._id)) throw httpError(403, 'You can only cancel your own orders');
  const upd = await Order.findOneAndUpdate({ _id: order._id, status: 'Pending' }, { status: 'Cancelled' }, { new: true });
  if (!upd) throw httpError(400, 'Only orders that have not been processed can be cancelled');
  await recordActivity({ action: 'Order cancelled', details: `Order ${order.orderNumber} cancelled`, user: req.user, warehouse: order.warehouse, recipients: [order.createdBy], entityType: 'order', entityId: order._id });
  res.json(upd);
});

module.exports = router;
