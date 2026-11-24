const router = require('express').Router();
const { Product, Stock } = require('../models');
const { protect, authorize, canAccessWarehouse } = require('../middleware/auth');
const { httpError, escapeRe, assertImage, applyImage, removeFile } = require('../utils/helpers');
const { recordActivity } = require('../services/activity');

router.use(protect);
const editors = authorize('admin', 'warehouseManager');
const FIELDS = ['name', 'description', 'sku', 'barcode', 'category', 'price', 'lowStockLimit', 'supplier'];

router.get('/categories', async (req, res) => res.json((await Product.distinct('category')).filter(Boolean).sort()));

router.get('/', async (req, res) => {
  const { q, category, supplier, warehouse, availability } = req.query;
  const f = {};
  if (req.user.role === 'supplier') f.supplier = req.user._id; // suppliers only see their own products
  else if (supplier) f.supplier = supplier;
  if (category) f.category = category;
  if (q) f.$or = [{ name: new RegExp(escapeRe(q), 'i') }, { sku: new RegExp(escapeRe(q), 'i') }, { barcode: new RegExp(escapeRe(q), 'i') }];
  const products = await Product.find(f).populate('supplier', 'name').sort('-createdAt');
  if (warehouse && req.user.role === 'warehouseManager' && !canAccessWarehouse(req.user, warehouse)) {
    throw httpError(403, 'You are not assigned to this warehouse');
  }
  const scopedWarehouses = warehouse
    ? [new (require('mongoose').Types.ObjectId)(warehouse)]
    : req.user.role === 'warehouseManager'
      ? req.user.assignedWarehouses
      : null;
  const match = scopedWarehouses ? { $match: { warehouse: { $in: scopedWarehouses } } } : { $match: {} };
  const totals = await Stock.aggregate([match, { $group: { _id: '$product', total: { $sum: '$quantity' } } }]);
  const map = Object.fromEntries(totals.map((t) => [String(t._id), t.total]));
  const result = products.map((p) => ({ ...p.toObject(), availableStock: map[String(p._id)] || 0 }));
  res.json(result.filter((p) => {
    if (availability === 'in-stock') return p.availableStock > 0;
    if (availability === 'low-stock') return p.availableStock > 0 && p.availableStock <= p.lowStockLimit;
    if (availability === 'out-of-stock') return p.availableStock === 0;
    return true;
  }));
});

router.get('/:id', async (req, res) => {
  const product = await Product.findById(req.params.id).populate('supplier', 'name');
  if (!product) throw httpError(404, 'Product not found');
  if (req.user.role === 'supplier' && String(product.supplier?._id) !== String(req.user._id)) throw httpError(403, 'Not your product');
  const stockFilter = { product: product._id };
  if (req.user.role === 'warehouseManager') stockFilter.warehouse = { $in: req.user.assignedWarehouses };
  const stock = await Stock.find(stockFilter).populate('warehouse', 'name location');
  res.json({ product, stock });
});

router.post('/', editors, async (req, res) => {
  const b = req.body;
  assertImage(b.imageUrl);
  const data = { createdBy: req.user._id, imageUrl: b.imageUrl, imageFileId: b.imageFileId };
  FIELDS.forEach((k) => b[k] !== undefined && b[k] !== '' && (data[k] = b[k]));
  const product = await Product.create(data);
  await recordActivity({ action: 'Product created', details: `Product ${product.name} (${product.sku}) created`, user: req.user, recipients: [product.supplier], notifyAllManagers: true, entityType: 'product', entityId: product._id });
  res.status(201).json(product);
});

router.put('/:id', editors, async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw httpError(404, 'Product not found');
  FIELDS.forEach((k) => req.body[k] !== undefined && (product[k] = req.body[k] === '' ? undefined : req.body[k]));
  await applyImage(product, req.body, 'imageUrl', 'imageFileId');
  await product.save();
  await recordActivity({ action: 'Product updated', details: `Product ${product.name} (${product.sku}) updated`, user: req.user, recipients: [product.supplier], notifyAllManagers: true, entityType: 'product', entityId: product._id });
  res.json(product);
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw httpError(404, 'Product not found');
  await Stock.deleteMany({ product: product._id });
  await removeFile(product.imageFileId);
  await recordActivity({ action: 'Product deleted', details: `Product ${product.name} (${product.sku}) deleted`, user: req.user, recipients: [product.supplier], notifyAllManagers: true, entityType: 'product', entityId: product._id });
  res.json({ message: 'Product deleted' });
});

module.exports = router;
