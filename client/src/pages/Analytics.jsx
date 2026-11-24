import { useMemo } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  ArcElement, BarElement, CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip,
} from 'chart.js';
import { useAuth } from '../AuthContext';
import { Empty, PageHead, Spinner, useFetch } from '../ui';

ChartJS.register(ArcElement, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend);

const monthLabel = (month) => new Date(`${month}-01T00:00:00`).toLocaleDateString('en', { month: 'short', year: '2-digit' });
const colors = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
const axisOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 18 } } },
  scales: { y: { beginAtZero: true, grid: { color: 'rgba(125, 134, 174, .14)' } }, x: { grid: { display: false } } },
};
const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '62%',
  plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 18 } } },
};

export default function Analytics() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const { data, loading } = useFetch('/stats/analytics');
  const months = useMemo(() => data?.months?.map((item) => monthLabel(item.month)) || [], [data]);
  if (loading) return <Spinner />;
  if (!data) return <Empty>Analytics could not be loaded.</Empty>;

  const sales = {
    labels: months,
    datasets: [{
      label: `${isAdmin ? 'Company-wide' : 'Assigned warehouses'} sales (Rs.)`,
      data: data.months.map((item) => item.sales),
      borderColor: isAdmin ? '#6366f1' : '#06b6d4',
      backgroundColor: isAdmin ? 'rgba(99, 102, 241, .18)' : 'rgba(6, 182, 212, .2)',
      borderRadius: 8,
      borderWidth: 3,
      fill: isAdmin,
      tension: .35,
      pointRadius: isAdmin ? 4 : 0,
    }],
  };
  const movement = {
    labels: months,
    datasets: [
      { label: 'Stock in', data: data.movement.map((item) => item.stockIn), borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, .78)', borderRadius: 7 },
      { label: 'Stock out', data: data.movement.map((item) => item.stockOut), borderColor: '#f97316', backgroundColor: 'rgba(249, 115, 22, .78)', borderRadius: 7 },
      { label: 'Transfer in', data: data.movement.map((item) => item.transferIn), borderColor: '#06b6d4', backgroundColor: 'rgba(6, 182, 212, .78)', borderRadius: 7 },
      { label: 'Transfer out', data: data.movement.map((item) => item.transferOut), borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, .78)', borderRadius: 7 },
    ],
  };
  const topProducts = {
    labels: data.topProducts.map((item) => `${item.name} (${item.sku})`),
    datasets: [{ label: 'Units sold', data: data.topProducts.map((item) => item.quantity), backgroundColor: data.topProducts.map((_, i) => colors[i % colors.length]), borderRadius: 7 }],
  };
  const warehouseStock = {
    labels: data.warehouseStock.map((item) => item.warehouse),
    datasets: [{ data: data.warehouseStock.map((item) => item.units), backgroundColor: data.warehouseStock.map((_, i) => colors[i % colors.length]), borderColor: 'rgba(255,255,255,.75)', borderWidth: 2, hoverOffset: 8 }],
  };
  const stockHealth = {
    labels: data.stockHealth.map((item) => item.status),
    datasets: [{ data: data.stockHealth.map((item) => item.count), backgroundColor: ['#10b981', '#f59e0b', '#ef4444'], borderColor: 'rgba(255,255,255,.75)', borderWidth: 2, hoverOffset: 8 }],
  };

  return (
    <>
      <PageHead title={isAdmin ? 'Company analytics' : 'Warehouse analytics'} sub={isAdmin ? 'A company-wide view across all warehouses.' : 'Performance for your assigned warehouses only.'} />
      <div className="analytics-grid">
        <section className="card chart-card"><h3>{isAdmin ? 'Company sales trend' : 'Assigned warehouse sales'}</h3><p className="muted">Completed orders · last 6 months</p><div className="chart-area">{isAdmin ? <Line data={sales} options={axisOptions} /> : <Bar data={sales} options={axisOptions} />}</div></section>
        <section className="card chart-card"><h3>{isAdmin ? 'Stock movement' : 'Warehouse movement trend'}</h3><p className="muted">Received, dispatched and transferred units</p><div className="chart-area">{isAdmin
          ? <Bar data={movement} options={{ ...axisOptions, scales: { ...axisOptions.scales, x: { ...axisOptions.scales.x, stacked: true }, y: { ...axisOptions.scales.y, stacked: true } } }} />
          : <Line data={movement} options={axisOptions} />}</div></section>
        <section className="card chart-card"><h3>{isAdmin ? 'Stock by warehouse' : 'Stock health'}</h3><p className="muted">{isAdmin ? 'Share of units held at each warehouse' : 'Product stock records by availability'}</p>
          <div className="chart-area">{isAdmin
            ? data.warehouseStock.length ? <Doughnut data={warehouseStock} options={doughnutOptions} /> : <div className="empty">No warehouse stock recorded yet.</div>
            : data.stockHealth.some((item) => item.count) ? <Doughnut data={stockHealth} options={doughnutOptions} /> : <div className="empty">No stock records in your assigned warehouses yet.</div>}</div>
        </section>
        <section className="card chart-card chart-wide"><h3>Top-selling products</h3><p className="muted">{isAdmin ? 'Company-wide' : 'Within your assigned warehouses'} · ranked by completed-order quantity</p>
          {data.topProducts.length ? <div className="chart-area chart-short"><Bar data={topProducts} options={{ ...axisOptions, indexAxis: 'y', plugins: { ...axisOptions.plugins, legend: { display: false } } }} /></div> : <div className="empty">No completed sales in this period yet.</div>}
        </section>
      </div>
    </>
  );
}
