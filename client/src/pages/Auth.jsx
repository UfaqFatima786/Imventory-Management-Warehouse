import { useLayoutEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import api, { errMsg } from '../api';
import { useAuth } from '../AuthContext';
import { ThemeToggle, useToast } from '../ui';

function useAuthEntrance(screen) {
  useLayoutEffect(() => {
    if (!screen.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const context = gsap.context(() => {
      gsap.timeline({ defaults: { ease: 'power3.out' } })
        .fromTo('.auth-brand', { opacity: 0, y: -14 }, { opacity: 1, y: 0, duration: 0.55 })
        .fromTo('.auth-copy > *', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.65, stagger: 0.12 }, '-=0.25')
        .fromTo('.auth-feature-card', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.1 }, '-=0.25')
        .fromTo('.auth-card', { opacity: 0, y: 24, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.7 }, '-=0.55');
    }, screen);
    return () => context.revert();
  }, [screen]);
}

const Hero = () => (
  <div className="hero">
    <div className="auth-brand"><span className="auth-brand-mark">▣</span>Stock<span>Yard</span><span className="auth-brand-tag">INVENTORY, IN SYNC</span></div>
    <div className="auth-copy">
      <span className="auth-eyebrow">YOUR OPERATIONS, IN ONE PLACE</span>
      <h1>Every unit,<br />accounted for<span>.</span></h1>
      <p>Keep stock, teams and orders moving together. A clearer view of your warehouse starts here.</p>
      <div className="auth-feature-grid">
        <article className="auth-feature-card"><span className="auth-feature-icon">▦</span><b>Live inventory</b><small>Know what is in stock across every warehouse.</small></article>
        <article className="auth-feature-card"><span className="auth-feature-icon">↗</span><b>Orders in motion</b><small>Keep sales and supply moving together.</small></article>
        <article className="auth-feature-card"><span className="auth-feature-icon">◉</span><b>Stay in control</b><small>Catch low stock before it slows you down.</small></article>
      </div>
    </div>
    <div className="auth-proof"><span className="auth-proof-dot" /> One clear view of your whole operation</div>
  </div>
);

export function Login() {
  const screen = useRef(null);
  useAuthEntrance(screen);
  const { user, signIn } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [f, setF] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;
  const demo = [['Admin', 'admin@demo.com', 'Admin@123'], ['Manager', 'manager1@demo.com', 'Password@123'], ['Supplier', 'supplier1@demo.com', 'Password@123'], ['Sales rep', 'sales1@demo.com', 'Password@123']];
  async function submit(e) {
    e.preventDefault(); setBusy(true);
    try { const { data } = await api.post('/auth/login', f); signIn(data); nav('/'); } catch (err) { toast(errMsg(err), 'error'); }
    setBusy(false);
  }
  return (
    <div className="auth auth-screen" ref={screen}><ThemeToggle className="fab" /><Hero />
      <div className="form auth-form-panel"><form className="box auth-card" onSubmit={submit}>
        <div className="auth-form-intro"><span>WELCOME BACK</span><h2>Sign in</h2><p>Pick up right where your team left off.</p></div>
        <div className="field"><label>Email</label><input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div className="field"><label>Password</label><input type="password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
        <button className="btn amber" style={{ width: '100%' }} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="muted" style={{ marginTop: 14 }}>New here? <Link className="link" to="/register">Create an account</Link></p>
        <p className="muted" style={{ marginTop: 22 }}>Demo accounts - click to fill:</p>
        <div className="demo">{demo.map(([l, email, password]) => <button type="button" key={l} className="btn ghost sm" onClick={() => setF({ email, password })}>{l}</button>)}</div>
      </form></div>
    </div>
  );
}

export function Register() {
  const screen = useRef(null);
  useAuthEntrance(screen);
  const { signIn } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', role: 'salesRepresentative' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    try { const { data } = await api.post('/auth/register', f); signIn(data); nav('/'); } catch (err) { toast(errMsg(err), 'error'); }
  }
  return (
    <div className="auth auth-screen" ref={screen}><ThemeToggle className="fab" /><Hero />
      <div className="form auth-form-panel"><form className="box auth-card" onSubmit={submit}>
        <div className="auth-form-intro"><span>GET STARTED</span><h2>Create account</h2><p>Set up your space and get your team in sync.</p></div>
        <div className="field"><label>Full name</label><input required value={f.name} onChange={set('name')} /></div>
        <div className="field"><label>Email</label><input type="email" required value={f.email} onChange={set('email')} /></div>
        <div className="field"><label>Phone</label><input value={f.phone} onChange={set('phone')} /></div>
        <div className="field"><label>Password (min 6 characters)</label><input type="password" minLength={6} required value={f.password} onChange={set('password')} /></div>
        <div className="field"><label>I am a</label>
          <select value={f.role} onChange={set('role')}>
            <option value="salesRepresentative">Sales representative</option><option value="warehouseManager">Warehouse manager</option><option value="supplier">Supplier</option>
          </select></div>
        <button className="btn amber" style={{ width: '100%' }}>Create account</button>
        <p className="muted" style={{ marginTop: 14 }}>Already registered? <Link className="link" to="/login">Sign in</Link></p>
      </form></div>
    </div>
  );
}

export function Unauthorized() {
  return (
    <div className="auth" style={{ gridTemplateColumns: '1fr' }}><ThemeToggle className="fab" /><div className="form" style={{ textAlign: 'center' }}>
      <div><h2>Access denied</h2><p className="muted">Your role does not have permission to open this page.</p><Link className="btn amber" to="/" style={{ display: 'inline-block', marginTop: 14, textDecoration: 'none' }}>Back to dashboard</Link></div>
    </div></div>
  );
}
