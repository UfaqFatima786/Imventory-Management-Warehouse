const router = require('express').Router();
const { Notification } = require('../models');
const { protect } = require('../middleware/auth');
const { httpError } = require('../utils/helpers');

router.use(protect);

router.get('/', async (req, res) => {
  const parsedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 20;
  const filter = { recipient: req.user._id };
  if (req.query.unreadOnly === 'true') filter.readAt = null;
  const [items, unreadCount] = await Promise.all([
    Notification.find(filter).populate('actor', 'name role').sort('-createdAt').limit(limit),
    Notification.countDocuments({ recipient: req.user._id, readAt: null }),
  ]);
  res.json({ items, unreadCount });
});

router.post('/read-all', async (req, res) => {
  const result = await Notification.updateMany(
    { recipient: req.user._id, readAt: null },
    { $set: { readAt: new Date() } },
  );
  res.json({ updated: result.modifiedCount });
});

router.put('/:id/read', async (req, res) => {
  const notification = await Notification.findOne({ _id: req.params.id, recipient: req.user._id });
  if (!notification) throw httpError(404, 'Notification not found');
  if (!notification.readAt) {
    notification.readAt = new Date();
    await notification.save();
  }
  res.json(notification);
});

module.exports = router;
