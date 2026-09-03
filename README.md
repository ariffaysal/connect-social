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

## 🖥️ Live demo

A public instance of the app is running at **[https://connect-social-five.vercel.app](https://connect-social-five.vercel.app)** — open it to see the UI in action.

> 💡 This is a self-hostable project: you can also run it on your own machines (or free hosting tiers) in ~5 minutes — see [Getting Started](#-getting-started).

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
│  (Vercel or local)   │ ◄─────────────────────────── │   auth · posts · comments │
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

### Frontend → Vercel (free tier)

1. Push this repository to GitHub.
2. In Vercel, **Add New Project** → import the repo → set **Root Directory** to `frontend`.
3. Add the environment variable `NEXT_PUBLIC_API_URL` pointing at your hosted backend.
4. Deploy. (That's how the [live demo](https://connect-social-five.vercel.app) is hosted.)

### Backend → Railway / Render / any Node host

The API needs a Node.js runtime and a reachable MySQL database. Railway and Render offer free starter tiers with managed MySQL add-ons.

```bash
PORT=3001
CORS_ORIGIN=https://your-frontend.vercel.app   # comma-separate multiple origins, or * to allow all
DB_HOST=your-mysql-host
DB_PORT=3306
DB_USERNAME=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=connect_social
DB_SYNCHRONIZE=false                            # use migrations in production
JWT_SECRET=<long-random-value>                  # openssl rand -base64 48
```

Then build and start:

```bash
cd backend
npm install
npm run build
npm start
```

> 📦 Uploaded images are stored in an `uploads/` directory next to the backend process — make sure that directory is **persistent** on your host (a mounted volume on Railway/Render, or a disk on a VPS).

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
