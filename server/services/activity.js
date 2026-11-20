const { ActivityLog } = require('../models');
const { notifyOperation } = require('./notifications');

async function recordActivity({
  action, details, user, warehouse, entityType, entityId,
  recipients = [], notificationWarehouses, notifyAllManagers = false, notificationLink,
}) {
  const activity = await ActivityLog.create({
    action,
    details,
    user: user?._id || user,
    warehouse: warehouse?._id || warehouse,
    entityType,
    entityId: entityId ? String(entityId) : undefined,
  });
  await notifyOperation({
    actor: user,
    recipients,
    warehouseIds: notificationWarehouses || (warehouse ? [warehouse] : []),
    notifyAllManagers,
    title: action,
    message: details,
    category: entityType,
    link: notificationLink,
    entityId,
  });
  return activity;
}

module.exports = { recordActivity };
