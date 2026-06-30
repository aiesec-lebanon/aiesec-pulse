# AIESEC Pulse

A global news platform built for AIESEC's network of ~120 Member Committee Presidents and thousands of members worldwide. MCPs publish entity updates, members consume and engage with them, and admins moderate content — all in one place.

---

## Why This Exists

AIESEC has no centralized channel for entity-level communication. Updates get buried in WhatsApp groups, Slack channels, and regional Drive folders. Important announcements don't propagate consistently, and members in one entity have no reliable way to see what the rest of the global network is doing.

AIESEC Pulse solves this with a single, publicly accessible web platform:

```
MCP publishes update
  → auto-published (≤2 posts/week) or queued for admin review
  → members see it in the global feed
  → members like and comment
  → admins moderate via a dedicated panel
```

---

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router, RSC + Server Actions) |
| Language | TypeScript |
| Database | Supabase Postgres via Prisma v7 + adapter-pg |
| Storage | Supabase Storage (S3-compatible API) |
| UI | Tailwind CSS v4 + shadcn/ui primitives |
| Validation | Zod v4 |
| Admin sessions | `jose` signed JWT in httpOnly cookie |
| Password hashing | bcryptjs |
| Charts | Recharts |
| HTTP client | axios (AIESEC OAuth + GIS GraphQL) |
| Tests | Vitest |
| Hosting | Vercel |

---

## User Roles

| Role | Auth | What they can do |
|---|---|---|
| MCP | AIESEC OAuth | Publish posts (first 2/week auto-published; overflow queued) |
| Member | AIESEC OAuth | View feed, like, comment |
| Admin | Email + password | Moderate content, approve/reject posts, view audit log |

Admins and AIESEC users are **completely separate authentication systems** — they share no cookies, sessions, or logic.

---

## Project Structure

```
aiesec-pulse/
├── app/                          # Next.js App Router
│   ├── (public)/                 # AIESEC OAuth required
│   │   ├── feed/                 # Global feed (server-rendered, paginated)
│   │   ├── posts/[id]/           # Post detail with comments
│   │   └── profile/              # MCP profile & post management
│   ├── (authed)/                 # MCP role required
│   │   └── posts/new/            # Post composer
│   ├── admin/
│   │   ├── login/                # Admin login
│   │   └── (protected)/          # JWT-gated admin pages
│   │       ├── queue/            # Approval queue
│   │       ├── posts/            # All posts (search, filter, delete)
│   │       ├── comments/         # Comment moderation
│   │       ├── activity/         # MCP activity stats + chart
│   │       └── audit/            # Unified audit log
│   ├── api/
│   │   ├── auth/                 # OAuth callback, refresh, logout, me
│   │   └── storage/sign/         # Signed upload URL for images
│   └── actions/                  # All mutations (Server Actions)
│       ├── posts.ts
│       ├── comments.ts
│       ├── likes.ts
│       └── admin.ts
│
├── components/
│   ├── feed/                     # HeroPost, SidebarPostItem, SecondaryPostCard
│   ├── post-detail/              # EngagementBar, CommentsSection
│   ├── admin/                    # QueueCard, ActivityChart, AuditTable, etc.
│   ├── shell/                    # AppShell, ShellInteractive (nav + theme toggle)
│   └── PostComposer.tsx
│
├── lib/
│   ├── auth/                     # Guards, admin session, current-user
│   ├── db.ts                     # Prisma client singleton
│   ├── audit.ts                  # withAudit() wrapper for admin mutations
│   ├── storage.ts                # Supabase Storage signed URL helper
│   ├── week.ts                   # ISO week computation
│   └── zod-schemas.ts            # Shared validation schemas
│
├── server-utils/
│   ├── user-fetcher.ts           # GIS GraphQL query
│   └── user-validation.ts        # Validates GIS response + allowlists
│
├── prisma/
│   ├── schema.prisma             # Canonical data model
│   ├── seed.ts                   # Admin account bootstrap
│   └── migrations/
│
├── types/                        # Auth, user, comment, feed types
├── __tests__/                    # Vitest tests
└── proxy.ts                      # Middleware (session check + admin JWT guard)
```

---

## Local Development Setup

**Prerequisites:** Node.js 20+, a Supabase project (free tier works fine).

### 1. Clone and install

```bash
git clone https://github.com/your-org/aiesec-pulse.git
cd aiesec-pulse
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root with the following variables:

```env
# Database (Supabase Postgres)
DATABASE_URL=postgresql://...pooler.supabase.com:6543/postgres
DIRECT_URL=postgresql://...supabase.co:5432/postgres

# Supabase Storage (S3-compatible)
SUPABASE_URL=https://<ref>.supabase.co/storage/v1/s3
SUPABASE_S3_ACCESS_KEY_ID=<from Supabase Storage → S3 Access Keys>
SUPABASE_S3_SECRET_ACCESS_KEY=<from Supabase Storage → S3 Access Keys>
SUPABASE_S3_REGION=<your Supabase region>

# AIESEC OAuth (issued by AIESEC dev team)
NEXT_PUBLIC_AUTH_URL=https://auth.aiesec.org/oauth
NEXT_PUBLIC_CLIENT_ID=<your OAuth client ID>
CLIENT_SECRET=<your OAuth client secret>
NEXT_PUBLIC_REDIRECT_URI=http://localhost:3000/api/auth/callback
NEXT_PUBLIC_REDIRECT_SERVICE_URL=https://auth.aiesec.org/oauth
NEXT_PUBLIC_AIESEC_GRAPHQL_API=https://gis-api.aiesec.org/graphql

# App
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Admin session JWT (generate with: openssl rand -base64 32)
ADMIN_SESSION_SECRET=<32+ random characters>

# Admin seeding
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=<choose a strong password>
```

> **Note on `DATABASE_URL` vs `DIRECT_URL`:** Supabase uses PgBouncer (transaction pooling mode) on port 6543 for `DATABASE_URL` (runtime queries). Prisma CLI migrations require a direct, non-pooled connection on port 5432 via `DIRECT_URL`. Both are needed.

### 3. Apply migrations and seed

```bash
npx prisma migrate deploy    # apply database migrations
npx prisma generate          # generate the Prisma client
npm run seed                 # create the admin account from ADMIN_EMAIL + ADMIN_PASSWORD
```

### 4. Set up Supabase Storage

In your Supabase project dashboard:
1. Go to **Storage → New bucket**
2. Name: `post-media`
3. Enable **Public bucket**
4. Save

Then go to **Storage → S3 Access Keys** to generate the credentials for your `.env`.

### 5. Start the dev server

```bash
npm run dev
```

App is available at `http://localhost:3000`.
Admin panel is at `http://localhost:3000/admin/login`.

### Without AIESEC OAuth credentials

OAuth credentials take a few days to be issued by the AIESEC dev team. In the meantime:

- Admin flows work immediately — seed the DB then visit `/admin/login`
- For user/MCP flows, you can manually set the AIESEC session cookies in browser DevTools with mock token values, or request test credentials from AIESEC IM

---

## Available Scripts

```bash
npm run dev       # Start dev server with HMR at localhost:3000
npm run build     # prisma generate + next build
npm run start     # Start production server
npm run seed      # Upsert admin from ADMIN_EMAIL + ADMIN_PASSWORD env vars
npm run test      # Run Vitest unit tests
npm run lint      # ESLint
npm run format    # Prettier

npx prisma generate                           # Regenerate client after schema changes
npx prisma migrate dev --name <description>   # Create + apply a new migration (dev)
npx prisma migrate deploy                     # Apply pending migrations (production/CI)
npx prisma studio                             # Visual DB browser
```

---

## Deployment (Vercel)

```bash
npx vercel link   # Link repo to Vercel project (first time only)
git push origin main   # Triggers automatic deploy
```

Set all env vars in the Vercel project dashboard under **Settings → Environment Variables**. Use separate Supabase projects and OAuth redirect URIs for preview vs. production environments.

**Production checklist:**
- [ ] Supabase production project created; database password rotated
- [ ] `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) set in Vercel
- [ ] `npx prisma migrate deploy` run against production database
- [ ] `npm run seed` run with production env vars
- [ ] `post-media` bucket created with public read in Supabase Storage
- [ ] S3 access keys generated and set as `SUPABASE_S3_*` env vars
- [ ] AIESEC OAuth client registered with the production redirect URI
- [ ] `ADMIN_SESSION_SECRET` is ≥32 chars and stored securely
- [ ] Smoke test: login → create post → admin approve → like → comment → audit log

---

## Contributing

Contributions are welcome. The project follows a few non-negotiable conventions:

### Code conventions

- **Framework:** Next.js App Router with React Server Components and Server Actions. Do not introduce client-side data fetching libraries (TanStack Query, SWR) — the architecture is server-first by design.
- **Database:** Prisma schema in `prisma/schema.prisma` is the single source of truth. Do not bypass the ORM with raw SQL unless migrating schema.
- **Authorization:** every Server Action and protected Route Handler must call exactly one guard from `lib/auth/guards.ts` as its first line — `requireUser()`, `requireMCP()`, or `requireAdmin()`.
- **Audit logging:** every admin mutation must go through `withAudit()` from `lib/audit.ts`. Never write to the DB directly from admin actions.
- **Validation:** all user input goes through a Zod schema before touching the DB. Add schemas to `lib/zod-schemas.ts`.
- **Styling:** use the design tokens defined in `app/globals.css` only — no raw hex values, no ad-hoc spacing. See `AIESEC-Design-System-Guidelines.md` for the full reference.

### Dev workflow

1. Fork the repository and create a feature branch
2. Make your changes — run `npm run lint` and `npm run test` before pushing
3. Open a pull request against `main` with a description of what changed and why

### What's intentionally out of scope

The following are deferred post-MVP items. Do not implement them without explicit alignment:

- Video uploads (images only for now)
- Nested/threaded comments
- Email or push notifications
- Editing published posts or comments
- Reactions beyond a single like
- Full-text search, tags, categories
- Rich-text / markdown editor
- Multi-language UI
- Member-created posts (members are consumers only)

---

## Data Model (overview)

The full Prisma schema is in [`prisma/schema.prisma`](prisma/schema.prisma).

| Model | Purpose |
|---|---|
| `User` | Created on first AIESEC login via upsert. Role (`MCP` or `MEMBER`) derived from GIS on every login. |
| `Post` | Content created by MCPs. Status: `PUBLISHED`, `PENDING`, or `REJECTED`. |
| `Comment` | Soft-deleted via `deletedAt` — only admins can remove. |
| `Like` | Composite PK `(postId, userId)` enforces one like per user per post. |
| `Admin` | Separate from AIESEC users. Email + bcrypt password hash. |
| `AdminAction` | Append-only audit log for every admin mutation. |
| `UserAction` | Append-only log for user-initiated mutations (post creation, comments). |

---

## Security Notes

- All cookies are `httpOnly`, `Secure` (production), `SameSite=Lax`
- Admin sessions use signed JWTs via `jose` — stored in an httpOnly cookie, verified on every `/admin/*` request via middleware
- All Server Action inputs are validated with Zod before any DB interaction
- Post content and comments are rendered via React's default escaping — no `dangerouslySetInnerHTML`
- Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `CLIENT_SECRET`, `ADMIN_SESSION_SECRET`) are never included in the client bundle
- Prisma parameterizes all queries — no raw SQL string interpolation
- Rate limiting is applied on post creation (5 attempts/minute per user) and admin login (5 attempts/15 minutes per IP)

---

## License

This project is open-source under the [MIT License](LICENSE).

---

*Built as the MCVP Lebanon application task — AIESEC Pulse MVP.*
