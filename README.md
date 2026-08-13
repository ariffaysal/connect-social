# ConnectSocial

> A private social media platform for companies and teams. Share posts, comment, and moderate content — all behind your own login with role-based access control.

ConnectSocial is a full-stack, self-hostable social network built for internal company communication. It gives your organization a familiar social feed (posts + comments) while keeping everything private, moderated, and under your control.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-10-e0234e?logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8-4479a1?logo=mysql&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3-38bdf8?logo=tailwindcss&logoColor=white)

---

## ✨ Features

- **Social feed** — create posts, read updates, and leave comments on any post
- **Role-based access control** — four roles with clearly defined permissions:
  - **SuperAdmin** — full access, can delete anything, manages all accounts
  - **Moderator** — can delete any post or comment
  - **RegularUser** — creates posts/comments and manages their own content
  - **Guest** — read-only access
- **Admin dashboard** — create users and assign roles, view all accounts
- **JWT authentication** — secure, stateless login with protected routes
- **Modern UI** — responsive Tailwind CSS interface
- **Self-hostable** — deploy anywhere; fully configurable via environment variables

## 🧱 Tech Stack

| Layer      | Technology                                            |
| ---------- | ----------------------------------------------------- |
| Frontend   | [Next.js](https://nextjs.org) 15 + React 18 + Tailwind CSS |
| Backend    | [NestJS](https://nestjs.com) 10 + Passport JWT        |
| Database   | [MySQL](https://www.mysql.com) via TypeORM             |
| Auth       | JWT (stateless) with role-based guards                |
| Monorepo   | npm workspaces                                        |

## 📁 Project Structure

```
connect-social/
├── backend/                 # NestJS REST API
│   └── src/
│       ├── auth/            # Login, JWT strategy, roles & guards
│       ├── users/           # User management (SuperAdmin only)
│       ├── posts/           # Posts CRUD
│       └── comments/        # Comments CRUD
├── frontend/                # Next.js web app (Pages Router)
│   └── src/
│       ├── lib/             # Shared config (API base URL)
│       └── pages/           # Login, feed, profile, admin dashboard
├── package.json             # npm workspaces root
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- [MySQL](https://www.mysql.com) 8+ (local or remote)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the backend

Create `backend/.env` (copy from `backend/.env.example`):

```bash
PORT=3001
CORS_ORIGIN=http://localhost:3000

DB_HOST=127.0.0.1
DB_PORT=3307
DB_USERNAME=root
DB_PASSWORD=
DB_NAME=connect_social
DB_SYNCHRONIZE=true

JWT_SECRET=change-me-to-a-long-random-value
```

Make sure the database exists (TypeORM will create the tables automatically in dev mode).

### 3. Run both apps

```bash
npm run dev
```

- Frontend: **http://localhost:3000**
- Backend API: **http://localhost:3001**

> The frontend falls back to `http://localhost:3001` in development. To point it elsewhere, set `NEXT_PUBLIC_API_URL` in `frontend/.env.local`.

### 4. Log in with a demo account

| Username   | Password   | Role        |
| ---------- | ---------- | ----------- |
| `admin`    | `password` | SuperAdmin  |
| `moderator`| `password` | Moderator   |
| `user`     | `password` | RegularUser |
| `guest`    | `guest123`| Guest       |

## 🔐 Role Permissions

| Action                    | SuperAdmin | Moderator | RegularUser | Guest |
| ------------------------- | :--------: | :-------: | :---------: | :---: |
| View posts & comments     |     ✅     |     ✅    |      ✅     |   ✅  |
| Create posts & comments   |     ✅     |     ✅    |      ✅     |   ❌  |
| Edit own content          |     ✅     |     ✅    |      ✅     |   ❌  |
| Delete any post/comment   |     ✅     |     ✅    |      ❌     |   ❌  |
| Manage user accounts      |     ✅     |     ❌    |      ❌     |   ❌  |

## 🔌 API Overview

Base URL: `http://localhost:3001`

| Method | Endpoint                      | Access                | Description              |
| ------ | ----------------------------- | --------------------- | ------------------------ |
| POST   | `/auth/login`                 | Public                | Login, returns JWT       |
| GET    | `/auth/profile`               | Authenticated         | Current user profile     |
| GET    | `/posts`                      | Public                | List all posts           |
| GET    | `/posts/:id`                  | Public                | Get a single post        |
| POST   | `/posts`                      | SuperAdmin/Moderator/RegularUser | Create a post  |
| PATCH  | `/posts/:id`                  | Owner or SuperAdmin   | Update a post            |
| DELETE | `/posts/:id`                  | Owner/Moderator/SuperAdmin | Delete a post        |
| GET    | `/posts/:postId/comments`     | Public                | List comments on a post  |
| POST   | `/posts/:postId/comments`     | SuperAdmin/Moderator/RegularUser | Add a comment  |
| DELETE | `/comments/:id`               | Owner/Post owner/Moderator/SuperAdmin | Delete a comment |
| GET    | `/users`                      | SuperAdmin            | List all users           |
| POST   | `/users`                      | SuperAdmin            | Create a user            |

All authenticated requests must send `Authorization: Bearer <token>`.

## ☁️ Deployment

### Frontend → Vercel

The web app is a standard Next.js project and deploys to [Vercel](https://vercel.com) with zero config:

1. Push this repository to GitHub.
2. In Vercel, **Add New Project** → import the repo → set **Root Directory** to `frontend`.
3. Add the environment variable:
   - `NEXT_PUBLIC_API_URL` — the public URL of your hosted backend (below).
4. Deploy.

Or from the CLI (from the repo root):

```bash
npx vercel --prod --yes
```

### Backend → any Node host

The NestJS API needs a Node.js runtime and a reachable MySQL database. Good options:

- [Railway](https://railway.app) / [Render](https://render.com) — easy, with managed MySQL add-ons
- A VPS with Docker or PM2 + a MySQL server

Set these environment variables on the host (see `backend/.env.example`):

```bash
PORT=3001
CORS_ORIGIN=https://your-frontend.vercel.app
DB_HOST=your-mysql-host
DB_PORT=3306
DB_USERNAME=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=connect_social
DB_SYNCHRONIZE=false
JWT_SECRET=<long-random-value>
```

Then build and start:

```bash
cd backend
npm install
npm run build
npm start
```

## 🧪 Development Notes

- `DB_SYNCHRONIZE=true` auto-creates/updates tables on startup — ideal for development. In production set it to `false` and manage schema with TypeORM migrations.
- The demo accounts are seeded automatically on first backend start.
- Passwords are stored in plain text in this starter project — add hashing (e.g. bcrypt) before production use.

## 🗺️ Roadmap Ideas

- Profile pages with avatars, bios, and activity
- Likes/reactions and post images
- Notifications & mentions
- Search and hashtags
- Password hashing (bcrypt/argon2) and password reset
- Comments threading and pagination

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

Built with ❤️ by [ariffaysal](https://github.com/ariffaysal).
