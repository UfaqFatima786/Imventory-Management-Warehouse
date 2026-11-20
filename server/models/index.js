const bcrypt = require('bcryptjs');
const { Schema, model } = require('mongoose');
const ref = (r) => ({ type: Schema.Types.ObjectId, ref: r });

const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  phone: String,
  role: { type: String, enum: ['admin', 'warehouseManager', 'supplier', 'salesRepresentative'], default: 'salesRepresentative' },
  assignedWarehouses: [ref('Warehouse')],
  image: String, imageFileId: String,
}, { timestamps: true, toJSON: { transform: (d, r) => { delete r.password; return r; } } });
userSchema.pre('save', async function (next) {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 10);
  next();
});

const productSchema = new Schema({
  name: { type: String, required: true, trim: true },
  description: String,
  sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
  barcode: { type: String, unique: true, sparse: true, trim: true },
  category: { type: String, trim: true },
  price: { type: Number, required: true, min: 0 },
  lowStockLimit: { type: Number, default: 10, min: 0 },
  imageUrl: String, imageFileId: String,
  supplier: ref('User'), createdBy: ref('User'),
}, { timestamps: true });

const warehouseSchema = new Schema({
  name: { type: String, required: true, trim: true },
  location: String,
  manager: ref('User'),
  capacity: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

const stockSchema = new Schema({
  product: { ...ref('Product'), required: true },
  warehouse: { ...ref('Warehouse'), required: true },
  quantity: { type: Number, default: 0, min: 0 },
});
stockSchema.index({ product: 1, warehouse: 1 }, { unique: true }); // no duplicate product rows per warehouse

const txSchema = new Schema({
  product: ref('Product'), warehouse: ref('Warehouse'),
  transactionType: { type: String, enum: ['stock-in', 'stock-out', 'transfer-in', 'transfer-out'], required: true },
  quantity: { type: Number, required: true, min: 1 },
  note: String, performedBy: ref('User'),
  date: { type: Date, default: Date.now },
});

const activitySchema = new Schema({
  action: { type: String, required: true },
  details: { type: String, required: true },
  user: ref('User'),
  warehouse: ref('Warehouse'),
  entityType: String,
  entityId: String,
}, { timestamps: true });
activitySchema.index({ createdAt: -1 });

const notificationSchema = new Schema({
  recipient: { ...ref('User'), required: true },
  actor: ref('User'),
  title: { type: String, required: true },
  message: { type: String, required: true },
  category: { type: String, default: 'activity' },
  link: { type: String, default: '/' },
  entityId: String,
  readAt: { type: Date, default: null },
}, { timestamps: true });
notificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 });

const orderSchema = new Schema({
  orderNumber: { type: String, unique: true },
  customerName: { type: String, required: true }, customerPhone: String,
  products: [{ product: ref('Product'), quantity: Number, price: Number, _id: false }],
  totalAmount: Number,
  warehouse: ref('Warehouse'), createdBy: ref('User'),
  completedAt: Date,
  status: { type: String, enum: ['Pending', 'Processing', 'Completed', 'Cancelled'], default: 'Pending' },
}, { timestamps: true });

const supplySchema = new Schema({
  supplier: ref('User'), product: ref('Product'), warehouse: ref('Warehouse'),
  quantity: { type: Number, required: true, min: 1 }, note: String,
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  reviewedBy: ref('User'),
}, { timestamps: true });

module.exports = {
  User: model('User', userSchema), Product: model('Product', productSchema),
  Warehouse: model('Warehouse', warehouseSchema), Stock: model('Stock', stockSchema),
  StockTransaction: model('StockTransaction', txSchema), Order: model('Order', orderSchema),
  SupplyRequest: model('SupplyRequest', supplySchema), ActivityLog: model('ActivityLog', activitySchema),
  Notification: model('Notification', notificationSchema),
};
