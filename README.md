# RBMS Task Monorepo

This workspace contains a full-stack starter:

- `frontend` — Next.js + Tailwind CSS
- `backend` — NestJS + JWT auth

## Run locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start both apps:
   ```bash
   npm run dev
   ```

3. Open:
   - Frontend: http://localhost:3000
   - Backend: http://localhost:3001

## Notes

- The backend uses an in-memory user store and JWT authentication.
- The frontend provides a simple login page and protected profile page.
- Four roles are supported:
  - `SuperAdmin` — full access and delete-anything permission.
  - `Moderator` — can delete posts/comments.
  - `RegularUser` — can create posts/comments and manage their own content.
  - `Guest` — can only view/read content.

## Demo accounts

- `admin` / `password` — SuperAdmin
- `moderator` / `password` — Moderator
- `user` / `password` — RegularUser
- `guest` / `guest` — Guest
