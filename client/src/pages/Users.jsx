import { useState } from 'react';
import api, { errMsg } from '../api';
import { useAuth } from '../AuthContext';
import { ROLE_LABEL } from '../Layout';
import { Badge, Confirm, Empty, ImageField, Modal, PageHead, Spinner, Thumb, useFetch, useToast } from '../ui';

const blank = { name: '', email: '', password: '', phone: '', role: 'salesRepresentative', assignedWarehouses: [], image: '', imageFileId: '' };

export default function Users() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState(''), [role, setRole] = useState('');
  const { data, loading, reload } = useFetch('/users', { q, role });
  const { data: whs } = useFetch('/warehouses');
  const [form, setForm] = useState(null), [del, setDel] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const toggle = (id) => setForm({ ...form, assignedWarehouses: form.assignedWarehouses.includes(id) ? form.assignedWarehouses.filter((x) => x !== id) : [...form.assignedWarehouses, id] });

  async function save(e) {
    e.preventDefault();
    const body = { ...form }; if (!body.password) delete body.password;
    try { form._id ? await api.put(`/users/${form._id}`, body) : await api.post('/users', body); toast('User saved'); setForm(null); reload(); }
    catch (err) { toast(errMsg(err), 'error'); }
  }
  async function remove() {
    try { await api.delete(`/users/${del._id}`); toast('User deleted'); setDel(null); reload(); } catch (err) { toast(errMsg(err), 'error'); setDel(null); }
  }
  return (
    <>
      <PageHead title="Users" sub="Create accounts and assign roles and warehouses."><button className="btn amber" onClick={() => setForm({ ...blank })}>Add user</button></PageHead>
      <div className="filters">
        <input placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={role} onChange={(e) => setRole(e.target.value)}><option value="">All roles</option>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      {loading ? <Spinner /> : (
        <div className="tablewrap"><table>
          <thead><tr><th>User</th><th>Email</th><th>Phone</th><th>Role</th><th>Warehouses</th><th></th></tr></thead>
          <tbody>{data?.map((u) => (
            <tr key={u._id}><td><div className="cell"><Thumb src={u.image} name={u.name} />{u.name}</div></td><td>{u.email}</td><td>{u.phone}</td><td><Badge tone="info">{ROLE_LABEL[u.role]}</Badge></td>
              <td>{u.assignedWarehouses?.map((w) => w.name).join(', ') || '-'}</td>
              <td><div className="rowbtns"><button className="btn sm ghost" onClick={() => setForm({ ...blank, ...u, password: '', assignedWarehouses: u.assignedWarehouses.map((w) => w._id) })}>Edit</button>
                {u._id !== me._id && <button className="btn sm danger" onClick={() => setDel(u)}>Delete</button>}</div></td></tr>))}</tbody>
        </table>{!data?.length && <Empty>No users match.</Empty>}</div>
      )}
      {form && (
        <Modal title={form._id ? 'Edit user' : 'Add user'} onClose={() => setForm(null)} wide>
          <form onSubmit={save}>
            <div className="cols">
              <div className="field"><label>Name</label><input required value={form.name} onChange={set('name')} /></div>
              <div className="field"><label>Email</label><input type="email" required value={form.email} onChange={set('email')} /></div>
              <div className="field"><label>{form._id ? 'New password (optional)' : 'Password'}</label><input type="password" minLength={6} required={!form._id} value={form.password} onChange={set('password')} /></div>
              <div className="field"><label>Phone</label><input value={form.phone || ''} onChange={set('phone')} /></div>
              <div className="field"><label>Role</label><select value={form.role} onChange={set('role')}>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            </div>
            {form.role === 'warehouseManager' && <div className="field"><label>Assigned warehouses</label><div className="checks">{whs?.map((w) => <label key={w._id}><input type="checkbox" checked={form.assignedWarehouses.includes(w._id)} onChange={() => toggle(w._id)} />{w.name}</label>)}</div></div>}
            <ImageField label={form.role === 'supplier' ? 'Supplier logo' : 'Profile picture'} value={form.image} onChange={(r) => setForm({ ...form, image: r.url, imageFileId: r.fileId })} />
            <div className="form-actions"><button type="button" className="btn ghost" onClick={() => setForm(null)}>Cancel</button><button className="btn amber">Save user</button></div>
          </form>
        </Modal>
      )}
      {del && <Confirm title="Delete user" message={`Delete ${del.name}? This cannot be undone.`} confirmLabel="Delete user" onYes={remove} onClose={() => setDel(null)} />}
    </>
  );
}
