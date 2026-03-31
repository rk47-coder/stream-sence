# StreamSense

Video upload, sensitivity screening (demo heuristic), Socket.io progress, and HTTP range streaming. **Express + MongoDB + Socket.io** backend, **React + Vite** frontend. **New uploads** are stored on disk under `UPLOAD_DIR`; older rows may still use **MongoDB GridFS** (`videos.files` / `videos.chunks`). Tenants are isolated; roles are **admin**, **editor**, **viewer**.

## Setup

- Node 20+, MongoDB (local or Atlas)
- Optional: `ffprobe` on PATH for duration metadata

```bash
# backend
cd backend && cp .env.example .env
# set MONGODB_URI, JWT_SECRET, CLIENT_ORIGIN=http://localhost:5173
npm install && npm run dev
# API → http://localhost:5050 (avoids macOS AirPlay on 5000)

# frontend
cd frontend && npm install && npm run dev
# UI → http://localhost:5173 (proxies /api and /socket.io when VITE_API_URL is empty)
```

Register once to create an organisation (you are **admin**). Use **Team** to add editors/viewers. Editors upload; viewers only see **shared** videos.

## API (short)

| Method | Path | Notes |
|--------|------|--------|
| POST | `/api/auth/register` | body: email, password, organizationName, name? |
| POST | `/api/auth/login` | email, password |
| GET | `/api/auth/me` | Bearer JWT |
| GET | `/api/users` | admin: all; editor: viewers only |
| POST | `/api/users` | admin — invite editor/viewer |
| PATCH | `/api/users/:id/role` | admin |
| POST | `/api/videos` | multipart `video`; optional title, description |
| GET | `/api/videos` | filters: status, sensitivity, search, fromDate, toDate, min/max size & duration |
| GET/PATCH/DELETE | `/api/videos/:id` | RBAC per tenant |
| POST | `/api/videos/:id/share` | `{ userIds }` viewers in tenant |
| GET | `/api/videos/:id/stream` | Range requests; Bearer or `?token=` for `<video>` |

Socket.io: connect with `auth: { token }`, listen for `video:progress`.

## Tests

```bash
cd backend && npm test
```

Coverage (writes `backend/coverage/`, optional): `cd backend && npm run test:cov`  
Clean generated junk: `npm run clean` (repo root) or `npm run clean` inside `backend` / `frontend`.

## Deploy (where it fits best, step-by-step)

### Where to host

| Option | When to use it |
|--------|----------------|
| **Single VPS + disk** (Hetzner, DigitalOcean, Linode, AWS Lightsail) | **Best fit for this app:** new uploads live on disk under `UPLOAD_DIR`; you get predictable playback and cost. |
| **Railway / Render + persistent volume** | Less server admin; you **must** attach a volume or uploads disappear on redeploy. |
| **Static frontend** (Vercel / Netlify / Cloudflare Pages) **+ separate API URL** | Fast UI on a CDN; point the app at the API with `VITE_API_URL`. |
| **MongoDB Atlas only** | Great for the database; without a VPS you can still use GridFS for bytes, but large files often see higher latency than local disk. |

**Rule of thumb:** run the API **in the same region as your users**, use **MongoDB Atlas** (same region if possible), and serve everything over **HTTPS**.

### Prerequisites

1. **Domain** (optional but ideal for HTTPS) — point DNS at your server or CDN.
2. **MongoDB Atlas** (free tier is fine for demos) — copy `MONGODB_URI`.
3. **Strong `JWT_SECRET`** — long random string (e.g. `openssl rand -hex 32`).
4. On the server: **`ffmpeg` + `ffprobe`** (optional but recommended) — MP4 faststart and duration.

---

### Path A — single VPS (recommended)

Use something like **Ubuntu 22.04 LTS**, at least **2 GB RAM**, **SSD**, and enough **disk** for video (e.g. 40 GB+).

#### Step 1 — install system packages

```bash
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx
# Node 20: https://github.com/nodesource/distributions — or install via nvm
```

#### Step 2 — clone the app

```bash
cd /var/www
sudo git clone <your-repo-url> streamsense
sudo chown -R $USER:$USER streamsense
cd streamsense/backend && npm ci --omit=dev
```

#### Step 3 — backend `.env` (production)

Create `backend/.env` with your values:

```env
PORT=5050
MONGODB_URI=mongodb+srv://USER:PASS@cluster.mongodb.net/dbname
JWT_SECRET=<long-random-secret>
CLIENT_ORIGIN=https://app.example.com
UPLOAD_DIR=/var/www/streamsense/data/uploads
```

Create the uploads directory: `mkdir -p /var/www/streamsense/data/uploads`

#### Step 4 — build the frontend (set the public API URL)

```bash
cd /var/www/streamsense/frontend
npm ci
VITE_API_URL=https://app.example.com npm run build
```

Use the URL where the browser will call the API. If nginx proxies `/api` on the **same** host, `VITE_API_URL` is that site origin. If the API is on another subdomain (e.g. `https://api.example.com`), set `VITE_API_URL` to that base URL.

#### Step 5 — process manager (PM2)

```bash
sudo npm i -g pm2
cd /var/www/streamsense/backend
pm2 start src/server.js --name streamsense-api
pm2 save && pm2 startup
```

#### Step 6 — Nginx: static UI + `/api` + Socket.io

Example `/etc/nginx/sites-available/streamsense` (replace `app.example.com`):

```nginx
server {
  listen 80;
  server_name app.example.com;
  root /var/www/streamsense/frontend/dist;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:5050;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 500M;
  }

  location /socket.io/ {
    proxy_pass http://127.0.0.1:5050;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 86400;
  }
}
```

Enable the site and reload:

```bash
sudo ln -s /etc/nginx/sites-available/streamsense /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d app.example.com
```

After HTTPS is live, keep **`CLIENT_ORIGIN`** and **`VITE_API_URL`** on **`https://`** and matching your real domain.

#### Step 7 — Atlas network access

In Atlas → Network Access, allow your server’s IP (for demos only, `0.0.0.0/0` works but is **not** recommended for production).

#### Step 8 — smoke test

- Open `https://app.example.com` → register / log in.
- Upload a short clip and confirm playback.
- If Socket.io fails, re-check nginx **Upgrade** / **Connection** headers for `/socket.io/`.

---

### Path B — frontend on Vercel, API on Railway / Render

1. **Backend:** Deploy the `backend` folder; mount a **persistent disk** and set **`UPLOAD_DIR`** to that path.
2. **Env:** `MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN=https://your-app.vercel.app` (or your custom domain).
3. **Start:** `node src/server.js` or `npm start`.
4. **Frontend (Vercel):** project root `frontend`, build `npm run build`, output `dist`.
5. **Vercel env:** `VITE_API_URL=https://your-api.up.railway.app` (your real public API URL).
6. **CORS:** `CLIENT_ORIGIN` must exactly match the frontend origin the browser uses (no trailing slash mismatch).

The host must allow **WebSockets** for Socket.io (Railway and Render usually do).

---

### Production checklist

- Never commit **`JWT_SECRET`**; keep `.env` only on the server.
- **`CLIENT_ORIGIN`** = the user-facing site URL over **https**.
- **`VITE_API_URL`** is baked in at **build** time — rebuild the frontend whenever the API base URL changes.
- For smoother video, keep the **VPS close to users** and install **`ffmpeg`** for MP4 faststart.
- Optional tuning env vars: **`VIDEO_STREAM_READ_BUFFER`**, **`VIDEO_GRIDFS_BUFFER`** (see earlier README / `.env.example` notes).

## License

MIT
