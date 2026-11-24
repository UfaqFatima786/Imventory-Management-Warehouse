const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { authParams, httpError } = require('../utils/helpers');

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX = 2 * 1024 * 1024;

// Returns signed params; the private key never leaves the server.
// The client declares file type/size so the backend can refuse bad files before issuing a token.
router.get('/auth', protect, (req, res) => {
  const { type, size } = req.query;
  if (!TYPES.includes(type)) throw httpError(400, 'Only JPG, PNG or WebP images are allowed');
  if (!(Number(size) > 0 && Number(size) <= MAX)) throw httpError(400, 'Image must be 2 MB or smaller');
  res.json(authParams());
});

module.exports = router;
