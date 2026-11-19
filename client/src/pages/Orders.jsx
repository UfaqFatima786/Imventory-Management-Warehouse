import { useState } from 'react';
import api, { errMsg } from '../api';
import { useAuth } from '../AuthContext';
import { Badge, Confirm, Empty, Modal, PageHead, Spinner, fdate, money, useFetch, useToast } from '../ui';

function NewOrder({ onClose, onDone }) {
  const toast = useToast();
  const { data: whs } = useFetch('/warehouses');
  const [f, setF] = useState({ customerName: '', customerPhone: '', warehouse: '' });
  const [lines, setLines] = useState([{ product: '', quantity: 1 }]);
  const { data: prods } = useFetch('/products', { warehouse: f.warehouse });
  const price = (id) => prods?.find((p) => p._id === id)?.price || 0;
  const avail = (id) => prods?.find((p) => p._id === id)?.availableStock ?? 0;
  const total = lines.reduce((s, l) => s + price(l.product) * (Number(l.quantity) || 0), 0);
  const over = lines.some((l) => l.product && Number(l.quantity) > avail(l.product));
  const setLine = (i, patch) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  async function submit(e) {
    e.preventDefault();
    try {
      await api.post('/orders', { ...f, products: lines.filter((l) => l.product).map((l) => ({ product: l.product, quantity: Number(l.quantity) })) });
      toast('Order created'); onDone();
    } catch (err) { toast(errMsg(err), 'error'); }
  }
  return (
    <Modal title="New sales order" onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="cols">
          <div className="field"><label>Customer name</label><input required value={f.customerName} onChange={(e) => setF({ ...f, customerName: e.target.value })} /></div>
          <div className="field"><label>Customer phone</label><input value={f.customerPhone} onChange={(e) => setF({ ...f, customerPhone: e.target.value })} /></div>
        </div>
        <div className="field"><label>Fulfil from warehouse</label>
          <select required value={f.warehouse} onChange={(e) => { setF({ ...f, warehouse: e.target.value }); setLines([{ product: '', quantity: 1 }]); }}>
            <option value="">Select warehouse</option>{whs?.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}</select></div>
        <label className="muted" style={{ fontSize: 13 }}>Products</label>
        {lines.map((l, i) => (
          <div className="linerow" key={i}>
            <select required value={l.product} disabled={!f.warehouse} onChange={(e) => setLine(i, { product: e.target.value })}>
              <option value="">{f.warehouse ? 'Select product' : 'Pick a warehouse first'}</option>
              {prods?.filter((p) => p.availableStock > 0 || p._id === l.product).map((p) => <option key={p._id} value={p._id}>{p.name} - {p.availableStock} available</option>)}</select>
            <input type="number" min="1" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} aria-label="Quantity" style={l.product && Number(l.quantity) > avail(l.product) ? { borderColor: 'var(--bad)' } : undefined} />
            <span className="muted">{money(price(l.product) * (Number(l.quantity) || 0))}</span>
            <button type="button" className="x" onClick={() => setLines(lines.length > 1 ? lines.filter((_, j) => j !== i) : lines)} aria-label="Remove line">×</button>
          </div>))}
        <button type="button" className="btn sm ghost" onClick={() => setLines([...lines, { product: '', quantity: 1 }])}>Add another product</button>
        {over && <p style={{ color: 'var(--bad)', marginTop: 8 }}>One or more quantities exceed available stock.</p>}
        <p style={{ textAlign: 'right', fontSize: 20, marginTop: 10 }}>Total: <b>{money(total)}</b></p>
        <div className="form-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn amber" disabled={over || !total}>Create order</button></div>
      </form>
    </Modal>
  );
}

export default function Orders() {
  const { user } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState('');
  const { data, loading, reload } = useFetch('/orders', { status });
  const [creating, setCreating] = useState(false), [detail, setDetail] = useState(null), [ask, setAsk] = useState(null);
  const isRep = user.role === 'salesRepresentative';

  async function act() {
    const { order, kind, status: next } = ask;
    try {
      kind === 'cancel' ? await api.put(`/orders/${order._id}/cancel`) : await api.put(`/orders/${order._id}/status`, { status: next });
      toast(kind === 'cancel' ? 'Order cancelled' : `Order marked ${next}`);
    } catch (err) { toast(errMsg(err), 'error'); }
    setAsk(null); reload();
  }
  return (
    <>
      <PageHead title={isRep ? 'My orders' : 'Orders'} sub="Stock is deducted once, when an order moves to Processing.">
        {isRep && <button className="btn amber" onClick={() => setCreating(true)}>New order</button>}
      </PageHead>
      <div className="filters"><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{['Pending', 'Processing', 'Completed', 'Cancelled'].map((s) => <option key={s}>{s}</option>)}</select></div>
      {loading ? <Spinner /> : (
        <div className="tablewrap"><table>
          <thead><tr><th>Order</th><th>Customer</th><th>Warehouse</th>{!isRep && <th>Created by</th>}<th className="num">Total</th><th>Status</th><th></th></tr></thead>
          <tbody>{data?.map((o) => (
            <tr key={o._id}>
              <td>{o.orderNumber}<br /><small className="muted">{fdate(o.createdAt)}</small></td><td>{o.customerName}</td><td>{o.warehouse?.name}</td>{!isRep && <td>{o.createdBy?.name}</td>}
              <td className="num">{money(o.totalAmount)}</td><td><Badge>{o.status}</Badge></td>
              <td><div className="rowbtns">
                <button className="btn sm ghost" onClick={() => setDetail(o)}>View</button>
                {!isRep && o.status === 'Pending' && <button className="btn sm" onClick={() => setAsk({ order: o, kind: 'status', status: 'Processing' })}>Process</button>}
                {!isRep && o.status === 'Processing' && <button className="btn sm" onClick={() => setAsk({ order: o, kind: 'status', status: 'Completed' })}>Complete</button>}
                {o.status === 'Pending' && user.role !== 'warehouseManager' && <button className="btn sm danger" onClick={() => setAsk({ order: o, kind: 'cancel' })}>Cancel</button>}
              </div></td>
            </tr>))}</tbody>
        </table>{!data?.length && <Empty>{isRep ? 'You have not created any orders yet.' : 'No orders found.'}</Empty>}</div>
      )}
      {creating && <NewOrder onClose={() => setCreating(false)} onDone={() => { setCreating(false); reload(); }} />}
      {detail && (
        <Modal title={`Order ${detail.orderNumber}`} onClose={() => setDetail(null)} wide>
          <p><Badge>{detail.status}</Badge> &nbsp; {detail.customerName} {detail.customerPhone && `· ${detail.customerPhone}`}</p>
          <p className="muted">From {detail.warehouse?.name} · placed {fdate(detail.createdAt)} by {detail.createdBy?.name}</p>
          <div className="tablewrap" style={{ marginTop: 12 }}><table>
            <thead><tr><th>Product</th><th className="num">Qty</th><th className="num">Unit price</th><th className="num">Line total</th></tr></thead>
            <tbody>{detail.products.map((l, i) => <tr key={i}><td>{l.product?.name}</td><td className="num">{l.quantity}</td><td className="num">{money(l.price)}</td><td className="num">{money(l.price * l.quantity)}</td></tr>)}
              <tr><td colSpan="3" className="num"><b>Grand total</b></td><td className="num"><b>{money(detail.totalAmount)}</b></td></tr></tbody>
          </table></div>
        </Modal>
      )}
      {ask && <Confirm title={ask.kind === 'cancel' ? 'Cancel order' : `Mark as ${ask.status}`}
        message={ask.kind === 'cancel' ? `Cancel ${ask.order.orderNumber}? This cannot be undone.` : ask.status === 'Processing' ? `Process ${ask.order.orderNumber}? Stock will be deducted from ${ask.order.warehouse?.name}.` : `Mark ${ask.order.orderNumber} as completed?`}
        confirmLabel={ask.kind === 'cancel' ? 'Cancel order' : `Mark ${ask.status}`} onYes={act} onClose={() => setAsk(null)} />}
    </>
  );
}
