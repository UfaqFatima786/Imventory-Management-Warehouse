import { useState } from 'react';
import { PageHead, Spinner, useFetch } from '../ui';

const ACTIONS = [
  'Stock received', 'Stock removed', 'Stock transferred', 'Order created',
  'Order processed', 'Order status changed', 'Order cancelled',
  'Product created', 'Product updated', 'Product deleted',
  'Warehouse created', 'Warehouse updated', 'Warehouse deleted',
  'User created', 'User updated', 'User deleted',
  'User registered',
  'Supply request submitted', 'Supply request approved', 'Supply request rejected',
];

export default function Activity() {
  const [warehouse, setWarehouse] = useState('');
  const [action, setAction] = useState('');
  const { data: warehouses } = useFetch('/warehouses');
  const { data, loading } = useFetch('/activity', { warehouse, action });

  return (
    <>
      <PageHead title="Activity log" sub="A traceable history of who changed inventory and when." />
      <div className="filters">
        <select value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">All operations</option>{ACTIONS.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
          <option value="">All operations</option>{warehouses?.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
        </select>
      </div>
      {loading ? <Spinner /> : (
        <div className="tablewrap"><table>
          <thead><tr><th>Operation</th><th>Details</th><th>Performed by</th><th>Warehouse</th><th>Date & time</th></tr></thead>
          <tbody>{data?.map((item) => (
            <tr key={item._id}>
              <td><b>{item.action}</b></td><td>{item.details}</td>
              <td>{item.user?.name || 'Unknown user'}<br /><small className="muted">{item.user?.role}</small></td>
              <td>{item.warehouse?.name || '—'}</td>
              <td>{new Date(item.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</td>
            </tr>
          ))}</tbody>
        </table>{!data?.length && <div className="empty">No activity matches these filters.</div>}</div>
      )}
      <p className="muted" style={{ marginTop: 10 }}>Showing the latest 300 matching operations.</p>
    </>
  );
}
