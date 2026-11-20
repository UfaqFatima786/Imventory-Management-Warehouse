const { Stock, StockTransaction, Warehouse } = require('../models');
const { httpError } = require('../utils/helpers');
const { notifyLowStock } = require('./notifications');

async function stockIn({ product, warehouse, quantity, note, user }) {
  const wh = await Warehouse.findById(warehouse);
  if (!wh) throw httpError(404, 'Warehouse not found');
  const previous = await Stock.findOne({ product, warehouse }).select('quantity');
  if (wh.capacity) {
    const [agg] = await Stock.aggregate([{ $match: { warehouse: wh._id } }, { $group: { _id: null, t: { $sum: '$quantity' } } }]);
    if ((agg?.t || 0) + quantity > wh.capacity) throw httpError(400, `Exceeds warehouse capacity (${wh.capacity} units)`);
  }
  const tx = await StockTransaction.create({ product, warehouse, transactionType: 'stock-in', quantity, note, performedBy: user._id });
  let stock;
  try {
    stock = await Stock.findOneAndUpdate({ product, warehouse }, { $inc: { quantity } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  } catch (error) {
    await StockTransaction.deleteOne({ _id: tx._id });
    throw error;
  }
  const notification = await notifyLowStock({ productId: product, warehouseId: warehouse, previousQuantity: previous?.quantity || 0, quantity: stock.quantity });
  return { stock, tx, notification };
}

// Atomic: the $gte filter guarantees stock can never go negative, even under concurrency.
async function stockOut({ product, warehouse, quantity, note, user, sendNotification = true }) {
  const tx = await StockTransaction.create({ product, warehouse, transactionType: 'stock-out', quantity, note, performedBy: user._id });
  let stock;
  try {
    stock = await Stock.findOneAndUpdate({ product, warehouse, quantity: { $gte: quantity } }, { $inc: { quantity: -quantity } }, { new: true });
  } catch (error) {
    await StockTransaction.deleteOne({ _id: tx._id });
    throw error;
  }
  if (!stock) {
    await StockTransaction.deleteOne({ _id: tx._id });
    throw httpError(400, 'Insufficient stock');
  }
  const notification = sendNotification
    ? await notifyLowStock({ productId: product, warehouseId: warehouse, previousQuantity: stock.quantity + quantity, quantity: stock.quantity })
    : undefined;
  return { stock, tx, notification };
}

async function transferStock({ product, fromWarehouse, toWarehouse, quantity, note, user }) {
  if (String(fromWarehouse) === String(toWarehouse)) throw httpError(400, 'Choose two different warehouses');
  const [source, destination] = await Promise.all([
    Warehouse.findById(fromWarehouse),
    Warehouse.findById(toWarehouse),
  ]);
  if (!source || !destination) throw httpError(404, 'Source or destination warehouse not found');

  if (destination.capacity) {
    const [agg] = await Stock.aggregate([{ $match: { warehouse: destination._id } }, { $group: { _id: null, total: { $sum: '$quantity' } } }]);
    if ((agg?.total || 0) + quantity > destination.capacity) {
      throw httpError(400, `Transfer exceeds destination capacity (${destination.capacity} units)`);
    }
  }

  const suffix = note ? ` · ${note}` : '';
  const transactions = await StockTransaction.create([
    { product, warehouse: fromWarehouse, transactionType: 'transfer-out', quantity, note: `Transfer to ${destination.name}${suffix}`, performedBy: user._id },
    { product, warehouse: toWarehouse, transactionType: 'transfer-in', quantity, note: `Transfer from ${source.name}${suffix}`, performedBy: user._id },
  ]);
  let sourceAfter;
  let destinationAfter;
  try {
    sourceAfter = await Stock.findOneAndUpdate(
      { product, warehouse: fromWarehouse, quantity: { $gte: quantity } },
      { $inc: { quantity: -quantity } },
      { new: true },
    );
    if (!sourceAfter) throw httpError(400, 'Insufficient stock at the source warehouse');
    destinationAfter = await Stock.findOneAndUpdate(
      { product, warehouse: toWarehouse },
      { $inc: { quantity } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    if (!destinationAfter) throw httpError(500, 'Could not update destination stock');
  } catch (error) {
    if (sourceAfter) await Stock.updateOne({ _id: sourceAfter._id }, { $inc: { quantity } });
    await StockTransaction.deleteMany({ _id: { $in: transactions.map((tx) => tx._id) } });
    throw error;
  }

  const notification = await notifyLowStock({
    productId: product,
    warehouseId: fromWarehouse,
    previousQuantity: sourceAfter.quantity + quantity,
    quantity: sourceAfter.quantity,
  });
  return { source: sourceAfter, destination: destinationAfter, transactions, notification };
}

async function lowStock(warehouseIds) {
  const f = warehouseIds ? { warehouse: { $in: warehouseIds } } : {};
  const rows = await Stock.find(f).populate('product', 'name sku lowStockLimit imageUrl').populate('warehouse', 'name');
  return rows.filter((s) => s.product && s.quantity <= s.product.lowStockLimit);
}

module.exports = { stockIn, stockOut, transferStock, lowStock };
