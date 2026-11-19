import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { Badge, Empty, PageHead, Spinner, fdate, money, useFetch } from '../ui';

export default function Dashboard() {
  const { user } = useAuth();
  const { data, loading } = useFetch('/stats');
  if (loading || !data) return <Spinner />;
  return (
    <>
      <PageHead title={`Welcome back, ${user.name.split(' ')[0]}`} sub="Here is what is happening across your inventory today." />
      <div className="stats">{data.cards.map((c) => <div key={c.label} className={`stat ${c.tone || ''}`}><b>{c.value}</b><span>{c.label}</span></div>)}</div>
      <div className="grid2">
        {data.lowStock && (
          <div>
            <h3 style={{ marginBottom: 8 }}>Running low</h3>
            <div className="tablewrap"><table><thead><tr><th>Product</th><th>Warehouse</th><th className="num">On hand</th></tr></thead>
              <tbody>{data.lowStock.map((s) => <tr key={s._id}><td>{s.product.name}</td><td>{s.warehouse.name}</td><td className="num"><Badge tone="low">{s.quantity} / {s.product.lowStockLimit}</Badge></td></tr>)}</tbody></table>
              {!data.lowStock.length && <Empty>Everything is above its low-stock limit.</Empty>}</div>
            <p style={{ marginTop: 8 }}><Link className="link" to="/low-stock">See all low-stock products</Link></p>
          </div>
        )}
        {data.recentOrders && (
          <div>
            <h3 style={{ marginBottom: 8 }}>Recent orders</h3>
            <div className="tablewrap"><table><thead><tr><th>Order</th><th>Customer</th><th className="num">Total</th><th>Status</th></tr></thead>
              <tbody>{data.recentOrders.map((o) => <tr key={o._id}><td>{o.orderNumber}<br /><small className="muted">{fdate(o.createdAt)}</small></td><td>{o.customerName}</td><td className="num">{money(o.totalAmount)}</td><td><Badge>{o.status}</Badge></td></tr>)}</tbody></table>
              {!data.recentOrders.length && <Empty>No orders yet.</Empty>}</div>
          </div>
        )}
      </div>
    </>
  );
}
