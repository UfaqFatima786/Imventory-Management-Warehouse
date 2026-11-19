const { Stock, StockTransaction, Warehouse } = require('../models');
const { httpError } = require('../utils/helpers');

async function stockIn({ product, warehouse, quantity, note, user }) {
  const wh = await Warehouse.findById(warehouse);
  if (!wh) throw httpError(404, 'Warehouse not found');
  if (wh.capacity) {
    const [agg] = await Stock.aggregate([{ $match: { warehouse: wh._id } }, { $group: { _id: null, t: { $sum: '$quantity' } } }]);
    if ((agg?.t || 0) + quantity > wh.capacity) throw httpError(400, `Exceeds warehouse capacity (${wh.capacity} units)`);
  }
  const stock = await Stock.findOneAndUpdate({ product, warehouse }, { $inc: { quantity } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  const tx = await StockTransaction.create({ product, warehouse, transactionType: 'stock-in', quantity, note, performedBy: user._id });
  return { stock, tx };
}

// Atomic: the $gte filter guarantees stock can never go negative, even under concurrency.
async function stockOut({ product, warehouse, quantity, note, user }) {
  const stock = await Stock.findOneAndUpdate({ product, warehouse, quantity: { $gte: quantity } }, { $inc: { quantity: -quantity } }, { new: true });
  if (!stock) throw httpError(400, 'Insufficient stock');
  const tx = await StockTransaction.create({ product, warehouse, transactionType: 'stock-out', quantity, note, performedBy: user._id });
  return { stock, tx };
}

async function lowStock(warehouseIds) {
  const f = warehouseIds ? { warehouse: { $in: warehouseIds } } : {};
  const rows = await Stock.find(f).populate('product', 'name sku lowStockLimit imageUrl').populate('warehouse', 'name');
  return rows.filter((s) => s.product && s.quantity <= s.product.lowStockLimit);
}

module.exports = { stockIn, stockOut, lowStock };
