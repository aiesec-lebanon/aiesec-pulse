# AIESEC Pulse

A global news platform for AIESEC entities. MCPs publish entity updates, members consume and engage, admins moderate.

---

## Table of Contents

1. [What Is This?](#1-what-is-this)
2. [Repository Layout](#2-repository-layout)
3. [Data Model](#3-data-model)
4. [Authentication](#4-authentication)
5. [Authorization](#5-authorization)
6. [Core Workflows](#6-core-workflows)
7. [Admin Panel](#7-admin-panel)
8. [Media Uploads](#8-media-uploads)
9. [Local Development Setup](#10-local-development-setup)
10. [Database Operations](#11-database-operations)
11. [Deploying to Production](#12-deploying-to-production)
12. [What Is NOT Implemented](#15-what-is-not-implemented)
13. [Testing](#16-testing)
14. [Design System](#17-design-system)

---

## 1. What Is This?

AIESEC Pulse solves fragmented communication across AIESEC's global network. It is a single Next.js web app deployed on Vercel, backed by Supabase Postgres, that implements a content lifecycle:

```
MCP publishes post → auto-published (if ≤2 posts/week) or queued for review
                  → admin approves / rejects
                  → members see it in the global feed
                  → members like and comment
```

**Three user types, two completely separate auth systems:**

| Role | Auth | What they do |
|---|---|---|
| MCP (Member Committee President) | AIESEC OAuth | Publish posts (≤2/week auto-published; overflow queued) |
| Member | AIESEC OAuth | View feed, like, comment |
| Admin | Email + password (bcrypt + JWT) | Moderate content, view audit log |

**Tech stack:**

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router, RSC + Server Actions) |
| Language | TypeScript |
| Database | Supabase Postgres (via Prisma v7 + adapter-pg) |
| Storage | Supabase Storage (via AWS SDK S3-compatible API) |
| UI | Tailwind CSS v4 + shadcn/ui primitives |
| Validation | Zod v4 |
| Admin sessions | `jose` signed JWT in httpOnly cookie |
| Admin passwords | bcryptjs |
| Charts | Recharts |
| HTTP client | axios (AIESEC OAuth + GIS GraphQL calls) |
| Tests | vitest |

---

## 2. Repository Layout

```
aiesec-pulse/                         # no src/ directory — everything at root
│
├── app/                              # Next.js App Router
│   ├── (public)/                     # Route group — AIESEC OAuth required
│   │   ├── feed/page.tsx             # Global feed (RSC, paginated 7 posts/page)
│   │   ├── posts/[id]/page.tsx       # Post detail with comments
│   │   ├── profile/page.tsx          # MCP-only profile & post management
│   │   └── design-preview/page.tsx   # DEV ONLY — design system playground
│   ├── (authed)/                     # Route group — MCP role required
│   │   ├── posts/new/page.tsx        # Post composer
│   │   └── posts/queued/page.tsx     # Shown after a queued submission
│   ├── admin/
│   │   ├── login/                    # Public admin login page
│   │   └── (protected)/              # JWT-gated admin pages
│   │       ├── queue/page.tsx        # Approval queue
│   │       ├── posts/page.tsx        # All posts (search, filter, delete)
│   │       ├── posts/[id]/page.tsx   # Post detail (admin view with actions)
│   │       ├── comments/page.tsx     # Comment moderation
│   │       ├── activity/page.tsx     # MCP activity stats + bar chart
│   │       └── audit/page.tsx        # Unified audit log
│   ├── api/
│   │   ├── auth/callback/route.ts    # OAuth: code → tokens → cookies
│   │   ├── auth/refresh/route.ts     # Refresh expired access token
│   │   ├── auth/logout/route.ts      # Clear AIESEC session cookies
│   │   ├── auth/me/route.ts          # Current user info (JSON)
│   │   ├── auth/active-role/route.ts # Current role (JSON)
│   │   └── storage/sign/route.ts     # Issue signed S3 upload URL
│   ├── actions/                      # All mutations (Server Actions)
│   │   ├── posts.ts                  # createPost, approvePost, rejectPost, resubmitPost, deletePost
│   │   ├── comments.ts               # addComment, loadMoreComments, deleteComment
│   │   ├── likes.ts                  # toggleLike
│   │   └── admin.ts                  # adminLogin, adminLogout
│   ├── context/auth-context.tsx      # Client-side auth context provider
│   ├── generated/prisma/             # Prisma-generated client (DO NOT EDIT)
│   ├── globals.css                   # All design tokens + Tailwind v4 @theme
│   ├── layout.tsx                    # Root layout (ThemeProvider)
│   ├── login/page.tsx                # AIESEC OAuth entry point ("Login with AIESEC")
│   └── page.tsx                      # Root: redirects to /feed if authed
│
├── components/
│   ├── PostComposer.tsx              # Client-side post creation form (eager image upload)
│   ├── feed/
│   │   ├── HeroPost.tsx              # Large hero card (first post in feed)
│   │   ├── SidebarPostItem.tsx       # Compact sidebar card (posts 2–4)
│   │   ├── SecondaryPostCard.tsx     # 3-column secondary row (posts 5–7)
│   │   ├── TrendingAuthorCard.tsx    # Trending MCPs carousel (page 1 only)
│   │   └── FeedEmptyState.tsx        # Empty feed illustration
│   ├── post-detail/
│   │   ├── EngagementBar.tsx         # Like button + comment count (sticky on mobile)
│   │   └── CommentsSection.tsx       # Comment list + composer + "load more"
│   ├── engagement/
│   │   ├── LikeButton.tsx            # Optimistic like toggle
│   │   ├── CommentList.tsx           # Paginated comment list
│   │   └── CommentComposer.tsx       # Comment input form
│   ├── posts/                        # Shared post card variants + _shared.tsx (PostAvatar)
│   ├── profile/
│   │   └── RejectedPostPanel.tsx     # Edit + resubmit inline form for rejected posts
│   ├── admin/
│   │   ├── AdminShell.tsx            # Admin sidebar navigation shell
│   │   ├── QueueCard.tsx             # Approve / reject card in the queue
│   │   ├── RejectModal.tsx           # Rejection reason modal (min 5 chars)
│   │   ├── ActivityChart.tsx         # Recharts bar chart (8-week post volume)
│   │   ├── ActivityTable.tsx         # Sortable MCP activity table
│   │   ├── ActivitySearch.tsx        # Search bar for activity page
│   │   ├── AuditTable.tsx            # Audit log table rows
│   │   ├── AuditFilters.tsx          # Filter chips for audit log
│   │   ├── AuditAdminSelect.tsx      # Admin selector for audit filters
│   │   ├── PostsTable.tsx            # All-posts table with delete action
│   │   ├── PostsSearch.tsx           # Search bar for posts page
│   │   ├── CommentsTable.tsx         # Comments table with soft-delete action
│   │   ├── CommentsFilterRow.tsx     # Post-filter input for comments page
│   │   ├── DeletePostModal.tsx       # Confirm delete modal for posts
│   │   ├── DeleteCommentModal.tsx    # Confirm delete modal for comments
│   │   └── PageSizeSelect.tsx        # Page size selector (10/25/50/100)
│   ├── shell/
│   │   ├── AppShell.tsx              # App-wide layout wrapper
│   │   └── ShellInteractive.tsx      # Client-side nav (user menu, theme toggle, "New post" CTA)
│   ├── providers.tsx                 # ThemeProvider wrapper (next-themes)
│   ├── theme-context.tsx             # Custom dark/light theme context
│   └── ThemeToggle.tsx               # Dark/light mode toggle button
│
├── lib/
│   ├── db.ts                         # Prisma client singleton (PrismaPg adapter)
│   ├── audit.ts                      # withAudit() for admin actions; logUserAction() for user actions
│   ├── week.ts                       # currentIsoWeek(), lastNIsoWeeks(), isoWeekShortLabel()
│   ├── storage.ts                    # Supabase Storage signed upload URL via AWS SDK
│   ├── relative-time.ts              # "2 hours ago" human-readable formatter
│   ├── time.ts                       # Date utilities
│   ├── utils.ts                      # cn() Tailwind class merger
│   ├── zod-schemas.ts               # Shared schemas: createPost, createComment, adminLogin, rejectPost
│   └── auth/
│       ├── admin-session.ts          # Admin JWT sign/verify/get/set/clear (Server Action style)
│       ├── session.ts                # Admin JWT helpers (Route Handler style — older variant)
│       ├── current-user.ts           # getOrSyncUser(): live GIS call → DB upsert → User
│       ├── guards.ts                 # requireUser() / requireMCP() / requireAdmin()
│       └── rate-limit.ts            # In-memory rate limiters (admin login + post creation)
│
├── server-utils/
│   ├── user-fetcher.ts               # GIS GraphQL currentPerson query (axios)
│   └── user-validation.ts            # Validates GIS response; checks office/role allowlists
│
├── types/
│   ├── auth-types.ts                 # TokenResponse shape from AIESEC OAuth token endpoint
│   ├── user-types.ts                 # UserInfo / Position / Office / Role from GIS
│   ├── comment.ts                    # CommentDto + toCommentDto mapper
│   └── feed.ts                       # Feed post type aliases
│
├── __tests__/
│   └── week.test.ts                  # vitest: ISO week computation
│
├── prisma/
│   ├── schema.prisma                 # Canonical data model (source of truth)
│   ├── seed.ts                       # Upsert admin from ADMIN_EMAIL / ADMIN_PASSWORD
│   └── migrations/                   # Applied migration files
│
├── proxy.ts                          # Next.js middleware (session check + admin JWT guard)
├── prisma.config.ts                  # Prisma CLI config (uses DIRECT_URL for migrations)
├── next.config.ts                    # Next.js config (image remote patterns)
├── postcss.config.mjs                # PostCSS for Tailwind v4
├── vitest.config.ts                  # Test config
└── .env                              # Local env (not committed)
```

---

## 3. Data Model

The Prisma schema lives at [prisma/schema.prisma](prisma/schema.prisma). The generated TypeScript client is at `app/generated/prisma/` (non-standard output path — see [§13](#13-key-implementation-decisions)).

### Models

**User** — created on first AIESEC login via upsert.

| Field | Type | Notes |
|---|---|---|
| `id` | cuid | Internal DB ID |
| `aiesecUserId` | String (unique) | GIS `currentPerson.id` — stable AIESEC identifier |
| `fullName` | String | From GIS |
| `role` | `MCP \| MEMBER` | Derived from GIS positions on every login |
| `committeeId / committeeName` | String? | From first position's office |

**Post** — content created by MCPs.

| Field | Type | Notes |
|---|---|---|
| `status` | `PUBLISHED \| PENDING \| REJECTED` | Default PUBLISHED |
| `weekIso` | String | e.g. `"2026-W21"` — ISO calendar week (Monday UTC → Sunday UTC) |
| `rejectionReason` | String? | Set on rejection; cleared on resubmit |
| `mediaUrl` | String? | Supabase Storage public URL |
| `linkUrl` | String? | Optional external link |

**Comment** — soft-deleted via `deletedAt` (content preserved, only admin can delete).

**Like** — composite PK `(postId, userId)`, enforces one like per user per post.

**Admin** — separate from AIESEC users. Email + bcrypt hash.

**AdminAction** — append-only log for every admin mutation. Fields: `adminId`, `action`, `targetType`, `targetId`, `metadata` (JSON).

**UserAction** — append-only log for user mutations (create post, add comment). Same shape as AdminAction. Both tables are merged in the admin audit view.

**OauthToken** — Prisma model exists; table is migration-applied; **no code writes to it** (tokens currently stored in cookies only — post-MVP).

### Key Indexes

| Index | Serves |
|---|---|
| `Post(status, createdAt DESC)` | Feed query |
| `Post(authorId, weekIso)` | Weekly post count check (used in createPost transaction) |
| `Comment(postId, createdAt)` | Comments under a post |
| `Like(postId)` | Like count per post |
| `AdminAction(createdAt DESC)` | Audit log |
| `UserAction(userId, createdAt DESC)` | Per-user activity |

---

## 4. Authentication

Two completely separate auth systems. They do not share cookies, sessions, or logic.

### 4.1 AIESEC OAuth (Members & MCPs)

OAuth 2.0 Authorization Code flow against `auth.aiesec.org`. No OIDC, no standard `userinfo` endpoint — role is derived via a separate GIS GraphQL call.

**Login flow:**

1. User visits `/login` → clicks "Login with AIESEC"
2. Browser redirects to `${NEXT_PUBLIC_AUTH_URL}/authorize?response_type=code&client_id=…&redirect_uri=…`
3. AIESEC auth server redirects to `/api/auth/callback?code=XYZ`
4. Callback ([app/api/auth/callback/route.ts](app/api/auth/callback/route.ts)):
   - POSTs `{code, client_id, client_secret, redirect_uri, grant_type}` to `${NEXT_PUBLIC_AUTH_URL}/token`
   - Calls `validateUser(accessToken)` which queries GIS `currentPerson` to confirm the user has at least one current position
   - If `!isValid` → redirect to `/unauthorized`
   - Sets four `httpOnly` cookies and redirects to `/`:
     - `aiesec_token` — OAuth access token (expires with token)
     - `refresh_token` — OAuth refresh token (no explicit expiry — session cookie)
     - `token_expires_at` — Unix timestamp string (seconds)
     - `user` — JSON-serialized GIS `currentPerson` (display only, NOT trusted for access control)

**Token refresh:**

Middleware detects `Date.now() > Number(token_expires_at) * 1000` → redirects to `/api/auth/refresh?redirect=<original-path>`. The refresh route POSTs to `${NEXT_PUBLIC_REDIRECT_SERVICE_URL}/token` and writes new cookies before redirecting back.

**Role derivation on every server render:**

The `user` cookie is NOT trusted for access control decisions. On every server-side render, `getOrSyncUser()` ([lib/auth/current-user.ts](lib/auth/current-user.ts)):
1. Reads the `aiesec_token` cookie
2. Calls GIS `currentPerson` GraphQL with that token
3. Derives `MCP | MEMBER`: any position with `role.name === "MCP"` → MCP, else → MEMBER
4. Upserts the `User` row in Postgres (keeping role, name, committee in sync)
5. Returns the hydrated `User` object

Wrapped in React `cache()` — executes at most once per render tree per request.

**Logout:** `GET /api/auth/logout` clears all four AIESEC cookies → redirects to `/login`.

**Access restriction (`validateUser`):**

[server-utils/user-validation.ts](server-utils/user-validation.ts) has two empty allowlists:
- `ALLOWED_AIESEC_OFFICE_IDS: []` — empty = any office allowed
- `ALLOWED_ROLES: []` — empty = any role allowed

Populate these to restrict access to specific AIESEC offices or roles.

### 4.2 Admin Authentication

Completely separate from OAuth. Admins have no AIESEC account.

**Login flow** (Server Action `adminLogin`):
1. Admin visits `/admin/login`
2. Rate-limited: 5 attempts / 15 minutes per IP
3. `adminLoginSchema` validates (email + password ≥ 8 chars)
4. Looks up `Admin` by email, `bcrypt.compare()` the password
5. Signs a `jose` JWT `{ sub: adminId, kind: "admin" }` with HS256, 24h expiry
6. Sets `admin_session` cookie: httpOnly, Secure (production), SameSite=Lax
7. Redirects to `/admin/queue`

**Session verification:** Middleware verifies `admin_session` JWT on every `/admin/*` request (except `/admin/login`). If invalid or missing → redirect to `/admin/login`.

**Admin seeding:**

```bash
npm run seed
```

Upserts an `Admin` row from `ADMIN_EMAIL` + `ADMIN_PASSWORD` env vars. Uses `bcrypt` cost factor 10. Safe to re-run — `update: {}` means existing rows are not overwritten. To change credentials: delete the old row manually, update env vars, re-seed.

---

## 5. Authorization

Centralized in [lib/auth/guards.ts](lib/auth/guards.ts). Every Server Action and protected Route Handler calls exactly one guard as its first line:

```ts
requireUser()    // any authenticated AIESEC user → redirects to /login if not
requireMCP()     // MCP role only → redirects to /unauthorized if not MCP
requireAdmin()   // valid admin_session JWT → redirects to /admin/login if not
```

The middleware ([proxy.ts](proxy.ts)) provides route-level protection before the request reaches any page. Admin routes get a JWT check in the middleware. Guards in Server Actions provide a second layer of verification.

---

## 6. Core Workflows

### 6.1 Post Creation with Weekly Limit

Source: [app/actions/posts.ts](app/actions/posts.ts) → `createPost()`

```
requireMCP()
checkPostRateLimit(userId)          → 5 attempts/minute, in-memory
zod validation                      → title 3–200 chars, content 10–10,000 chars
DB transaction (Serializable):
  COUNT posts WHERE authorId=user AND weekIso=thisWeek
    AND status IN [PUBLISHED, PENDING]
  count < 2  → status = PUBLISHED
  count >= 2 → status = PENDING
  INSERT post
logUserAction("create_post", ...)
revalidatePath("/feed")
```

The `Serializable` isolation level prevents two simultaneous submissions from both seeing `count=1` and both getting `PUBLISHED`. The weekly count is **computed on write, never stored** — no cron job, no drift.

After submission:
- `PUBLISHED` → router.push(`/posts/${postId}`)
- `PENDING` → router.push(`/posts/queued`)

### 6.2 Post Resubmission (Rejected Posts)

MCPs can edit and resubmit rejected posts from their profile page (`/profile`). `resubmitPost()` runs the same weekly count check, updates the post in place, clears `rejectionReason`, and redirects back through the normal publish/queue logic.

### 6.3 Image Upload

Source: [lib/storage.ts](lib/storage.ts), [app/api/storage/sign/route.ts](app/api/storage/sign/route.ts)

Images upload **before** form submission to avoid Next.js body size limits (4.5MB cap):

```
1. User selects/drops file in PostComposer
2. Client validates: JPEG/PNG/WEBP only, ≤5 MB
3. POST /api/storage/sign { filename, contentType, size }
   → requireMCP() check server-side
   → AWS SDK PutObjectCommand → Supabase Storage signed URL (expires 300s)
   → returns { uploadUrl, publicUrl }
4. Client PUT's file directly to uploadUrl (bypasses Next.js/Vercel)
5. publicUrl stored in state; submitted with createPost() call as mediaUrl
```

Bucket: `post-media`. Must be created in Supabase with public read access.

### 6.4 Like Toggle

Source: [app/actions/likes.ts](app/actions/likes.ts)

```
requireUser()
DB transaction:
  if like exists → DELETE
  else → CREATE
  COUNT likes for post
return { liked, count }
```

`LikeButton` applies optimistic UI — updates immediately, reconciles with server response.

### 6.5 Comments

Source: [app/actions/comments.ts](app/actions/comments.ts)

- `addComment(postId, content)` — requireUser; rate-limited 10/minute per user (in-module bucket); Zod (1–2,000 chars); logs `UserAction`
- `loadMoreComments(postId, cursorCreatedAt)` — cursor pagination (20 at a time, `createdAt < cursor`). Requires requireUser.
- `deleteComment(commentId)` — requireAdmin; soft-delete (`deletedAt = now()`); wrapped in `withAudit()`

Initial 20 comments are server-rendered on the post detail page; older ones fetched client-side on "Load more".

### 6.6 Admin Audit Logging

Every admin mutation uses `withAudit()` ([lib/audit.ts](lib/audit.ts)):

```ts
async function withAudit(admin, action, targetType, targetId, metadata, fn) {
  const result = await fn();   // mutation runs first
  await db.adminAction.create({ data: { adminId: admin.sub, action, ... } });
  return result;
}
```

All four admin actions (`approvePost`, `rejectPost`, `deletePost`, `deleteComment`) are wrapped with this. It is structurally impossible to run a mutation without logging it.

User actions (post creation, comments) are logged separately via `logUserAction()` into the `UserAction` table.

---

## 7. Admin Panel

All pages under `/admin/(protected)/` require a valid `admin_session` JWT.

| Route | What it does |
|---|---|
| `/admin/login` | Email + password login with rate limiting |
| `/admin/queue` | Pending posts. Approve or reject with required reason (5–500 chars). Oldest first. |
| `/admin/posts` | All posts. Search by title/author. Filter by status. Paginated (10/25/50/100). Delete any post. |
| `/admin/posts/[id]` | Post detail with approve/reject/delete actions. |
| `/admin/comments` | All comments. Filter by post ID or URL. Filter by active/removed status. Soft-delete. |
| `/admin/activity` | Per-MCP posting stats: total, this week, this month, pending, last post. Global bar chart (8 ISO weeks). Sortable by all columns. Search by name/entity. Paginated. |
| `/admin/audit` | Unified log merging `AdminAction` + `UserAction` tables. Filter by action type (approvals/rejections/deletions/creations), actor role (admin/mcp/member), date range, actor name. Paginated. |

---

## 8. Media Uploads

Uses **Supabase Storage** via its S3-compatible API (AWS SDK v3, NOT the Supabase JS SDK). Required env vars differ from standard Supabase SDK setup — see [§9](#9-environment-variables).

The public URL format is derived from your Supabase project ref:
`https://<ref>.supabase.co/storage/v1/object/public/post-media/<uuid-filename>`

**Bucket setup in Supabase:**
1. Go to Storage → New bucket
2. Name: `post-media`
3. Enable **Public bucket** (public read)
4. Save

**S3 credentials:** Go to Storage → S3 Access Keys to generate `SUPABASE_S3_ACCESS_KEY_ID` and `SUPABASE_S3_SECRET_ACCESS_KEY`.

The `SUPABASE_URL` for storage must be your project's S3 endpoint:
`https://<ref>.supabase.co/storage/v1/s3`

---

## 9. Local Development Setup

**Prerequisites:** Node.js 20+, a Supabase project (free tier is fine).

```bash
# 1. Install dependencies
npm install

# 2. Fill in environment variables
cp .env.example .env   # or create .env manually
# edit .env with your values

# 3. Apply database migrations
npx prisma migrate deploy

# 4. Generate the Prisma client
npx prisma generate

# 5. Seed the admin account
npm run seed

# 6. Start dev server
npm run dev
```

App runs at `http://localhost:3000`.

### Without AIESEC OAuth Credentials

AIESEC OAuth credentials can take days to be issued. In the meantime:
- Admin flows work immediately: seed → visit `/admin/login`
- For user flows, you can manually set the AIESEC cookies in browser DevTools with mock values (any non-expired `aiesec_token`, a future `token_expires_at` epoch), then create a test GIS call-matching `User` row directly in the DB

### Useful Commands

```bash
npm run dev                                   # dev server with HMR
npm run build                                 # prisma generate + next build
npm run seed                                  # upsert admin from env vars
npm run test                                  # vitest unit tests
npm run lint                                  # eslint
npm run format                                # prettier

npx prisma generate                           # regenerate client after schema change
npx prisma migrate dev --name <description>   # create + apply migration (dev)
npx prisma migrate deploy                     # apply pending migrations (production/CI)
npx prisma studio                             # GUI for the database
```

---

## 10. Database Operations

### Schema Changes

1. Edit [prisma/schema.prisma](prisma/schema.prisma)
2. `npx prisma migrate dev --name <description>` — creates migration file + regenerates client
3. Update `CLIENT_ID` in [lib/db.ts](lib/db.ts) if the schema change adds new models (forces singleton recreation in dev hot-reload)

### Two Database URLs Explained

Prisma v7 + PgBouncer (transaction pooling mode) requires two separate URLs:

| Variable | URL type | Used by |
|---|---|---|
| `DATABASE_URL` | PgBouncer pooled (`port 6543`) | `PrismaClient` at runtime |
| `DIRECT_URL` | Non-pooled direct (`port 5432`) | Prisma CLI (`migrate`, `db push`) |

PgBouncer in transaction mode doesn't support PostgreSQL prepared statements. The `@prisma/adapter-pg` driver adapter works around this. Configured in [prisma.config.ts](prisma.config.ts).

### Seeding Notes

- Idempotent: `upsert` with `update: {}` — re-running never overwrites an existing admin's hash
- To change admin email: delete the old row in the `admins` table, update env vars, re-run `npm run seed`
- To change admin password: update `ADMIN_PASSWORD`, re-run `npm run seed` (creates new hash). The existing row gets replaced because the `where: { email }` lookup finds it and `update: {}` is a no-op — wait, actually `update: {}` means the record is NOT updated. You'd need to either delete the row first, or add the passwordHash to the `update` clause.

---

## 11. Deploying to Production

### Vercel

```bash
# Link repo (first time)
npx vercel link

# Deployments happen automatically on git push
git push origin main
```

Set all env vars in the Vercel project dashboard (Settings → Environment Variables). Use separate values for preview vs. production environments (different Supabase projects, different OAuth redirect URIs).

### Production Checklist

- [ ] Supabase production project created; passwords rotated; connection strings copied.
- [ ] `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) set in Vercel.
- [ ] `npx prisma migrate deploy` run against production database.
- [ ] `npm run seed` run with production env vars to create the admin account.
- [ ] Supabase Storage bucket `post-media` created with public read.
- [ ] S3 access keys generated and set as `SUPABASE_S3_*` env vars.
- [ ] AIESEC OAuth client registered with production redirect URI.
- [ ] `NEXT_PUBLIC_BASE_URL` and `NEXT_PUBLIC_REDIRECT_URI` set to production URL.
- [ ] `NEXT_PUBLIC_REDIRECT_SERVICE_URL` set (should match `NEXT_PUBLIC_AUTH_URL`).
- [ ] `ADMIN_SESSION_SECRET` is ≥32 chars and kept secret.
- [ ] Smoke test: login → create post → admin approve → like → comment → admin audit log.

---

## 12. What Is NOT Implemented

Intentionally deferred (per `context.md`):

- Video uploads (images only)
- Nested / threaded comments
- Email or push notifications
- Editing posts after publication (only rejected posts can be resubmitted)
- Reactions beyond a single like
- Full-text search, filtering, tags, categories
- Rich-text / markdown editor (plain `<textarea>`)
- Multi-language UI
- Member-created posts (members are consumers only)
- OAuth state parameter (CSRF protection on the OAuth callback) — **post-MVP security hardening**
- Signed JWT user sessions (role currently re-derived from GIS live) — **post-MVP security hardening**
- Token persistence in Postgres (`OauthToken` table) — **post-MVP**
- Server-side token refresh proxy guard — **post-MVP**

---

## 13. Testing

```bash
npm run test
```

Vitest runs all `*.test.ts` files.

Current coverage:
- [__tests__/week.test.ts](__tests__/week.test.ts) — `currentIsoWeek()`, `lastNIsoWeeks()`, `isoWeekShortLabel()` edge cases
- [lib/auth/admin-session.test.ts](lib/auth/admin-session.test.ts) — admin JWT sign/verify round-trip

There are no integration tests or E2E tests. For manual testing, use the smoke test flow in the production checklist above.

---

## 14. Design System

Fully documented in [AIESEC-Design-System-Guidelines.md](AIESEC-Design-System-Guidelines.md). All design decisions must conform to it.

**Quick reference for developers:**

- **Colors:** use CSS custom properties only — `var(--primary)`, `var(--card)`, `var(--muted-foreground)`, etc. Never raw hex values.
- **Dark mode:** toggled by the `.dark` class on `<html>`. The `--background`, `--card`, `--border` etc. tokens redefine automatically.
- **Font:** `Lato` (loaded globally), Arial fallback.
- **Border radius:** `var(--radius-sm)` 4px / `var(--radius-md)` 8px / `var(--radius-lg)` 12px.
- **Key colors:** Primary blue `#037ef3` · Warning/destructive orange `#f48924` · Success/positive teal `#0cb9c1`.
- **Charts:** Recharts using `--chart-1` through `--chart-5` tokens.
- **Reusable classes:** `aiesec-card`, `aiesec-btn-primary`, `aiesec-btn-secondary` are defined in [app/globals.css](app/globals.css).
- **Design preview:** visit `/design-preview` while logged in to see all components rendered.

---

*Built as the MCVP Lebanon application task — AIESEC Pulse MVP.*
