import api, { errMsg } from '../api';
import { Empty, PageHead, Spinner, useFetch, useToast } from '../ui';
import { useNavigate } from 'react-router-dom';

const when = (date) => new Date(date).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' });

export default function Notifications() {
  const toast = useToast();
  const navigate = useNavigate();
  const { data, loading, reload } = useFetch('/notifications', { limit: 100 });

  async function markAllRead() {
    try { await api.post('/notifications/read-all'); reload(); }
    catch (error) { toast(errMsg(error), 'error'); }
  }

  async function openItem(item) {
    try {
      if (!item.readAt) await api.put(`/notifications/${item._id}/read`);
      if (item.link) navigate(item.link);
      else reload();
    } catch (error) { toast(errMsg(error), 'error'); }
  }

  return (
    <>
      <PageHead title="Notifications" sub="Updates about inventory, products, orders, supply and team activity.">
        {data?.unreadCount > 0 && <button className="btn ghost" onClick={markAllRead}>Mark all as read</button>}
      </PageHead>
      {loading ? <Spinner /> : (
        <div className="notification-page-list">
          {data?.items.map((item) => (
            <button type="button" key={item._id} className={`notification-page-item ${item.readAt ? '' : 'unread'}`} onClick={() => openItem(item)}>
              <span className="notification-dot" aria-hidden="true" />
              <span className="notification-copy">
                <b>{item.title}</b><span>{item.message}</span>
                <small>{item.actor?.name || 'StockYard'} · {when(item.createdAt)}</small>
              </span>
              {!item.readAt && <span className="badge info">New</span>}
            </button>
          ))}
          {!data?.items.length && <Empty>No notifications yet. Changes will appear here.</Empty>}
        </div>
      )}
    </>
  );
}
