import { useState } from 'react';
import api, { errMsg } from '../api';
import { useAuth } from '../AuthContext';
import { Confirm, Empty, Modal, PageHead, Spinner, useFetch, useToast } from '../ui';

function ManagerSelect(props) {
  const { data } = useFetch('/users', { role: 'warehouseManager' }); // only rendered for admins
  return <select {...props}><option value="">Unassigned</option>{data?.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}</select>;
}

export default function Warehouses() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user.role === 'admin';
  const { data, loading, reload } = useFetch('/warehouses');
  const [form, setForm] = useState(null), [del, setDel] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save(e) {
    e.preventDefault();
    const body = { name: form.name, location: form.location, capacity: Number(form.capacity || 0), manager: form.manager || null };
    try { form._id ? await api.put(`/warehouses/${form._id}`, body) : await api.post('/warehouses', body); toast('Warehouse saved'); setForm(null); reload(); }
    catch (err) { toast(errMsg(err), 'error'); }
  }
  async function remove() {
    try { await api.delete(`/warehouses/${del._id}`); toast('Warehouse deleted'); setDel(null); reload(); } catch (err) { toast(errMsg(err), 'error'); setDel(null); }
  }
  return (
    <>
      <PageHead title={isAdmin ? 'Warehouses' : 'My warehouses'} sub="Locations, capacity and who runs them.">
        {isAdmin && <button className="btn amber" onClick={() => setForm({ name: '', location: '', capacity: '', manager: '' })}>Add warehouse</button>}
      </PageHead>
      {loading ? <Spinner /> : (
        <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>
          {data?.map((w) => {
            const pct = w.capacity ? Math.min(100, Math.round((w.units / w.capacity) * 100)) : 0;
            return (
              <div className="card" key={w._id}>
                <h3>{w.name}</h3><p className="muted">{w.location}</p>
                <p style={{ marginTop: 8 }}>Manager: <b>{w.manager?.name || 'Unassigned'}</b></p>
                <p>{w.items} products · {w.units} units</p>
                {w.capacity > 0 && <><div style={{ height: 8, background: 'var(--soft)', borderRadius: 4, margin: '8px 0 4px' }}><div style={{ width: pct + '%', height: '100%', background: pct > 85 ? 'var(--bad)' : 'var(--grad)', borderRadius: 4 }} /></div><small className="muted">{pct}% of {w.capacity} capacity</small></>}
                {isAdmin && <div className="rowbtns" style={{ marginTop: 12 }}>
                  <button className="btn sm ghost" onClick={() => setForm({ ...w, manager: w.manager?._id || '' })}>Edit</button>
                  <button className="btn sm danger" onClick={() => setDel(w)}>Delete</button></div>}
              </div>);
          })}
          {!data?.length && <Empty>No warehouses yet.</Empty>}
        </div>
      )}
      {form && (
        <Modal title={form._id ? 'Edit warehouse' : 'Add warehouse'} onClose={() => setForm(null)}>
          <form onSubmit={save}>
            <div className="field"><label>Name</label><input required value={form.name} onChange={set('name')} /></div>
            <div className="field"><label>Location</label><input value={form.location || ''} onChange={set('location')} /></div>
            <div className="field"><label>Capacity (units)</label><input type="number" min="0" value={form.capacity ?? ''} onChange={set('capacity')} /></div>
            <div className="field"><label>Manager</label><ManagerSelect value={form.manager} onChange={set('manager')} /></div>
            <div className="form-actions"><button type="button" className="btn ghost" onClick={() => setForm(null)}>Cancel</button><button className="btn amber">Save warehouse</button></div>
          </form>
        </Modal>
      )}
      {del && <Confirm title="Delete warehouse" message={`Delete ${del.name}? This only works when it holds no stock.`} confirmLabel="Delete warehouse" onYes={remove} onClose={() => setDel(null)} />}
    </>
  );
}
