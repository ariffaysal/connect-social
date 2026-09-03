🔧 Implementation Plan
Phase 1 — Security hardening (do first)
Remove demo credentials — strip the "Demo accounts" box from the landing page and the credentials/pre-filled values from the login page (per your choice).
bcrypt password hashing — hash on create/seed/reset; add an automatic upgrade path so existing plaintext accounts are re-hashed at next successful login.
Enforce a real JWT secret — fail-fast at backend startup when JWT_SECRET is missing or still the dev placeholder.
Rate limiting — add @nestjs/throttler on /auth/login (and the report endpoint).
Security headers — Helmet on the Nest app + security headers in next.config.js.
Private reads — make GET /posts, /posts/:id, /posts/:id/comments require authentication (Guest and above still read-only), closing anonymous access.
Upload hardening — verify image magic bytes in addition to MIME; keep 5 MB cap.


Phase 2 — Live "new post → everyone notified" via WebSocket (your main ask)
Backend: extend RealtimeService with sendToAll/sendToUser.
Backend: on post creation, create a system notification for every active user except the author, then push notifications:new to all connected clients.
Frontend: connect the WebSocket for all logged-in users in TopNav; on notifications:new, bump the bell badge instantly (plus toast) and re-fetch the unread count. Keep the 15s polling as fallback.


Phase 3 — Redirections & cleanup
/ → redirect to /feed when already logged in (landing page kept for logged-out visitors, minus credentials).
/login → redirect to /feed when already authenticated.
Return-to-page after login (?next= support).
Fix the leaderboard: expose top-users to all authenticated users (or gate the sidebar UI by role).
Remove/replace the legacy posts.tsx page and its links.


Phase 4 — Branding & final polish
Create a ConnectSocial logo (SVG mark), favicon set, public/ folder, manifest.json, and per-page titles/meta descriptions (_document.tsx + Head).
Small UI polish: loading states, empty states, consistent page titles.


Phase 5 — Security tests
Add a lightweight test setup (jest/supertest) with smoke tests for: login success/failure, role-guard enforcement, rate limiting, plaintext-password upgrade, and the new-post WebSocket notification path.
Re-run both typechecks and builds to confirm everything passes.