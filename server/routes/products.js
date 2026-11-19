const router = require('express').Router();
const { Product, Stock } = require('../models');
const { protect, authorize } = require('../middleware/auth');
const { httpError, escapeRe, assertImage, applyImage, removeFile } = require('../utils/helpers');

router.use(protect);
const editors = authorize('admin', 'warehouseManager');
const FIELDS = ['name', 'description', 'sku', 'category', 'price', 'lowStockLimit', 'supplier'];

router.get('/categories', async (req, res) => res.json((await Product.distinct('category')).filter(Boolean).sort()));

router.get('/', async (req, res) => {
  const { q, category, supplier, warehouse } = req.query;
  const f = {};
  if (req.user.role === 'supplier') f.supplier = req.user._id; // suppliers only see their own products
  else if (supplier) f.supplier = supplier;
  if (category) f.category = category;
  if (q) f.$or = [{ name: new RegExp(escapeRe(q), 'i') }, { sku: new RegExp(escapeRe(q), 'i') }];
  const products = await Product.find(f).populate('supplier', 'name').sort('-createdAt');
  const match = warehouse ? { $match: { warehouse: new (require('mongoose').Types.ObjectId)(warehouse) } } : { $match: {} };
  const totals = await Stock.aggregate([match, { $group: { _id: '$product', total: { $sum: '$quantity' } } }]);
  const map = Object.fromEntries(totals.map((t) => [String(t._id), t.total]));
  res.json(products.map((p) => ({ ...p.toObject(), availableStock: map[String(p._id)] || 0 })));
});

router.get('/:id', async (req, res) => {
  const product = await Product.findById(req.params.id).populate('supplier', 'name');
  if (!product) throw httpError(404, 'Product not found');
  if (req.user.role === 'supplier' && String(product.supplier?._id) !== String(req.user._id)) throw httpError(403, 'Not your product');
  const stock = await Stock.find({ product: product._id }).populate('warehouse', 'name location');
  res.json({ product, stock });
});

router.post('/', editors, async (req, res) => {
  const b = req.body;
  assertImage(b.imageUrl);
  const data = { createdBy: req.user._id, imageUrl: b.imageUrl, imageFileId: b.imageFileId };
  FIELDS.forEach((k) => b[k] !== undefined && b[k] !== '' && (data[k] = b[k]));
  res.status(201).json(await Product.create(data));
});

router.put('/:id', editors, async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw httpError(404, 'Product not found');
  FIELDS.forEach((k) => req.body[k] !== undefined && (product[k] = req.body[k] === '' ? undefined : req.body[k]));
  await applyImage(product, req.body, 'imageUrl', 'imageFileId');
  await product.save();
  res.json(product);
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw httpError(404, 'Product not found');
  await Stock.deleteMany({ product: product._id });
  await removeFile(product.imageFileId);
  res.json({ message: 'Product deleted' });
});

module.exports = router;
