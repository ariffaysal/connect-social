# ConnectSocial

**A private, self-hosted social network for your company or team** — a Facebook-style platform where employees post updates, share images, comment, and react, all behind your own login with role-based access, content moderation, and activity monitoring built in.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-10-e0234e?logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8-4479a1?logo=mysql&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-38bdf8?logo=tailwindcss&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

---

## 🖥️ Self-hosted

ConnectSocial is designed to run on your own machines — see [Getting Started](#-getting-started) to run it locally in ~5 minutes.

---

## ✨ What it does

ConnectSocial replaces public group chats and email threads with a dedicated, **private** internal network:

- **Company-wide or department-scoped posts** — share updates with everyone or with a team (Engineering, Marketing, Sales, HR, Finance…)
- **Comments & reactions** — `like`, `love`, or `wow` any post or comment, with live counts
- **Image sharing** — attach images to posts via a validated, magic-byte-checked upload endpoint
- **Rich profiles** — avatar, job title, bio, department, and a public profile page showing each person's posts, comments, and reaction stats
- **Notifications** — a bell with an unread counter, pushed in **real time over WebSocket** when something new happens
- **Content moderation** — anyone can report a post/comment; Moderators get a queue and can dismiss the report or resolve it (optionally deleting the content)
- **Admin monitoring** — SuperAdmins see analytics overviews, per-day activity trends, a full audit timeline, per-user activity history, and an engagement leaderboard
- **Role-based access control** — four clearly separated roles (see below) enforced on both the API and the UI

### Roles & permissions

| Role | What they can do |
| ---- | ---------------- |
| **SuperAdmin** | Everything: manage users & departments, view analytics/monitoring, moderate reports, delete any content |
| **Moderator** | Review and resolve/dismiss reports, delete any post or comment |
| **RegularUser** | Create posts/comments, react, upload images, manage their own content and profile |
| **Guest** | Read-only access to the feed and profiles (must still be logged in) |

---

## 🧱 Tech stack

| Layer | Technology |
| ----- | ---------- |
| **Frontend** | [Next.js](https://nextjs.org) 15 (Pages Router), React 18, [Tailwind CSS](https://tailwindcss.com) 3, TypeScript 5 |
| **Backend** | [NestJS](https://nestjs.com) 10 REST API, [Passport](https://www.passportjs.org) + JWT auth |
| **Database** | [MySQL](https://www.mysql.com) 8 via [TypeORM](https://typeorm.io) |
| **Realtime** | Native WebSocket server (`ws`) at `/ws` — live notification & moderation-count push |
| **Security** | `bcryptjs` password hashing, [Helmet](https://helmetjs.github.io) headers, [@nestjs/throttler](https://docs.nestjs.com/security/rate-limiting) rate limiting, input validation with `class-validator` |
| **Tooling** | npm workspaces monorepo, Jest + Supertest e2e test suite |

### Architecture

```
┌──────────────────────┐      HTTPS (REST JSON)       ┌───────────────────────────┐
│  Browser / Next.js   │ ───────────────────────────► │   NestJS backend (3001)   │
│       (local)        │ ◄─────────────────────────── │   auth · posts · comments │
└──────────────────────┘                              │   reactions · reports     │
         │                                            │   notifications · monitor │
         └────────── WebSocket /ws?token=<JWT> ──────►│   uploads · users         │
            (real-time notifications)                 └────────────┬──────────────┘
                                                                   │
                                                   ┌───────────────┴───────────────┐
                                                   │   MySQL 8 (TypeORM entities)  │
                                                   │   + local /uploads directory  │
                                                   └───────────────────────────────┘
```

---

## 📁 Project structure

```
connect-social/
├── backend/                  # NestJS REST API + WebSocket server
│   ├── src/
│   │   ├── auth/             # Login, JWT strategy, bcrypt, roles & guards
│   │   ├── users/            # User management + demo seeding
│   │   ├── departments/      # Departments & team membership
│   │   ├── posts/            # Posts CRUD, department feed filtering
│   │   ├── comments/         # Comments CRUD
│   │   ├── reactions/        # like / love / wow on posts & comments
│   │   ├── notifications/    # In-app notifications, unread counts
│   │   ├── reports/          # Moderation queue (report → resolve/dismiss)
│   │   ├── monitoring/       # Analytics, activity timeline, leaderboard
│   │   ├── realtime/         # WebSocket hub (/ws)
│   │   ├── uploads/          # Image upload endpoint (magic-byte validated)
│   │   └── main.ts           # Helmet, CORS, global validation
│   └── test/                 # e2e security test suite (Jest + Supertest)
├── frontend/                 # Next.js web app
│   └── src/
│       ├── lib/              # API config, auth helpers, upload helper
│       ├── components/       # TopNav (with live notification bell), …
│       └── pages/            # index (landing), login, feed, notifications,
│                             # moderation, monitoring, admin, profile(s)
├── package.json              # npm workspaces root (frontend + backend)
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- [MySQL](https://www.mysql.com) 8 (local or remote)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the backend

```bash
cd backend
cp .env.example .env
```

At minimum, generate a strong JWT secret and paste it into `.env` (the backend **refuses to start** if `JWT_SECRET` is missing, shorter than 32 chars, or still the placeholder):

```bash
openssl rand -base64 48
```

Create the database (TypeORM creates the tables automatically in dev mode):

```sql
CREATE DATABASE connect_social CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. Run both apps

```bash
npm run dev
```

- Frontend: **http://localhost:3000**
- Backend API: **http://localhost:3001** (WebSocket at `ws://localhost:3001/ws`)

On first start the backend seeds demo accounts and sample content (only if the database is empty):

| Username | Password | Role |
| -------- | -------- | ---- |
| `admin` | `password` | SuperAdmin |
| `moderator` | `password` | Moderator |
| `user` | `password` | RegularUser |
| `guest` | `guest123` | Guest |

Log in as **`admin` / `password`** to explore the full admin, monitoring, and moderation experience.

---

## 🔌 API overview

Base URL: `http://localhost:3001` — every request (except login) requires `Authorization: Bearer <JWT>`.

| Method & path | Description | Access |
| ------------- | ----------- | ------ |
| `POST /auth/login` | Log in, returns JWT (rate-limited to 5/min) | Public |
| `GET /auth/profile` | Current user's profile | Any authenticated user |
| `GET/POST /posts` · `GET/PATCH/DELETE /posts/:id` | Posts CRUD; list supports `?departmentId=` & `?scope=` | Read: all roles · Write: RegularUser+ |
| `GET/POST /posts/:postId/comments` · `DELETE /comments/:id` | Comments | Write: RegularUser+ |
| `POST /posts/:id/react` · `POST /comments/:id/react` | Toggle a reaction | RegularUser+ |
| `POST /reports` | Report a post/comment | RegularUser+ (10/min) |
| `GET /reports` · `PATCH /reports/:id/resolve` · `PATCH /reports/:id/dismiss` | Moderation queue | SuperAdmin, Moderator |
| `GET /notifications` · `GET /notifications/unread-count` · `PATCH …/read` · `PATCH /notifications/read-all` | Notifications | Authenticated (own only) |
| `GET /monitoring/overview` · `/timeline` · `/activity` | Analytics & audit trail | SuperAdmin |
| `GET /monitoring/top-users` | Engagement leaderboard | Authenticated |
| `POST /uploads` | Upload an image (PNG/JPG/GIF/WebP, ≤5 MB) | RegularUser+ |
| `GET /ws?token=<JWT>` | WebSocket — live events | Authenticated |

**Realtime events** (received over the socket as JSON): `notifications:new` is pushed to all connected users when a new post is created; `reports:count` is pushed to Moderators/SuperAdmins when the pending queue changes.

---

## 🔐 Security features

- **bcrypt password hashing** — with an automatic upgrade path: accounts still storing legacy plaintext passwords are re-hashed on their next successful login
- **Enforced `JWT_SECRET`** — startup fails fast if the secret is missing, weak, or a placeholder
- **Role checks on every admin endpoint** — `SuperAdmin`/`Moderator` routes are guarded server-side, not just hidden in the UI
- **Rate limiting** — global defaults plus stricter limits on `/auth/login` and `/reports`
- **Upload validation** — image content is verified via magic bytes, not just the declared MIME type
- **Security headers** — Helmet on the API (CSP configured in `next.config.js`)
- **Authenticated reads** — anonymous access is closed; even read-only Guests must log in
- **E2e security test suite** — see [Testing](#-testing)

---

## ☁️ Deployment

### Overview

ConnectSocial ships with a production Docker Compose stack — MySQL 8, the NestJS
API (REST + WebSocket), the Next.js frontend and Caddy for automatic HTTPS —
that runs for **$0** on a free always-on VM. Everything is served from a single
HTTPS origin:

```
https://<your-domain>
├── /api/*      -> NestJS API + WebSocket hub (the /api prefix is stripped)
├── /uploads/*  -> NestJS (uploaded post images)
└── /*          -> Next.js frontend (next start)
```

The app needs a long-running process (WebSocket hub) and a persistent disk
(uploaded images), which is why it is deployed to a small VM rather than a
serverless or scale-to-zero platform.

### 0. Try the production stack locally (optional)

```bash
cp .env.example .env
# in .env: DOMAIN=localhost, NEXT_PUBLIC_API_URL=http://localhost/api,
#          CORS_ORIGIN=http://localhost
docker compose up -d --build
```

Then open `https://localhost` — Caddy creates a local certificate for
`localhost`, so the browser warns once. (Use HTTPS; Caddy redirects from HTTP.)

### 1. Create the free server

Oracle Cloud's **Always Free** tier includes a permanently free VM (Ampere ARM,
2 OCPU / 12 GB RAM, ~200 GB of storage):

1. Sign up at <https://www.oracle.com/cloud/free/>. A card is required for
   identity verification; Always Free resources are never charged.
2. Create an instance: image **Ubuntu 24.04**, shape **VM.Standard.A1.Flex**
   (2 OCPU / 12 GB), 100 GB boot volume, and add your SSH public key.
3. If creation fails with "Out of host capacity", try another availability
   domain — or the always-free AMD micro shape (1 GB RAM; add 2 GB of swap).
4. Note the instance's public IP.

### 2. Open ports 80 and 443

Both layers are required on Oracle:

- **VCN security list** — Networking → Virtual Cloud Networks → your VCN →
  Subnet → Security Lists → Add Ingress Rules: source `0.0.0.0/0`, TCP 80 & 443.
- **Instance firewall** — Oracle's Ubuntu images drop everything except SSH:

  ```bash
  sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
  sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
  sudo netfilter-persistent save
  ```

### 3. Point a free domain at the server

Create a subdomain at <https://www.duckdns.org> (say `connectsocial`) and set
its IP to the instance's public IP. Verify from your own machine:

```bash
dig +short connectsocial.duckdns.org
```

DNS must already resolve to the server before the first start, because Caddy
requests a Let's Encrypt certificate on boot.

### 4. Install Docker and start the stack

On the server:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER" && newgrp docker

sudo mkdir -p /opt/connectsocial && sudo chown "$USER" /opt/connectsocial
git clone YOUR_REPO_URL /opt/connectsocial   # for a private repo use its SSH URL + a deploy key
cd /opt/connectsocial

cp .env.example .env
openssl rand -base64 48      # paste the output into JWT_SECRET
nano .env                    # DOMAIN, NEXT_PUBLIC_API_URL, CORS_ORIGIN,
                             # DB_PASSWORD, JWT_SECRET
```

### 5. First boot — create the schema, then lock it down

The repository has no baseline migration and production mode never creates
tables on its own, so the **first** start runs with the `.env.example` defaults
`NODE_ENV=development` + `DB_SYNCHRONIZE=true`. That creates every table and
seeds the demo data:

```bash
docker compose up -d --build
docker compose ps                 # wait until api and mysql report healthy
curl -s https://YOUR_DOMAIN/api/health
```

Then switch to production behaviour so later starts never mutate the schema:

```bash
sed -i 's/^NODE_ENV=.*/NODE_ENV=production/; s/^DB_SYNCHRONIZE=.*/DB_SYNCHRONIZE=false/; s/^DB_MIGRATIONS_RUN=.*/DB_MIGRATIONS_RUN=true/' .env
docker compose up -d
```

### 6. Secure the seeded demo accounts

The first boot seeds `admin`/`password`, `moderator`/`password`,
`user`/`password` and `guest`/`guest123`. Before sharing the URL:

1. Log in as **admin / password**.
2. Admin → open the `admin` account → set a strong password.
3. Deactivate (or delete) `moderator`, `user` and `guest`, then create real
   accounts with the right roles — disabled accounts cannot log in.

### 7. Verify the deployment

- `https://YOUR_DOMAIN` loads with a valid certificate, and plain HTTP redirects.
- Login, posting, commenting and reacting all work.
- Open the app in two browsers: a new post in one shows the live toast and bell
  badge in the other (WebSocket through Caddy).
- Uploading an image returns an `https://…/uploads/…` URL that renders in the feed.
- `docker compose restart api`, then reload — the uploaded image is still there.

### Operating the deployment

```bash
docker compose ps               # status + health
docker compose logs -f api      # follow logs (caddy / web / mysql too)
docker compose up -d --build    # apply updates after `git pull`
docker compose down             # stop; data stays in the named volumes
```

**Backups** — `deploy/backup.sh` dumps the database and archives the uploaded
images into `./backups` (7-day rotation by default):

```bash
crontab -e
15 3 * * * /opt/connectsocial/deploy/backup.sh >> /var/log/connectsocial-backup.log 2>&1
```

Copy those archives off the machine (`scp`, `rclone`, …) — a backup that only
exists on the server is not a backup. Certificates live in the `caddy-data`
volume and renew automatically.

### Troubleshooting

| Symptom | Likely cause |
| ------- | ------------ |
| No certificate / HTTPS handshake fails | DNS not pointing at the server yet, or port 80 blocked — check `docker compose logs caddy` |
| `502` from Caddy | `api` or `web` still starting or crashed — `docker compose ps`, then `docker compose logs api` |
| API up but "table doesn't exist" | First boot was skipped — redo step 5 |
| Uploaded images don't render | `TRUST_PROXY` must be `1` behind Caddy (it is by default) |
| Live notifications never arrive | Socket path is `/api/ws`; check the browser console and `docker compose logs caddy` |
| Changed `DOMAIN`, app still calls the old URL | `NEXT_PUBLIC_API_URL` is compiled in at build time — `docker compose up -d --build web` |

### Cost

$0 — Oracle Always Free VM, DuckDNS subdomain, Let's Encrypt certificates and
Docker are all free. Optional extras that cost money: a custom domain, or a
second free VM / off-site storage for backups.

### Manual (non-Docker) alternative

```bash
cd backend  && npm install && npm run build && npm start     # port 3001
cd frontend && NEXT_PUBLIC_API_URL=http://localhost:3001 npm run build && npm start
```

Set the backend environment variables manually (see `backend/.env.example`) and
put a reverse proxy in front of both. The Compose runbook above is what this
repository tests and supports.

---

## 🧪 Testing

The backend ships an end-to-end security test suite (Jest + Supertest) that boots the real app against a throwaway `connect_social_test` database:

```bash
npm run test:backend
```

The suite expects MySQL on `127.0.0.1:3307` (adjust `backend/test/env.ts` to match your setup) and drops/recreates the test schema on every run.

---

## 🗺️ Roadmap

- Pagination for feeds and comments
- TypeORM migrations (replace `synchronize` in production)
- Notifications for comments/reactions on your posts; email digests
- Search & hashtags
- SSO / SAML integration and audit export

---

## 📄 License

Released under the [MIT License](LICENSE).

---

Built with ❤️ by [ariffaysal](https://github.com/ariffaysal).
