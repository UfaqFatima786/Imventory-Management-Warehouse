const nodemailer = require('nodemailer');
const { Product, Warehouse, User, Notification } = require('../models');

let transport;
const ENTITY_LINKS = {
  stock: '/inventory',
  'stock-transfer': '/transactions',
  order: '/orders',
  product: '/products',
  warehouse: '/warehouses',
  'supply-request': '/supply',
  user: '/users',
};

async function notifyOperation({ actor, recipients = [], roles = ['admin'], warehouseIds = [], notifyAllManagers = false, title, message, category, link, entityId }) {
  const filters = [];
  if (roles.length) filters.push({ role: { $in: roles } });
  if (warehouseIds.length) filters.push({ role: 'warehouseManager', assignedWarehouses: { $in: warehouseIds } });
  if (notifyAllManagers) filters.push({ role: 'warehouseManager' });

  const relatedUsers = filters.length ? await User.find({ $or: filters }).select('_id').lean() : [];
  const actorId = actor?._id || actor;
  const explicitRecipients = recipients.filter(Boolean).map((recipient) => String(recipient?._id || recipient));
  const recipientIds = new Set([
    ...relatedUsers.map((user) => String(user._id)),
    ...explicitRecipients,
  ]);
  if (actorId) recipientIds.add(String(actorId));
  if (!recipientIds.size) return [];

  const notifications = [...recipientIds].map((recipient) => ({
    recipient,
    actor: actorId,
    title,
    message,
    category: category || 'activity',
    link: link || (category === 'user' && recipient === String(actorId) ? '/profile' : ENTITY_LINKS[category] || '/'),
    entityId: entityId ? String(entityId) : undefined,
  }));
  return Notification.insertMany(notifications);
}

function getTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 587);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transport;
}

async function notifyLowStock({ productId, warehouseId, previousQuantity, quantity }) {
  let product;
  try {
    product = await Product.findById(productId).select('name sku lowStockLimit');
  } catch (error) {
    console.error('Low-stock email preparation failed:', error.message);
    return { sent: false, reason: 'Could not load product details' };
  }
  if (!product || quantity > product.lowStockLimit ||
      !(previousQuantity > product.lowStockLimit || previousQuantity === 0)) return { sent: false };

  await notifyOperation({
    warehouseIds: [warehouseId],
    title: 'Low stock alert',
    message: `${product.name} (${product.sku}) is at ${quantity} units. Limit: ${product.lowStockLimit}.`,
    category: 'stock',
    link: '/low-stock',
  });

  const mailer = getTransport();
  if (!mailer || !process.env.SMTP_FROM) {
    console.warn(`Low-stock email not sent for ${product.sku}: SMTP_HOST, SMTP_USER, SMTP_PASS and SMTP_FROM must be configured`);
    return { sent: false, reason: 'SMTP is not configured' };
  }

  let admins;
  let warehouse;
  try {
    [admins, warehouse] = await Promise.all([
      User.find({ role: 'admin' }).select('email'),
      Warehouse.findById(warehouseId).select('name'),
    ]);
  } catch (error) {
    console.error('Low-stock email preparation failed:', error.message);
    return { sent: false, reason: 'Could not load notification recipients' };
  }
  const recipients = admins.map((admin) => admin.email).filter(Boolean);
  if (!recipients.length) return { sent: false, reason: 'No administrator email addresses found' };

  try {
    await mailer.sendMail({
      from: process.env.SMTP_FROM,
      to: recipients,
      subject: `Low stock alert: ${product.name}`,
      text: `${product.name} (${product.sku}) at ${warehouse?.name || 'a warehouse'} is at ${quantity} units. Low-stock limit: ${product.lowStockLimit}.`,
    });
    return { sent: true };
  } catch (error) {
    console.error('Low-stock email delivery failed:', error.message);
    return { sent: false, reason: 'Email delivery failed' };
  }
}

module.exports = { notifyLowStock, notifyOperation };
