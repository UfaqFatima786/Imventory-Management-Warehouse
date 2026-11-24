import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Spinner } from './ui';
import Layout from './Layout';
import { Login, Register, Unauthorized } from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Warehouses from './pages/Warehouses';
import Inventory from './pages/Inventory';
import { Transactions, LowStock } from './pages/Reports';
import Orders from './pages/Orders';
import Supply from './pages/Supply';
import Users from './pages/Users';
import Profile from './pages/Profile';
import Activity from './pages/Activity';
import Notifications from './pages/Notifications';
const Analytics = lazy(() => import('./pages/Analytics'));

// UI-level guard only; every API call is independently authorised by the backend.
function Guard({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/unauthorized" replace />;
  return children;
}
const A = 'admin', M = 'warehouseManager', S = 'supplier', R = 'salesRepresentative';
const page = (roles, el) => <Guard roles={roles}>{el}</Guard>;

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route element={<Guard><Layout /></Guard>}>
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="warehouses" element={page([A, M], <Warehouses />)} />
        <Route path="inventory" element={page([A, M], <Inventory />)} />
        <Route path="transactions" element={page([A, M], <Transactions />)} />
        <Route path="analytics" element={page([A, M], <Suspense fallback={<Spinner />}><Analytics /></Suspense>)} />
        <Route path="activity" element={page([A, M], <Activity />)} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="low-stock" element={page([A, M], <LowStock />)} />
        <Route path="orders" element={page([A, M, R], <Orders />)} />
        <Route path="supply" element={page([A, M, S], <Supply />)} />
        <Route path="users" element={page([A], <Users />)} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
