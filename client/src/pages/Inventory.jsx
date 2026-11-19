import { useState } from 'react';
import api, { errMsg } from '../api';
import { Badge, Empty, Modal, PageHead, Spinner, Thumb, useFetch, useToast } from '../ui';

export default function Inventory() {
  const toast = useToast();
  const [wh, setWh] = useState(''), [q, setQ] = useState('');
  const { data, loading, reload } = useFetch('/stock', { warehouse: wh, q });
  const { data: whs } = useFetch('/warehouses');
  const { data: prods } = useFetch('/products');
  const [m, setM] = useState(null); // {type, product, warehouse, quantity, note}

  async function submit(e) {
    e.preventDefault();
    try {
      await api.post(`/stock/${m.type}`, { product: m.product, warehouse: m.warehouse, quantity: Number(m.quantity), note: m.note });
      toast(m.type === 'in' ? 'Stock received' : 'Stock removed');
      setM(null); reload();
    } catch (err) { toast(errMsg(err), 'error'); }
  }
  const open = (type, s) => setM({ type, product: s?.product._id || '', warehouse: s?.warehouse._id || wh || whs?.[0]?._id || '', quantity: '', note: '' });
  const set = (k) => (e) => setM({ ...m, [k]: e.target.value });

  return (
    <>
      <PageHead title="Inventory" sub="Live stock per warehouse. Every change is logged in stock history.">
        <button className="btn amber" onClick={() => open('in')}>Add stock</button>
        <button className="btn" onClick={() => open('out')}>Remove stock</button>
      </PageHead>
      <div className="filters">
        <input placeholder="Search product or SKU" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={wh} onChange={(e) => setWh(e.target.value)}><option value="">All my warehouses</option>{whs?.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}</select>
      </div>
      {loading ? <Spinner /> : (
        <div className="tablewrap"><table>
          <thead><tr><th>Product</th><th>SKU</th><th>Warehouse</th><th className="num">Quantity</th><th>Status</th><th></th></tr></thead>
          <tbody>{data?.map((s) => (
            <tr key={s._id}>
              <td><div className="cell"><Thumb src={s.product?.imageUrl} name={s.product?.name} />{s.product?.name}</div></td>
              <td>{s.product?.sku}</td><td>{s.warehouse?.name}</td><td className="num"><b>{s.quantity}</b></td>
              <td>{s.quantity <= s.product?.lowStockLimit ? <Badge tone="low">Low stock</Badge> : <Badge tone="ok">In stock</Badge>}</td>
              <td><div className="rowbtns"><button className="btn sm ghost" onClick={() => open('in', s)}>+ In</button><button className="btn sm ghost" onClick={() => open('out', s)}>− Out</button></div></td>
            </tr>))}</tbody>
        </table>{!data?.length && <Empty>No stock recorded here yet. Use Add stock to receive your first delivery.</Empty>}</div>
      )}
      {m && (
        <Modal title={m.type === 'in' ? 'Add received stock' : 'Remove stock'} onClose={() => setM(null)}>
          <form onSubmit={submit}>
            <div className="field"><label>Warehouse</label><select required value={m.warehouse} onChange={set('warehouse')}><option value="">Select warehouse</option>{whs?.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}</select></div>
            <div className="field"><label>Product</label><select required value={m.product} onChange={set('product')}><option value="">Select product</option>{prods?.map((p) => <option key={p._id} value={p._id}>{p.name} ({p.sku})</option>)}</select></div>
            <div className="field"><label>Quantity</label><input type="number" min="1" step="1" required value={m.quantity} onChange={set('quantity')} /></div>
            <div className="field"><label>Note</label><input value={m.note} onChange={set('note')} placeholder={m.type === 'in' ? 'e.g. Delivery from supplier' : 'e.g. Damaged units'} /></div>
            <div className="form-actions"><button type="button" className="btn ghost" onClick={() => setM(null)}>Cancel</button><button className={`btn ${m.type === 'in' ? 'amber' : ''}`}>{m.type === 'in' ? 'Add stock' : 'Remove stock'}</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}
