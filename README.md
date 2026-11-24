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

Create `server/.env` with the required settings:

```env
MONGO_URI=mongodb://127.0.0.1:27017/inventory-management
JWT_SECRET=replace-with-a-long-random-secret
CLIENT_URL=http://localhost:5173
PORT=5000
```

ImageKit settings (`IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, and `IMAGEKIT_URL_ENDPOINT`) are optional and are only needed for image uploads. SMTP settings are optional and are needed for low-stock email alerts.

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