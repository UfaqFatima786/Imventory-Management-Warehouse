const router = require('express').Router();
const { User, Product, Warehouse, Order, Stock, StockTransaction, SupplyRequest } = require('../models');
const { protect, scopeWarehouseIds } = require('../middleware/auth');
const { lowStock } = require('../services/stock');
const { httpError } = require('../utils/helpers');

router.get('/analytics', protect, async (req, res) => {
  if (!['admin', 'warehouseManager'].includes(req.user.role)) throw httpError(403, 'Not allowed');
  const warehouseIds = scopeWarehouseIds(req.user);
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const monthKeys = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + index, 1));
    return date.toISOString().slice(0, 7);
  });
  const orderMatch = {
    status: 'Completed',
    $or: [{ completedAt: { $gte: from } }, { completedAt: { $exists: false }, createdAt: { $gte: from } }],
  };
  if (warehouseIds) orderMatch.warehouse = { $in: warehouseIds };
  const transactionMatch = { date: { $gte: from } };
  if (warehouseIds) transactionMatch.warehouse = { $in: warehouseIds };

  const [sales, movement, topProducts] = await Promise.all([
    Order.aggregate([
      { $match: orderMatch },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: { $ifNull: ['$completedAt', '$createdAt'] }, timezone: 'UTC' } }, total: { $sum: '$totalAmount' } } },
    ]),
    StockTransaction.aggregate([
      { $match: transactionMatch },
      { $group: {
        _id: {
          month: { $dateToString: { format: '%Y-%m', date: '$date', timezone: 'UTC' } },
          type: '$transactionType',
        },
        quantity: { $sum: '$quantity' },
      } },
    ]),
    Order.aggregate([
      { $match: { ...orderMatch, status: 'Completed' } },
      { $unwind: '$products' },
      { $group: { _id: '$products.product', quantity: { $sum: '$products.quantity' }, revenue: { $sum: { $multiply: ['$products.quantity', '$products.price'] } } } },
      { $sort: { quantity: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
      { $unwind: '$product' },
      { $project: { _id: 0, name: '$product.name', sku: '$product.sku', quantity: 1, revenue: 1 } },
    ]),
  ]);
  const salesMap = Object.fromEntries(sales.map((row) => [row._id, row.total]));
  const movementMap = {};
  movement.forEach((row) => {
    const { month, type } = row._id;
    movementMap[month] ||= { stockIn: 0, stockOut: 0, transferIn: 0, transferOut: 0 };
    const field = { 'stock-in': 'stockIn', 'stock-out': 'stockOut', 'transfer-in': 'transferIn', 'transfer-out': 'transferOut' }[type];
    if (field) movementMap[month][field] = row.quantity;
  });
  res.json({
    months: monthKeys.map((month) => ({ month, sales: salesMap[month] || 0 })),
    movement: monthKeys.map((month) => ({ month, ...(movementMap[month] || { stockIn: 0, stockOut: 0, transferIn: 0, transferOut: 0 }) })),
    topProducts,
  });
});

const recent = (f) => Order.find(f).populate('warehouse', 'name').sort('-createdAt').limit(5);

router.get('/', protect, async (req, res) => {
  const u = req.user;
  if (u.role === 'admin') {
    const [users, products, warehouses, suppliers, orders, low, pending] = await Promise.all([
      User.countDocuments(), Product.countDocuments(), Warehouse.countDocuments(), User.countDocuments({ role: 'supplier' }),
      Order.countDocuments(), lowStock(null), SupplyRequest.countDocuments({ status: 'Pending' }),
    ]);
    return res.json({
      cards: [
        { label: 'Users', value: users }, { label: 'Products', value: products }, { label: 'Warehouses', value: warehouses },
        { label: 'Suppliers', value: suppliers }, { label: 'Orders', value: orders },
        { label: 'Low-stock products', value: low.length, tone: low.length ? 'warn' : '' }, { label: 'Pending supply requests', value: pending },
      ],
      lowStock: low.slice(0, 5), recentOrders: await recent({}),
    });
  }
  if (u.role === 'warehouseManager') {
    const ids = scopeWarehouseIds(u);
    const [rows, low, tx, pending] = await Promise.all([
      Stock.find({ warehouse: { $in: ids } }), lowStock(ids), StockTransaction.countDocuments({ warehouse: { $in: ids } }),
      SupplyRequest.countDocuments({ warehouse: { $in: ids }, status: 'Pending' }),
    ]);
    return res.json({
      cards: [
        { label: 'Assigned warehouses', value: ids.length }, { label: 'Products stocked', value: rows.length },
        { label: 'Units on hand', value: rows.reduce((s, r) => s + r.quantity, 0) },
        { label: 'Low-stock products', value: low.length, tone: low.length ? 'warn' : '' },
        { label: 'Transactions', value: tx }, { label: 'Supply requests to review', value: pending },
      ],
      lowStock: low.slice(0, 5), recentOrders: await recent({ warehouse: { $in: ids } }),
    });
  }
  if (u.role === 'supplier') {
    const [products, p, a, r] = await Promise.all([
      Product.countDocuments({ supplier: u._id }),
      ...['Pending', 'Approved', 'Rejected'].map((status) => SupplyRequest.countDocuments({ supplier: u._id, status })),
    ]);
    return res.json({ cards: [{ label: 'My products', value: products }, { label: 'Pending requests', value: p }, { label: 'Approved', value: a }, { label: 'Rejected', value: r }] });
  }
  const mine = await Order.find({ createdBy: u._id });
  const count = (s) => mine.filter((o) => o.status === s).length;
  res.json({
    cards: [
      { label: 'My orders', value: mine.length }, { label: 'Pending', value: count('Pending') }, { label: 'Processing', value: count('Processing') },
      { label: 'Completed', value: count('Completed') },
      { label: 'Completed sales (Rs.)', value: mine.filter((o) => o.status === 'Completed').reduce((s, o) => s + o.totalAmount, 0).toLocaleString('en-PK') },
    ],
    recentOrders: await recent({ createdBy: u._id }),
  });
});

module.exports = router;
