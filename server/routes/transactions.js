const router = require('express').Router();
const { StockTransaction } = require('../models');
const { protect, authorize, canAccessWarehouse, scopeWarehouseIds } = require('../middleware/auth');
const { httpError } = require('../utils/helpers');

router.get('/', protect, authorize('admin', 'warehouseManager'), async (req, res) => {
  const { warehouse, type, product } = req.query;
  const scope = scopeWarehouseIds(req.user);
  const f = {};
  if (warehouse) {
    if (!canAccessWarehouse(req.user, warehouse)) throw httpError(403, 'You are not assigned to this warehouse');
    f.warehouse = warehouse;
  } else if (scope) f.warehouse = { $in: scope };
  if (type) f.transactionType = type;
  if (product) f.product = product;
  res.json(await StockTransaction.find(f).populate('product', 'name sku').populate('warehouse', 'name').populate('performedBy', 'name role').sort('-date').limit(300));
});

module.exports = router;
