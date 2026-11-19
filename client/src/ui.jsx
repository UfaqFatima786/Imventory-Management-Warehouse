import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import api, { errMsg, uploadImage } from './api';

export const money = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-PK');
export const fdate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [list, setList] = useState([]);
  const push = useCallback((message, type = 'success') => {
    const id = Math.random();
    setList((l) => [...l, { id, message, type }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status">{list.map((t) => <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>)}</div>
    </ToastCtx.Provider>
  );
}

export function useFetch(url, params) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(params || {});
  const load = useCallback(() => {
    setLoading(true);
    return api.get(url, { params }).then((r) => setData(r.data)).catch((e) => toast(errMsg(e), 'error')).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, key]);
  useEffect(() => { load(); }, [load]);
  return { data, loading, reload: load };
}

export const Spinner = () => <div className="spinner" aria-label="Loading" />;
export const Badge = ({ children, tone }) => <span className={`badge ${tone || String(children).toLowerCase()}`}>{children}</span>;
export const PageHead = ({ title, sub, children }) => (
  <div className="pagehead"><div><h2>{title}</h2>{sub && <p className="muted">{sub}</p>}</div><div className="actions">{children}</div></div>
);
export const Empty = ({ children }) => <div className="empty">{children}</div>;

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-h"><h3>{title}</h3><button className="x" onClick={onClose} aria-label="Close">×</button></div>
        <div className="modal-b">{children}</div>
      </div>
    </div>
  );
}

export function Confirm({ title, message, confirmLabel = 'Confirm', onYes, onClose }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onClose}>
      <p>{message}</p>
      <div className="form-actions">
        <button className="btn ghost" onClick={onClose}>Keep it</button>
        <button className="btn danger" disabled={busy} onClick={async () => { setBusy(true); await onYes(); setBusy(false); }}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}

export function ImageField({ label = 'Image', value, onChange }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const ref = useRef();
  async function pick(e) {
    const f = e.target.files[0];
    if (!f) return;
    setBusy(true);
    try { onChange(await uploadImage(f)); toast('Image uploaded'); } catch (err) { toast(errMsg(err), 'error'); }
    setBusy(false);
    if (ref.current) ref.current.value = '';
  }
  return (
    <div className="field">
      <label>{label}</label>
      <div className="imgfield">
        {value ? <img src={value} alt="Preview" /> : <div className="ph">No image</div>}
        <div><input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} disabled={busy} />
          <small className="muted">{busy ? 'Uploading to ImageKit…' : 'JPG, PNG or WebP, up to 2 MB'}</small></div>
      </div>
    </div>
  );
}

export const Thumb = ({ src, name }) => src ? <img className="thumb" src={src} alt={name} /> : <div className="thumb ph">{(name || '?')[0]}</div>;

export function ThemeToggle({ className = '' }) {
  const [theme, setTheme] = useState(document.documentElement.dataset.theme || 'light');
  const flip = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch {}
    setTheme(next);
  };
  return (
    <button type="button" className={`theme-btn ${className}`} onClick={flip} aria-label="Toggle dark mode" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
