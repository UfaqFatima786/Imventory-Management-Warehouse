const router = require('express').Router();
const { ActivityLog } = require('../models');
const { protect, authorize, canAccessWarehouse, scopeWarehouseIds } = require('../middleware/auth');
const { httpError } = require('../utils/helpers');

router.get('/', protect, authorize('admin', 'warehouseManager'), async (req, res) => {
  const { warehouse, action } = req.query;
  const scope = scopeWarehouseIds(req.user);
  const filter = {};
  if (warehouse) {
    if (!canAccessWarehouse(req.user, warehouse)) throw httpError(403, 'You are not assigned to this warehouse');
    filter.warehouse = warehouse;
  } else if (scope) {
    filter.$or = [{ warehouse: { $in: scope } }, { warehouse: null }];
  }
  if (action) filter.action = action;
  const logs = await ActivityLog.find(filter)
    .populate('user', 'name role')
    .populate('warehouse', 'name')
    .sort('-createdAt')
    .limit(300);
  res.json(logs);
});

module.exports = router;
