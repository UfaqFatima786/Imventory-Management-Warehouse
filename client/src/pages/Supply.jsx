import { useState } from 'react';
import api, { errMsg } from '../api';
import { useAuth } from '../AuthContext';
import { Badge, Empty, Modal, PageHead, Spinner, fdate, useFetch, useToast } from '../ui';

export default function Supply() {
  const { user } = useAuth();
  const toast = useToast();
  const isSupplier = user.role === 'supplier';
  const [status, setStatus] = useState('');
  const { data, loading, reload } = useFetch('/supply-requests', { status });
  const [form, setForm] = useState(null);

  async function submit(e) {
    e.preventDefault();
    try { await api.post('/supply-requests', { ...form, quantity: Number(form.quantity) }); toast('Supply request submitted'); setForm(null); reload(); }
    catch (err) { toast(errMsg(err), 'error'); }
  }
  async function review(r, next) {
    try { await api.put(`/supply-requests/${r._id}/status`, { status: next }); toast(`Request ${next.toLowerCase()}`); reload(); } catch (err) { toast(errMsg(err), 'error'); }
  }
  return (
    <>
      <PageHead title={isSupplier ? 'My supply requests' : 'Supply requests'} sub={isSupplier ? 'Offer stock to a warehouse and track its review.' : 'Review incoming supply offers. After approving, record the delivery under Inventory.'}>
        {isSupplier && <button className="btn amber" onClick={() => setForm({ product: '', warehouse: '', quantity: '', note: '' })}>New request</button>}
      </PageHead>
      <div className="filters"><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{['Pending', 'Approved', 'Rejected'].map((s) => <option key={s}>{s}</option>)}</select></div>
      {loading ? <Spinner /> : (
        <div className="tablewrap"><table>
          <thead><tr><th>Date</th>{!isSupplier && <th>Supplier</th>}<th>Product</th><th>Warehouse</th><th className="num">Qty</th><th>Note</th><th>Status</th>{!isSupplier && <th></th>}</tr></thead>
          <tbody>{data?.map((r) => (
            <tr key={r._id}><td>{fdate(r.createdAt)}</td>{!isSupplier && <td>{r.supplier?.name}</td>}<td>{r.product?.name}</td><td>{r.warehouse?.name}</td><td className="num">{r.quantity}</td><td>{r.note}</td>
              <td><Badge>{r.status}</Badge>{r.reviewedBy && <small className="muted"> by {r.reviewedBy.name}</small>}</td>
              {!isSupplier && <td>{r.status === 'Pending' && <div className="rowbtns"><button className="btn sm" onClick={() => review(r, 'Approved')}>Approve</button><button className="btn sm danger" onClick={() => review(r, 'Rejected')}>Reject</button></div>}</td>}
            </tr>))}</tbody>
        </table>{!data?.length && <Empty>No supply requests yet.</Empty>}</div>
      )}
      {form && <RequestForm form={form} setForm={setForm} submit={submit} />}
    </>
  );
}

function RequestForm({ form, setForm, submit }) {
  const { data: prods } = useFetch('/products'); // suppliers only receive their own products
  const { data: whs } = useFetch('/warehouses');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <Modal title="New supply request" onClose={() => setForm(null)} wide maximizable>
      <form onSubmit={submit}>
        <div className="field"><label>Product</label><select required value={form.product} onChange={set('product')}><option value="">Select product</option>{prods?.map((p) => <option key={p._id} value={p._id}>{p.name} ({p.sku})</option>)}</select></div>
        <div className="field"><label>Deliver to</label><select required value={form.warehouse} onChange={set('warehouse')}><option value="">Select warehouse</option>{whs?.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}</select></div>
        <div className="field"><label>Quantity</label><input type="number" min="1" required value={form.quantity} onChange={set('quantity')} /></div>
        <div className="field"><label>Note</label><input value={form.note} onChange={set('note')} /></div>
        <div className="form-actions"><button type="button" className="btn ghost" onClick={() => setForm(null)}>Cancel</button><button className="btn amber">Submit request</button></div>
      </form>
    </Modal>
  );
}
