import { useState } from 'react';
import { Badge, Empty, PageHead, Spinner, useFetch } from '../ui';

export function Transactions() {
  const [type, setType] = useState(''), [warehouse, setWarehouse] = useState('');
  const { data, loading } = useFetch('/transactions', { type, warehouse });
  const { data: whs } = useFetch('/warehouses');
  return (
    <>
      <PageHead title="Stock history" sub="Every receipt, dispatch and warehouse transfer, newest first." />
      <div className="filters">
        <select value={type} onChange={(e) => setType(e.target.value)}><option value="">All movements</option><option value="stock-in">Stock in</option><option value="stock-out">Stock out</option><option value="transfer-in">Transfer in</option><option value="transfer-out">Transfer out</option></select>
        <select value={warehouse} onChange={(e) => setWarehouse(e.target.value)}><option value="">All warehouses</option>{whs?.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}</select>
      </div>
      {loading ? <Spinner /> : (
        <div className="tablewrap"><table>
          <thead><tr><th>Date</th><th>Type</th><th>Product</th><th>Warehouse</th><th className="num">Qty</th><th>Note</th><th>By</th></tr></thead>
          <tbody>{data?.map((t) => (
            <tr key={t._id}><td>{new Date(t.date).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</td><td><Badge>{t.transactionType}</Badge></td>
              <td>{t.product?.name}</td><td>{t.warehouse?.name}</td><td className="num">{['stock-in', 'transfer-in'].includes(t.transactionType) ? '+' : '−'}{t.quantity}</td><td>{t.note}</td><td>{t.performedBy?.name}</td></tr>))}</tbody>
        </table>{!data?.length && <Empty>No transactions found.</Empty>}</div>
      )}
    </>
  );
}

export function LowStock() {
  const { data, loading } = useFetch('/stock/low');
  return (
    <>
      <PageHead title="Low stock" sub="Products at or below their low-stock limit." />
      {loading ? <Spinner /> : (
        <div className="tablewrap"><table>
          <thead><tr><th>Product</th><th>SKU</th><th>Warehouse</th><th className="num">On hand</th><th className="num">Limit</th><th className="num">Short by</th></tr></thead>
          <tbody>{data?.map((s) => (
            <tr key={s._id}><td>{s.product.name}</td><td>{s.product.sku}</td><td>{s.warehouse.name}</td><td className="num"><Badge tone="low">{s.quantity}</Badge></td><td className="num">{s.product.lowStockLimit}</td><td className="num">{Math.max(0, s.product.lowStockLimit - s.quantity)}</td></tr>))}</tbody>
        </table>{!data?.length && <Empty>Nothing is running low. Nice work.</Empty>}</div>
      )}
    </>
  );
}
