require('dotenv').config();
const mongoose = require('mongoose');
const M = require('./models');

const daysAgo = (n) => new Date(Date.now() - n * 86400000);
const img = (t) => `https://placehold.co/300x300/e8edf2/1f3a3d?text=${encodeURIComponent(t)}`;

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all(Object.values(M).map((m) => m.deleteMany({})));

  const [admin, m1, m2, s1, s2, r1, r2] = await M.User.create([
    { name: 'Ayesha Khan', email: 'admin@demo.com', password: 'Admin@123', role: 'admin', phone: '0300-1111111', image: img('AK') },
    { name: 'Bilal Ahmed', email: 'manager1@demo.com', password: 'Password@123', role: 'warehouseManager', phone: '0301-2222222', image: img('BA') },
    { name: 'Sana Malik', email: 'manager2@demo.com', password: 'Password@123', role: 'warehouseManager', phone: '0302-3333333', image: img('SM') },
    { name: 'TechSource Traders', email: 'supplier1@demo.com', password: 'Password@123', role: 'supplier', phone: '021-3456789', image: img('TS') },
    { name: 'OfficePlus Supplies', email: 'supplier2@demo.com', password: 'Password@123', role: 'supplier', phone: '042-3456789', image: img('OP') },
    { name: 'Hamza Raza', email: 'sales1@demo.com', password: 'Password@123', role: 'salesRepresentative', phone: '0333-4444444', image: img('HR') },
    { name: 'Noor Fatima', email: 'sales2@demo.com', password: 'Password@123', role: 'salesRepresentative', phone: '0334-5555555', image: img('NF') },
  ]);

  const [w1, w2, w3] = await M.Warehouse.create([
    { name: 'Karachi Central', location: 'SITE Area, Karachi', capacity: 5000, manager: m1._id },
    { name: 'Port Qasim Depot', location: 'Port Qasim, Karachi', capacity: 2500, manager: m1._id },
    { name: 'Lahore Hub', location: 'Sundar Industrial Estate, Lahore', capacity: 3000, manager: m2._id },
  ]);
  m1.assignedWarehouses = [w1._id, w2._id]; await m1.save();
  m2.assignedWarehouses = [w3._id]; await m2.save();

  const P = (name, sku, category, price, lowStockLimit, supplier) => ({
    name, sku, category, price, lowStockLimit, supplier: supplier._id, createdBy: admin._id,
    description: `${name} - quality assured, backed by supplier warranty.`, imageUrl: img(name),
  });
  const prods = await M.Product.create([
    P('Mechanical Keyboard', 'KB-001', 'Peripherals', 1500, 10, s1), P('Wireless Mouse', 'MS-002', 'Peripherals', 800, 10, s1),
    P('Laptop 15"', 'LP-003', 'Computers', 80000, 5, s1), P('24" Monitor', 'MN-004', 'Displays', 28000, 5, s1),
    P('USB-C Hub', 'HB-005', 'Accessories', 2500, 15, s1), P('External SSD 1TB', 'SD-006', 'Storage', 18000, 8, s1),
    P('HD Webcam', 'WC-007', 'Peripherals', 4500, 10, s2), P('Headset Pro', 'HS-008', 'Audio', 6500, 10, s2),
    P('Laser Printer', 'PR-009', 'Office', 32000, 4, s2), P('WiFi Router AX', 'RT-010', 'Networking', 12000, 6, s2),
    P('Ergonomic Chair', 'CH-011', 'Furniture', 24000, 5, s2), P('LED Desk Lamp', 'DL-012', 'Furniture', 2200, 12, s2),
  ]);

  // [productIndex, warehouse, quantity]
  const levels = [
    [0, w1, 50], [1, w1, 4], [2, w1, 17], [3, w1, 22], [4, w1, 9], [5, w1, 14], [6, w1, 30], [7, w1, 3],
    [8, w2, 6], [9, w2, 11], [10, w2, 8], [11, w2, 40], [0, w2, 25], [1, w2, 60],
    [2, w3, 12], [3, w3, 4], [6, w3, 18], [7, w3, 26], [9, w3, 5], [11, w3, 7], [4, w3, 35],
  ];
  const mgr = (w) => (String(w._id) === String(w3._id) ? m2 : m1);
  let i = 0;
  for (const [pi, w, qty] of levels) {
    const out = i < 8 ? 3 : 0;
    await M.Stock.create({ product: prods[pi]._id, warehouse: w._id, quantity: qty });
    await M.StockTransaction.create({ product: prods[pi]._id, warehouse: w._id, transactionType: 'stock-in', quantity: qty + out, note: 'Initial delivery', performedBy: mgr(w)._id, date: daysAgo(20 - i) });
    if (out) await M.StockTransaction.create({ product: prods[pi]._id, warehouse: w._id, transactionType: 'stock-out', quantity: out, note: 'Damaged / sample units', performedBy: mgr(w)._id, date: daysAgo(10 - (i % 5)) });
    i++;
  }

  const mk = (n, cust, phone, w, lines, status, by, d) => ({
    orderNumber: `ORD-2026${String(n).padStart(4, '0')}`, customerName: cust, customerPhone: phone, warehouse: w._id,
    products: lines.map(([pi, quantity]) => ({ product: prods[pi]._id, quantity, price: prods[pi].price })),
    totalAmount: lines.reduce((s, [pi, q]) => s + prods[pi].price * q, 0), status, createdBy: by._id, createdAt: daysAgo(d),
  });
  await M.Order.create([
    mk(1, 'Zain Electronics', '0300-9000001', w1, [[0, 2], [1, 3]], 'Completed', r1, 12),
    mk(2, 'City Mart', '0300-9000002', w1, [[2, 2]], 'Processing', r1, 5),
    mk(3, 'Bright Office', '0321-9000003', w1, [[3, 4], [4, 2]], 'Pending', r1, 2),
    mk(4, 'Alpha Solutions', '0345-9000004', w2, [[11, 10]], 'Cancelled', r2, 8),
    mk(5, 'Datawave Pvt Ltd', '0312-9000005', w3, [[6, 5], [7, 4]], 'Completed', r2, 15),
    mk(6, 'Student Hub', '0333-9000006', w3, [[2, 1]], 'Pending', r2, 1),
  ]);

  await M.SupplyRequest.create([
    { supplier: s1._id, product: prods[1]._id, warehouse: w1._id, quantity: 100, note: 'Restock - low inventory', status: 'Pending' },
    { supplier: s1._id, product: prods[4]._id, warehouse: w1._id, quantity: 60, status: 'Approved', reviewedBy: m1._id },
    { supplier: s2._id, product: prods[7]._id, warehouse: w1._id, quantity: 40, status: 'Pending' },
    { supplier: s2._id, product: prods[8]._id, warehouse: w2._id, quantity: 15, status: 'Rejected', reviewedBy: m1._id, note: 'Over capacity' },
    { supplier: s1._id, product: prods[3]._id, warehouse: w3._id, quantity: 20, status: 'Pending' },
  ]);

  console.log('Seeded. Logins: admin@demo.com / Admin@123, others (manager1, manager2, supplier1, supplier2, sales1, sales2 @demo.com) / Password@123');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
