import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from './api';
import { useToast } from './ui';

const when = (date) => new Date(date).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' });

export default function NotificationBell() {
  const toast = useToast();
  const navigate = useNavigate();
  const root = useRef(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async (showError = false) => {
    try {
      const { data } = await api.get('/notifications', { params: { limit: 8 } });
      setItems(data.items);
      setUnread(data.unreadCount);
    } catch (error) {
      if (showError) toast(errMsg(error), 'error');
    }
  }, [toast]);

  useEffect(() => {
    load(true);
    const timer = setInterval(() => load(), 12000);
    const refresh = () => load(true);
    window.addEventListener('stockyard:notification-refresh', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('stockyard:notification-refresh', refresh);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    return () => document.removeEventListener('mousedown', closeOutside);
  }, [open]);

  async function markAllRead() {
    try {
      await api.post('/notifications/read-all');
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
      setUnread(0);
    } catch (error) { toast(errMsg(error), 'error'); }
  }

  async function openItem(item) {
    try {
      if (!item.readAt) await api.put(`/notifications/${item._id}/read`);
      setItems((current) => current.map((entry) => entry._id === item._id ? { ...entry, readAt: new Date().toISOString() } : entry));
      setUnread((count) => Math.max(0, count - (item.readAt ? 0 : 1)));
      setOpen(false);
      if (item.link) navigate(item.link);
    } catch (error) { toast(errMsg(error), 'error'); }
  }

  return (
    <div className="notification-bell" ref={root}>
      <button
        type="button"
        className="notification-trigger"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">🔔</span>
        {unread > 0 && <span className="notification-count">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="notification-menu" role="dialog" aria-label="Recent notifications">
          <div className="notification-menu-head">
            <div><b>Notifications</b><small>{unread ? `${unread} unread` : 'You are all caught up'}</small></div>
            {unread > 0 && <button type="button" className="link-button" onClick={markAllRead}>Mark all read</button>}
          </div>
          <div className="notification-list">
            {items.map((item) => (
              <button type="button" key={item._id} className={`notification-item ${item.readAt ? '' : 'unread'}`} onClick={() => openItem(item)}>
                <span className="notification-dot" aria-hidden="true" />
                <span className="notification-copy">
                  <b>{item.title}</b><span>{item.message}</span>
                  <small>{item.actor?.name || 'StockYard'} · {when(item.createdAt)}</small>
                </span>
              </button>
            ))}
            {!items.length && <div className="empty">No notifications yet.</div>}
          </div>
          <button type="button" className="notification-all" onClick={() => { setOpen(false); navigate('/notifications'); }}>View all notifications</button>
        </div>
      )}
    </div>
  );
}
