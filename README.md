# HyperLocal Grocery — MERN Multi-Store App

Pixel-faithful hyperlocal grocery marketplace with multi-store price compare, Socket.IO live rider tracking, on-demand home services, store owner portal, and rider hub.

## Stack

- **Frontend:** React (Vite) + Tailwind CSS + Leaflet + Socket.IO client
- **Backend:** Node.js + Express + MongoDB (Mongoose) + Socket.IO
- **Runner:** Root `concurrently` script starts API `:5000` and Vite `:5173`

## Quick start

### 1. Install

From the repo root:

```bash
npm run install:all
```

Or manually:

```bash
npm install
npm install --prefix server
npm install --prefix client
```

### 2. Environment

```bash
# Server
cp server/.env.example server/.env

# Client (optional for local defaults)
cp client/.env.example client/.env
```

Ensure MongoDB is running locally, or point `MONGODB_URI` at [MongoDB Atlas](https://www.mongodb.com/atlas).

### 3. Seed sample data

```bash
npm run seed
```

Seeds catalog data into MongoDB when you run seed. **All portal logins require OTP** (no shared demo passwords on the login screen).

### 4. Run development

```bash
npm run dev
```

- Customer app: http://localhost:5173  
- API + Socket.IO: http://localhost:5000  
- Health check: http://localhost:5000/api/health  

**All catalog content is dynamic** (MongoDB). If the API is down, the UI shows an empty catalog + offline banner — there is no static mock fallback. Cart/location still use `localStorage` for session convenience only.

**Super Admin → KYC Approvals** has live forms to add stores, riders, and services (persisted to Mongo).

## Production build

```bash
# Build optimized React bundle → client/dist
npm run build --prefix client

# Serve API (+ static React when NODE_ENV=production)
# Set NODE_ENV=production in server/.env first
npm run start --prefix server
```

With `NODE_ENV=production`, Express serves `client/dist` and SPA routes automatically when the folder exists.

## Deploy

### Frontend → Vercel

1. Set project root to `client/` (or configure Vite root).
2. Build command: `npm run build`
3. Output directory: `dist`
4. Environment variables:
   - `VITE_API_URL` = `https://YOUR-API.onrender.com/api`
   - `VITE_SOCKET_URL` = `https://YOUR-API.onrender.com`
5. Redeploy after changing env vars.

### Backend → Render / Railway

1. Root directory: `server/`
2. Build: `npm install`
3. Start: `node server.js` (or `npm start`)
4. Environment variables (from `server/.env.example`):
   - `PORT` (platform often injects this)
   - `MONGODB_URI` → MongoDB Atlas connection string
   - `JWT_SECRET` → strong random secret
   - `CLIENT_ORIGIN` → your Vercel URL (e.g. `https://hyperlocal.vercel.app`)
   - `NODE_ENV=production`
5. Enable WebSockets / persistent connections for Socket.IO.

### Database → MongoDB Atlas

1. Create a free cluster and database user.
2. Allow network access (or `0.0.0.0/0` for demos).
3. Copy the `mongodb+srv://…` URI into `MONGODB_URI`.
4. Run seed once against Atlas:

```bash
# from server/ with Atlas URI in .env
npm run seed
```

### Single-host option

Build the client, set `NODE_ENV=production`, and deploy only the `server/` process — it will serve `../client/dist` if present (monorepo layout).

## Project structure

```
├── client/                 # Vite React app
│   ├── src/
│   │   ├── components/     # UI, modals, tracking, services, stores
│   │   ├── context/        # Cart + Platform state
│   │   ├── data/mockData.js
│   │   ├── pages/          # CustomerHome, StoreAdmin, RiderHub
│   │   ├── services/       # api.js + socket.js (offline-aware)
│   │   └── utils/          # geo, audio, offlineStore
│   └── .env.example
├── server/                 # Express API + Socket.IO
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── sockets/
│   ├── scripts/seed.js
│   └── .env.example
├── html-design/            # Original pixel reference
├── package.json            # concurrently runner
└── README.md
```

## Roles (demo switcher in header)

| Role | What you can do |
|------|-----------------|
| Customer | Shop, compare stores, UPI checkout, live tracking, services |
| Store Portal | Creator Studio, pricing matrix, dispatch queue |
| Super Admin | KYC approvals |
| Rider Hub | Radar alerts, GPS pings, OTP delivery complete |

## Scripts reference

| Command | Description |
|---------|-------------|
| `npm run install:all` | Install root + server + client deps |
| `npm run seed` | Seed MongoDB catalog |
| `npm run dev` | API + Vite together |
| `npm run build` | Production client build |
| `npm run start --prefix server` | Start API (serves `client/dist` in production) |
