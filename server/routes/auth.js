const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { protect } = require('../middleware/auth');
const { httpError } = require('../utils/helpers');
const { recordActivity } = require('../services/activity');

const sign = (u) => jwt.sign({ id: u._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const PUBLIC_ROLES = ['warehouseManager', 'supplier', 'salesRepresentative']; // never admin

router.post('/register', async (req, res) => {
  const { name, email, password, phone, role = 'salesRepresentative' } = req.body;
  if (!name || !email || !password) throw httpError(400, 'Name, email and password are required');
  if (password.length < 6) throw httpError(400, 'Password must be at least 6 characters');
  if (!PUBLIC_ROLES.includes(role)) throw httpError(403, 'This role cannot be self-registered');
  if (await User.findOne({ email })) throw httpError(409, 'Email is already registered');
  const user = await User.create({ name, email, password, phone, role });
  await recordActivity({ action: 'User registered', details: `${user.name} registered a ${user.role} account`, user, entityType: 'user', entityId: user._id, notificationLink: '/profile' });
  res.status(201).json({ token: sign(user), user });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: String(email || '').toLowerCase() }).select('+password');
  if (!user || !(await bcrypt.compare(password || '', user.password))) throw httpError(401, 'Invalid email or password');
  await user.populate('assignedWarehouses', 'name location');
  res.json({ token: sign(user), user });
});

router.get('/me', protect, async (req, res) => {
  await req.user.populate('assignedWarehouses', 'name location');
  res.json(req.user);
});

module.exports = router;
