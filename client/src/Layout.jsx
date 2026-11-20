import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Thumb, ThemeToggle } from './ui';
import NotificationBell from './NotificationBell';

const ALL = ['admin', 'warehouseManager', 'supplier', 'salesRepresentative'];
const NAV = [
  { to: '/', icon: '📊', label: 'Dashboard', roles: ALL },
  { to: '/products', icon: '📦', label: 'Products', roles: ALL },
  { to: '/warehouses', icon: '🏭', label: 'Warehouses', roles: ['admin', 'warehouseManager'] },
  { to: '/inventory', icon: '🗃️', label: 'Inventory', roles: ['admin', 'warehouseManager'] },
  { to: '/transactions', icon: '🔄', label: 'Stock history', roles: ['admin', 'warehouseManager'] },
  { to: '/analytics', icon: '📈', label: 'Analytics', roles: ['admin', 'warehouseManager'] },
  { to: '/activity', icon: '🧭', label: 'Activity log', roles: ['admin', 'warehouseManager'] },
  { to: '/low-stock', icon: '⚠️', label: 'Low stock', roles: ['admin', 'warehouseManager'] },
  { to: '/orders', icon: '🧾', label: 'Orders', roles: ['admin', 'warehouseManager', 'salesRepresentative'] },
  { to: '/supply', icon: '🚚', label: 'Supply requests', roles: ['admin', 'warehouseManager', 'supplier'] },
  { to: '/users', icon: '👥', label: 'Users', roles: ['admin'] },
  { to: '/profile', icon: '👤', label: 'My profile', roles: ALL },
];
export const ROLE_LABEL = { admin: 'Admin', warehouseManager: 'Warehouse manager', supplier: 'Supplier', salesRepresentative: 'Sales representative' };

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  return (
    <div className="app">
      <aside className={`side ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>
        <div className="brand"><span className="logo">▣</span>Stock<span>Yard</span></div>
        <nav>
          {NAV.filter((n) => n.roles.includes(user.role)).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}><span className="ico">{n.icon}</span>{user.role === 'supplier' && n.to === '/products' ? 'My products' : n.label}</NavLink>
          ))}
        </nav>
        <div className="me">
          <Thumb src={user.image} name={user.name} />
          <div style={{ flex: 1, minWidth: 0 }}><b>{user.name}</b><small>{ROLE_LABEL[user.role]}</small></div>
          <button className="btn sm out" onClick={() => { logout(); nav('/login'); }}>Sign out</button>
        </div>
      </aside>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="topbar">
          <button className="menu-toggle" onClick={() => setOpen(true)} aria-label="Open menu">☰</button>
          <b className="topbar-title">StockYard</b>
          <div className="topbar-actions"><NotificationBell /><ThemeToggle /></div>
        </div>
        <main className="main"><Outlet /></main>
      </div>
    </div>
  );
}
