import { useMemo } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import {
  BarElement, CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip,
} from 'chart.js';
import { Empty, PageHead, Spinner, useFetch } from '../ui';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend);

const monthLabel = (month) => new Date(`${month}-01T00:00:00`).toLocaleDateString('en', { month: 'short', year: '2-digit' });
const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom' } },
  scales: { y: { beginAtZero: true, grid: { color: 'rgba(125, 134, 174, .14)' } }, x: { grid: { display: false } } },
};

export default function Analytics() {
  const { data, loading } = useFetch('/stats/analytics');
  const months = useMemo(() => data?.months?.map((item) => monthLabel(item.month)) || [], [data]);
  if (loading) return <Spinner />;
  if (!data) return <Empty>Analytics could not be loaded.</Empty>;

  const sales = {
    labels: months,
    datasets: [{
      label: 'Completed sales (Rs.)',
      data: data.months.map((item) => item.sales),
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99, 102, 241, .14)',
      fill: true,
      tension: .35,
      pointRadius: 4,
    }],
  };
  const movement = {
    labels: months,
    datasets: [
      { label: 'Stock in', data: data.movement.map((item) => item.stockIn), backgroundColor: '#10b981' },
      { label: 'Stock out', data: data.movement.map((item) => item.stockOut), backgroundColor: '#f97316' },
      { label: 'Transfer in', data: data.movement.map((item) => item.transferIn), backgroundColor: '#06b6d4' },
      { label: 'Transfer out', data: data.movement.map((item) => item.transferOut), backgroundColor: '#8b5cf6' },
    ],
  };
  const topProducts = {
    labels: data.topProducts.map((item) => `${item.name} (${item.sku})`),
    datasets: [{ label: 'Units sold', data: data.topProducts.map((item) => item.quantity), backgroundColor: '#ec4899', borderRadius: 7 }],
  };

  return (
    <>
      <PageHead title="Analytics" sub="Monthly sales, stock movement and your best-selling products." />
      <div className="analytics-grid">
        <section className="card chart-card"><h3>Monthly sales</h3><p className="muted">Completed orders · last 6 months</p><div className="chart-area"><Line data={sales} options={options} /></div></section>
        <section className="card chart-card"><h3>Stock movement</h3><p className="muted">Units received, dispatched and transferred</p><div className="chart-area"><Bar data={movement} options={{ ...options, scales: { ...options.scales, x: { ...options.scales.x, stacked: true }, y: { ...options.scales.y, stacked: true } } }} /></div></section>
        <section className="card chart-card chart-wide"><h3>Top-selling products</h3><p className="muted">Ranked by completed-order quantity</p>
          {data.topProducts.length ? <div className="chart-area chart-short"><Bar data={topProducts} options={{ ...options, indexAxis: 'y', plugins: { ...options.plugins, legend: { display: false } } }} /></div> : <div className="empty">No completed sales in this period yet.</div>}
        </section>
      </div>
    </>
  );
}
