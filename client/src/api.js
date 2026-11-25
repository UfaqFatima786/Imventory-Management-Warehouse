import axios from 'axios';

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '');
const apiBaseUrl = configuredApiUrl
  ? `${configuredApiUrl.replace(/\/api$/i, '')}/api`
  : '/api';
const api = axios.create({ baseURL: apiBaseUrl });
api.interceptors.request.use((c) => {
  const t = localStorage.getItem('token');
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});
api.interceptors.response.use((r) => {
  const method = r.config.method?.toLowerCase();
  const url = String(r.config.url || '');
  if (['post', 'put', 'patch', 'delete'].includes(method) && !url.includes('/notifications')) {
    window.dispatchEvent(new Event('stockyard:notification-refresh'));
  }
  return r;
}, (e) => {
  if (e.response?.status === 401 && !location.pathname.startsWith('/login')) {
    localStorage.removeItem('token');
    location.href = '/login';
  }
  return Promise.reject(e);
});
export default api;
export const errMsg = (e) => e.response?.data?.message || e.message || 'Something went wrong';

// Authenticated ImageKit upload: signature comes from our backend, the private key never reaches the browser.
export async function uploadImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Only JPG, PNG or WebP images are allowed');
  if (file.size > 2 * 1024 * 1024) throw new Error('Image must be 2 MB or smaller');
  const { data: a } = await api.get('/upload/auth', { params: { type: file.type, size: file.size } });
  const fd = new FormData();
  fd.append('file', file);
  fd.append('fileName', file.name);
  fd.append('publicKey', a.publicKey);
  fd.append('signature', a.signature);
  fd.append('expire', a.expire);
  fd.append('token', a.token);
  fd.append('folder', '/inventory');
  const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', { method: 'POST', body: fd });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Image upload failed');
  return { url: json.url, fileId: json.fileId };
}
