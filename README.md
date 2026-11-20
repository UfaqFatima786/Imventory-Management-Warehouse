# StockYard - Inventory & Warehouse Management System (MERN)

Four role-based dashboards (Admin, Warehouse Manager, Supplier, Sales Representative), warehouse-level stock,
atomic stock-in/out, sales orders with single-deduction processing, supply-request approvals and ImageKit uploads.

## Quick start
```bash
# 1. API
cd server && cp .env.example .env     # fill MONGO_URI, JWT_SECRET, ImageKit keys
npm install
npm run seed                          # loads dummy data (wipes the DB first!)
npm run dev                           # http://localhost:5000

# 2. Web app (new terminal)
cd client && npm install && npm run dev   # http://localhost:5173 (proxies /api to :5000)
```
The app works without ImageKit keys (seed data uses placeholder images); uploads need the three IMAGEKIT_* values.

Copy `server/.env.example` to `server/.env` and set your MongoDB URI and a private JWT secret. To enable low-stock email alerts, also set the SMTP host, port, username, password and sender address. Alerts go to registered Admin email addresses when stock crosses down to its configured low-stock limit.

## Demo logins (after `npm run seed`)
| Role | Email | Password |
|---|---|---|
| Admin | admin@demo.com | Admin@123 |
| Warehouse manager | manager1@demo.com (Karachi Central, Port Qasim) / manager2@demo.com (Lahore Hub) | Password@123 |
| Supplier | supplier1@demo.com / supplier2@demo.com | Password@123 |
| Sales rep | sales1@demo.com / sales2@demo.com | Password@123 |

## Try the instructor scenario
1. Admin: Products -> add Laptop (upload image, Rs. 80,000, limit 5); Users -> create roles; Warehouses -> assign manager.
2. Manager: Inventory -> Add stock 20 laptops, Remove 3 -> 17, both appear in Stock history.
3. Sales rep: Orders -> New order, 2 laptops = Rs. 160,000. Ordering more than available is blocked.
4. Manager/Admin: Process the order -> stock 15. Processing again is rejected (409).
5. Security: as supplier call `GET /api/users` -> 403; manager of Lahore calling Karachi stock -> 403; rep opening another rep's order -> 403.

## Design notes
- **Roles are enforced on the server** (`middleware/auth.js`: `authorize`, `canAccessWarehouse`); React guards are cosmetic.
- **Stock never goes negative**: stock-out uses `findOneAndUpdate({quantity:{$gte:q}}, {$inc:{quantity:-q}})`.
- **Deduct once**: `Pending -> Processing` is claimed atomically; a failed multi-line deduction is rolled back. Works without replica-set transactions.
- **Unique Stock row** per product+warehouse via compound unique index. Prices on orders always come from the DB.
- **ImageKit**: `GET /api/upload/auth` validates declared type/size and returns signed params; browser uploads directly; backend only accepts URLs under your ImageKit endpoint and deletes replaced files by `fileId`.
- Public registration cannot create Admins. Passwords hashed with bcryptjs (pure-JS bcrypt).
- Approving a supply request records the decision; the manager then books the delivery via Inventory -> Add stock.

## Bonus features
- **Warehouse transfers**: Inventory -> Transfer stock records paired transfer-out and transfer-in transactions. Both warehouses must be accessible to the operator, and destination capacity is checked.
- **PDF invoices**: Completed orders can be downloaded as PDF invoices from Orders.
- **Product discovery**: Filter by category, supplier, warehouse and stock availability; search accepts product name, SKU or barcode. Barcode values are optional and unique.
- **Analytics**: Admins and warehouse managers can view six months of completed sales and stock movement, plus the top-selling products in their data scope.
- **Activity log**: Admins can view all recorded operations; warehouse managers see operations for their assigned warehouses.
- **Low-stock email alerts**: Configure the SMTP_* variables in `server/.env`. Alerts are sent to Admin users when a stock level crosses down to its product's low-stock limit.

## API
All endpoints from the task sheet are implemented, plus `GET /api/stats`, `GET /api/users/suppliers`, `GET /api/products/categories`, `POST /api/users`.
