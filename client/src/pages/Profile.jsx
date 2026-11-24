import { useState } from 'react';
import api, { errMsg } from '../api';
import { useAuth } from '../AuthContext';
import { ROLE_LABEL } from '../Layout';
import { ImageField, PageHead, useToast } from '../ui';

export default function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ name: user.name, phone: user.phone || '', password: '', image: user.image || '', imageFileId: user.imageFileId || '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function save(e) {
    e.preventDefault();
    const body = { ...f }; if (!body.password) delete body.password;
    try { const { data } = await api.put(`/users/${user._id}`, body); setUser(data); setF({ ...f, password: '' }); toast('Profile saved'); }
    catch (err) { toast(errMsg(err), 'error'); }
  }
  return (
    <>
      <PageHead title="My profile" sub={`${ROLE_LABEL[user.role]} · ${user.email}`} />
      <form className="card" style={{ maxWidth: 520 }} onSubmit={save}>
        <ImageField label={user.role === 'supplier' ? 'Supplier logo' : 'Profile picture'} value={f.image} onChange={(r) => setF({ ...f, image: r.url, imageFileId: r.fileId })} />
        <div className="field"><label>Name</label><input required value={f.name} onChange={set('name')} /></div>
        <div className="field"><label>Phone</label><input value={f.phone} onChange={set('phone')} /></div>
        <div className="field"><label>New password (optional)</label><input type="password" minLength={6} value={f.password} onChange={set('password')} /></div>
        {user.role === 'warehouseManager' && <p className="muted">Assigned: {user.assignedWarehouses?.map((w) => w.name).join(', ') || 'none'}</p>}
        <div className="form-actions"><button className="btn amber">Save profile</button></div>
      </form>
    </>
  );
}
