# ConnectSocial Improvement Plan

Turning ConnectSocial from a basic posts/comments app into a Facebook-style **internal company social platform** for company-wide communication and monitoring.

## 1. Goals

Build a private, self-hosted social network where employees can:

- Share updates company-wide or inside their department group
- React to, comment on, and attach images to posts
- Follow what their colleagues are doing via rich profiles and notifications
- Have content monitored by Moderators (moderation queue) and tracked by SuperAdmins (activity monitoring)

Everything stays behind login with the existing role model:

| Role        | Responsibilities |
| ----------- | ---------------- |
| SuperAdmin  | Full access, user + department management, monitoring/analytics, moderation |
| Moderator   | Review reports, resolve/dismiss, delete any content |
| RegularUser | Post, comment, react, update own profile |
| Guest       | Read-only browsing |

## 2. Planned Features (grouped by area)

### 2.1 Company communication (Facebook-style)

| Feature | Description |
| ------- | ----------- |
| **Reactions** | `like` / `love` / `wow` on posts and comments, with per-type counts and one-click toggle |
| **Post images** | Attach an image URL to a post, rendered in the feed |
| **Departments & teams** | Departments (Engineering, Marketing, Sales, HR, Finance...); users belong to one; feed can be filtered per department (Facebook-group style) |
| **Notifications** | Bell with unread count; notifications on comments and reactions to your posts; mark read / read-all |
| **Profile pages** | Avatar, full name, job title, email, bio, department; public profile of any user showing their posts/comments/reaction stats |
| **Edit own profile** | Any logged-in user can update their bio/avatar/job title/department |

### 2.2 Monitoring

| Feature | Description |
| ------- | ----------- |
| **Content moderation queue** | Any user can report a post/comment with a reason; Moderators/SuperAdmins see a pending queue and can dismiss the report or resolve it (optionally removing the content) |
| **User activity tracking** | Every meaningful action is logged (login, post, comment, reaction, report, account create/update); admins can browse the timeline and drill into one user's history |
| **Analytics overview** | Total users, active users (24h), posts/comments/reactions, pending reports, per-day trend chart (posts / comments / logins) |
| **Top users leaderboard** | Engagement ranking (posts, comments, reactions) for admins |

### 2.3 Hardening (important before going to production)

- Hash passwords (bcrypt/argon2) instead of plain text
- Add pagination to feeds and comments
- Limit image upload size / validate image URLs
- Rate limiting on login and report endpoints
- Proper role checks on every admin endpoint
- DB migrations instead of `synchronize: true`

## 3. Data model changes

```
User
  + fullName, email, jobTitle, bio, avatarUrl
  + departmentId
  + isActive, loginCount, lastLoginAt, lastSeenAt

Department (new)
  id, name, description, color

Post
  + imageUrl, departmentId

Reaction (new)
  id, type (like|love|wow), postId | commentId, ownerId
  unique (ownerId, postId), unique (ownerId, commentId)

Notification (new)
  id, recipientId, actorId, type (comment|reaction|mention|system), postId, commentId, content, isRead

Report (new)
  id, targetType (post|comment), targetId, reason, reporterId,
  status (pending|resolved|dismissed), resolvedAt, resolvedById

ActivityLog (new)
  id, userId, action (login|post_created|comment_created|reaction_added|report_filed|moderation|account_*), detail, createdAt
```

## 4. API additions

| Method | Endpoint | Access | Purpose |
| ------ | -------- | ------ | ------- |
| POST   | `/posts/:id/react` | Authed | Toggle reaction on a post |
| POST   | `/comments/:id/react` | Authed | Toggle reaction on a comment |
| GET    | `/posts/:id/reactions` | Authed | Reaction summary |
| GET    | `/comments/:id/reactions` | Authed | Reaction summary |
| GET    | `/departments` | Authed | List departments |
| POST   | `/departments` | SuperAdmin | Create department |
| PATCH  | `/departments/:id` | SuperAdmin | Update department |
| DELETE | `/departments/:id` | SuperAdmin | Remove department |
| GET    | `/notifications` | Authed | My notifications |
| GET    | `/notifications/unread-count` | Authed | Unread badge count |
| PATCH  | `/notifications/:id/read` | Authed | Mark one read |
| PATCH  | `/notifications/read-all` | Authed | Mark all read |
| POST   | `/reports` | Authed | Report a post/comment |
| GET    | `/reports?status=pending` | Mod+ | Moderation queue |
| PATCH  | `/reports/:id/resolve` | Mod+ | Resolve (optionally delete target) |
| PATCH  | `/reports/:id/dismiss` | Mod+ | Dismiss report |
| GET    | `/monitoring/overview` | SuperAdmin | KPI cards |
| GET    | `/monitoring/timeline?days=7` | SuperAdmin | Per-day trend |
| GET    | `/monitoring/top-users` | SuperAdmin | Engagement leaderboard |
| GET    | `/monitoring/activity` | SuperAdmin | Recent activity feed |
| GET    | `/monitoring/activity/user/:id` | SuperAdmin | Per-user history |
| GET    | `/users/:id` | Authed | Public profile with stats |
| PATCH  | `/users/me` | Authed | Edit own profile |
| PATCH  | `/users/:id` | SuperAdmin | Update role/department/status |

Feed endpoints gain filters: `GET /posts?departmentId=X`.

## 5. Frontend structure

```
src/pages/
  feed.tsx            # Facebook-style home feed
    - top nav (logo, feed, groups, notifications bell, avatar/logout)
    - left sidebar: departments (groups) + navigation
    - center: composer (text + image URL + department selector) + posts
    - post card: author, reactions bar, comments, report button
    - right sidebar: active users / leaderboard preview
  profile.tsx         # My profile + edit form
  profile/[id].tsx    # Public profile of any user
  notifications.tsx   # Notification list with read states
  moderation.tsx      # Pending report queue (Moderator+)
  monitoring.tsx      # Analytics + activity tracking (SuperAdmin)
  admin.tsx           # Users + departments management (SuperAdmin)
  login.tsx           # Unchanged, plus redirect to /feed
```

Feed shows reactions inline, images, comment counts, and a compose box that mirrors the Facebook "What's on your mind?" pattern.

## 6. Suggested implementation order

1. Backend entities + modules (User/Department/Post/Comment extensions, Reaction, Notification, Report, ActivityLog)
2. Backend services/controllers + wiring in `app.module.ts`
3. Set up database (MariaDB/MySQL), run backend, smoke-test every endpoint
4. Frontend shared layout + top nav + auth helper
5. Feed page (composer, posts, reactions, comments, images, department filter)
6. Profile pages + edit profile
7. Notifications page + unread badge
8. Moderation queue page
9. Monitoring/analytics page
10. Admin page upgrades (users + departments)
11. Seed richer demo data (users, departments, sample posts)
12. Polish UI, run build, deploy preview

## 7. Out of scope for v1 (future roadmap)

- Mentions (`@user`) and hashtags + search
- Real-time updates via WebSockets
- File/image upload (server-side storage) — v1 uses image URLs
- Comment threading / edit comments
- Announcements / pinned posts
- Mobile app
- Email notifications

## 8. Status

- Backend groundwork was partially started in the session (entities, modules, services for departments, reactions, notifications, reports, monitoring).
- Remaining: finish wiring in `app.module.ts`, verify backend against a running MariaDB, then build the frontend pages listed in section 5, then deploy a preview.
