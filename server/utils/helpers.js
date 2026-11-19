const ImageKit = require('imagekit');

const httpError = (status, message) => Object.assign(new Error(message), { status });
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const positiveInt = (v, label = 'Quantity') => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw httpError(400, `${label} must be a positive whole number`);
  return n;
};

// ---------- ImageKit ----------
const configured = () =>
  process.env.IMAGEKIT_PUBLIC_KEY && process.env.IMAGEKIT_PRIVATE_KEY && process.env.IMAGEKIT_URL_ENDPOINT;
let ik;
const client = () => {
  if (!configured()) return null;
  return (ik ||= new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
  }));
};
const authParams = () => {
  const c = client();
  if (!c) throw httpError(503, 'ImageKit is not configured on the server (.env)');
  return { ...c.getAuthenticationParameters(), publicKey: process.env.IMAGEKIT_PUBLIC_KEY, urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT };
};
const removeFile = async (fileId) => {
  const c = client();
  if (c && fileId) { try { await c.deleteFile(fileId); } catch (e) { console.warn('ImageKit delete failed:', e.message); } }
};
// Only URLs that live on our ImageKit endpoint are accepted (no arbitrary URLs).
const assertImage = (url, current) => {
  if (!url || url === current) return;
  const ep = process.env.IMAGEKIT_URL_ENDPOINT;
  if (!ep || !url.startsWith(ep)) throw httpError(400, 'Images must be uploaded through ImageKit');
};
// Apply a new image to a doc, deleting the replaced file from ImageKit.
const applyImage = async (doc, body, urlField, idField) => {
  const url = body[urlField];
  if (!url || url === doc[urlField]) return;
  assertImage(url, doc[urlField]);
  await removeFile(doc[idField]);
  doc[urlField] = url;
  doc[idField] = body[idField];
};

module.exports = { httpError, escapeRe, positiveInt, authParams, removeFile, assertImage, applyImage };
