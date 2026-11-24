# Inventory Management System

A full-stack inventory management application with a React/Vite client and an Express/MongoDB API.

## Project structure

- `client/` — React frontend, pages, and Vite configuration
- `server/` — Express API, MongoDB models, routes, and services

Each application has its own `package.json` and lockfile. Install dependencies from the corresponding directory.

## Requirements

- Node.js 18 or newer
- MongoDB, local or hosted

## Setup

Open two terminals from the project root.

Frontend terminal:

```sh
cd client
npm install
```

Backend terminal:

```sh
cd server
npm install
```

Copy `server/.env.example` to `server/.env`, then set `MONGO_URI` and a private `JWT_SECRET`. The ImageKit settings are optional and only needed for image uploads. SMTP settings are optional and needed for low-stock email alerts. `client/.env.example` is only needed when the API is hosted on a different origin.

Start the API in the backend terminal:

```sh
npm run dev
```

Start the frontend in the frontend terminal:

```sh
npm run dev
```

Open `http://localhost:5173`.

## Seed data

`npm run seed` from `server/` loads demo accounts and inventory data. **It deletes all existing application data in the configured MongoDB database first**, so only run it against a disposable development database.

After seeding, demo logins are:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@demo.com` | `Admin@123` |
| Warehouse manager | `manager1@demo.com` or `manager2@demo.com` | `Password@123` |
| Supplier | `supplier1@demo.com` or `supplier2@demo.com` | `Password@123` |
| Sales representative | `sales1@demo.com` or `sales2@demo.com` | `Password@123` |