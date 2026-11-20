import { useState } from 'react';
import api, { errMsg } from '../api';
import { useAuth } from '../AuthContext';
import { Badge, Confirm, Empty, ImageField, Modal, PageHead, Spinner, Thumb, money, useFetch, useToast } from '../ui';

const blank = { name: '', sku: '', barcode: '', category: '', price: '', lowStockLimit: 10, description: '', supplier: '', imageUrl: '', imageFileId: '' };

export default function Products() {
  const { user } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState(''), [category, setCategory] = useState(''), [warehouse, setWarehouse] = useState('');
  const [supplier, setSupplier] = useState(''), [availability, setAvailability] = useState('');
  const { data, loading, reload } = useFetch('/products', { q, category, warehouse, supplier, availability });
  const { data: cats, reload: reloadCats } = useFetch('/products/categories');
  const { data: whs } = useFetch('/warehouses');
  const { data: sups } = useFetch('/users/suppliers');
  const [form, setForm] = useState(null), [del, setDel] = useState(null), [detail, setDetail] = useState(null);
  const canEdit = ['admin', 'warehouseManager'].includes(user.role);

  async function save(e) {
    e.preventDefault();
    const body = { ...form, price: Number(form.price), lowStockLimit: Number(form.lowStockLimit) };
    try {
      form._id ? await api.put(`/products/${form._id}`, body) : await api.post('/products', body);
      toast(form._id ? 'Product updated' : 'Product added');
      setForm(null); reload(); reloadCats();
    } catch (err) { toast(errMsg(err), 'error'); }
  }
  async function remove() {
    try { await api.delete(`/products/${del._id}`); toast('Product deleted'); setDel(null); reload(); } catch (err) { toast(errMsg(err), 'error'); }
  }
  async function open(p) {
    try { setDetail((await api.get(`/products/${p._id}`)).data); } catch (err) { toast(errMsg(err), 'error'); }
  }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <PageHead title={user.role === 'supplier' ? 'My products' : 'Products'} sub="Search the catalogue and check availability.">
        {canEdit && <button className="btn amber" onClick={() => setForm({ ...blank })}>Add product</button>}
      </PageHead>
      <div className="filters">
        <input placeholder="Scan barcode or search SKU / name" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{cats?.map((c) => <option key={c}>{c}</option>)}</select>
        <select value={supplier} onChange={(e) => setSupplier(e.target.value)}><option value="">All suppliers</option>{sups?.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select>
        <select value={warehouse} onChange={(e) => setWarehouse(e.target.value)}><option value="">Stock: all warehouses</option>{whs?.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}</select>
        <select value={availability} onChange={(e) => setAvailability(e.target.value)}><option value="">All availability</option><option value="in-stock">In stock</option><option value="low-stock">Low stock</option><option value="out-of-stock">Out of stock</option></select>
      </div>
      {loading ? <Spinner /> : (
        <div className="tablewrap"><table>
          <thead><tr><th>Product</th><th>SKU</th><th>Category</th><th className="num">Price</th><th>Supplier</th><th className="num">Available</th><th></th></tr></thead>
          <tbody>{data?.map((p) => (
            <tr key={p._id}>
              <td><div className="cell"><Thumb src={p.imageUrl} name={p.name} />{p.name}</div></td>
              <td>{p.sku}{p.barcode && <><br /><small className="muted">Barcode: {p.barcode}</small></>}</td><td>{p.category}</td><td className="num">{money(p.price)}</td><td>{p.supplier?.name || '-'}</td>
              <td className="num"><Badge tone={p.availableStock <= p.lowStockLimit ? 'low' : 'ok'}>{p.availableStock}</Badge></td>
              <td><div className="rowbtns">
                <button className="btn sm ghost" onClick={() => open(p)}>Details</button>
                {canEdit && <button className="btn sm ghost" onClick={() => setForm({ ...blank, ...p, supplier: p.supplier?._id || '' })}>Edit</button>}
                {user.role === 'admin' && <button className="btn sm danger" onClick={() => setDel(p)}>Delete</button>}
              </div></td>
            </tr>))}</tbody>
        </table>{!data?.length && <Empty>No products match these filters.</Empty>}</div>
      )}

      {form && (
        <Modal title={form._id ? 'Edit product' : 'Add product'} onClose={() => setForm(null)} wide>
          <form onSubmit={save}>
            <div className="cols">
              <div className="field"><label>Name</label><input required value={form.name} onChange={set('name')} /></div>
              <div className="field"><label>SKU</label><input required value={form.sku} onChange={set('sku')} /></div>
              <div className="field"><label>Barcode (optional)</label><input value={form.barcode || ''} onChange={set('barcode')} /></div>
              <div className="field"><label>Category</label><input list="cats" value={form.category || ''} onChange={set('category')} /><datalist id="cats">{cats?.map((c) => <option key={c} value={c} />)}</datalist></div>
              <div className="field"><label>Supplier</label><select value={form.supplier} onChange={set('supplier')}><option value="">No supplier</option>{sups?.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select></div>
              <div className="field"><label>Price (Rs.)</label><input type="number" min="0" required value={form.price} onChange={set('price')} /></div>
              <div className="field"><label>Low-stock limit</label><input type="number" min="0" required value={form.lowStockLimit} onChange={set('lowStockLimit')} /></div>
            </div>
            <div className="field"><label>Description</label><textarea rows="2" value={form.description || ''} onChange={set('description')} /></div>
            <ImageField label="Product image" value={form.imageUrl} onChange={(r) => setForm({ ...form, imageUrl: r.url, imageFileId: r.fileId })} />
            <div className="form-actions"><button type="button" className="btn ghost" onClick={() => setForm(null)}>Cancel</button><button className="btn amber">Save product</button></div>
          </form>
        </Modal>
      )}
      {del && <Confirm title="Delete product" message={`Delete ${del.name}? Its stock records will be removed too.`} confirmLabel="Delete product" onYes={remove} onClose={() => setDel(null)} />}
      {detail && (
        <Modal title={detail.product.name} onClose={() => setDetail(null)}>
          <div className="cell" style={{ alignItems: 'flex-start', gap: 16 }}>
            {detail.product.imageUrl && <img src={detail.product.imageUrl} alt="" style={{ width: 110, height: 110, borderRadius: 6, objectFit: 'cover' }} />}
            <div><p>{detail.product.description}</p><p><b>{money(detail.product.price)}</b> · SKU {detail.product.sku}</p><p className="muted">Supplier: {detail.product.supplier?.name || '-'}</p></div>
          </div>
          <h3 style={{ margin: '14px 0 6px' }}>Stock by warehouse</h3>
          <table><tbody>{detail.stock.map((s) => <tr key={s._id}><td>{s.warehouse?.name}</td><td className="num">{s.quantity}</td></tr>)}</tbody></table>
          {!detail.stock.length && <Empty>Not stocked in any warehouse yet.</Empty>}
        </Modal>
      )}
    </>
  );
}
