# AIESEC Pulse

A news and announcements platform for the AIESEC network. Entity leaders publish updates, members read and engage with them, and moderators handle approvals and reports — scoped to the real AIESEC office tree rather than one flat global feed.

---

## Why This Exists

AIESEC has no centralized channel for entity-level communication. Updates get buried in WhatsApp groups, Slack channels, and regional Drive folders. Important announcements don't propagate consistently, and members in one entity have no reliable way to see what the rest of the network is doing.

Pulse is a single web platform for that traffic:

```
publisher writes an update
  → published immediately, or queued for review if they are over quota
  → members in the audience see it in the feed
  → members react, comment, bookmark
  → moderators approve, hide, or handle reports — within their own scope
```

---

## Tech Stack

| Concern               | Choice                                                             |
| --------------------- | ------------------------------------------------------------------ |
| Framework             | Next.js 16 (App Router, RSC + Server Actions)                      |
| Language              | TypeScript                                                         |
| Database              | Postgres via Prisma 7 + `@prisma/adapter-pg`                       |
| Storage               | S3-compatible object storage (Supabase Storage)                    |
| Cache / rate limiting | Upstash Redis                                                      |
| Background jobs       | Inngest                                                            |
| UI                    | Tailwind CSS v4                                                    |
| Validation            | Zod                                                                |
| Sessions              | `jose`-signed JWT in an httpOnly cookie, backed by a `Session` row |
| Observability         | OpenTelemetry + Sentry                                             |
| Unit tests            | Vitest                                                             |
| E2E / accessibility   | Playwright + axe-core                                              |

---

## Authorization Model

Authorization is **data, not code**. Roles, permissions, scopes, and quotas live in the database and are administered at runtime — adding a publisher never requires a deployment.

A permission check answers one question: _does this user hold a role granting permission `P` at a scope covering entity `E`?_ Grants expand to an entity subtree via a materialised `Entity.path`, so a grant at `/ai/mena/lb` covers every entity beneath it.

Roles are the eight AIESEC position titles, a closed list. Nothing in Pulse confers one: a role is derived from a GIS position whose `role.name` matches the class exactly **and** whose `office.tag` is the level that class requires. The two axes disagreeing denies the position rather than guessing which to trust.

| Role           | GIS title    | Required `office.tag` | Scope            |
| -------------- | ------------ | --------------------- | ---------------- |
| `pai`          | `PAI`        | `AI`                  | Global           |
| `ai_vp`        | `AIVP`       | `AI`                  | Global           |
| `ai_manager`   | `AI Manager` | `AI`                  | Global           |
| `mc_president` | `MCP`        | `MC`                  | Their MC subtree |
| `mc_vp`        | `MCVP`       | `MC`                  | Their MC subtree |
| `lc_president` | `LCP`        | `LC`                  | Their LC         |
| `lc_vp`        | `LCVP`       | `LC`                  | Their LC         |
| `member`       | `Member`     | any                   | Their office     |

Grants are reconciled from GIS on every sign-in and nightly, and expire rather than being deleted so past attribution survives a handover. A person for whom no position resolves cannot sign in — there is no implicit `member` fallback.

Three layers enforce this, and only the second is authoritative:

1. **`proxy.ts`** — verifies the session cookie and gates route groups. Coarse; cannot see revocation or scope.
2. **Guards in `lib/rbac/guards.ts`** — the authoritative check, and the mandatory first statement of every Server Action and protected Route Handler. A custom ESLint rule fails the build if one is missing.
3. **Query scoping** — read paths filter by the viewer's scope set, so a missing guard cannot leak rows through a list endpoint.

---

## Authentication

Members sign in through AIESEC OAuth. Pulse is the relying party and issues its own session:

- `GET /api/auth/start` mints an OAuth `state` (and optionally a PKCE verifier), stores it in a short-lived cookie, and redirects to the authorization server.
- `GET /api/auth/callback` verifies `state` before spending the code, exchanges it for tokens, reconciles identity from GIS, and issues a Pulse session.
- OAuth tokens are stored server-side, encrypted with AES-256-GCM. They never reach the browser.
- The session JWT carries only `{ sub, jti, iat, exp }`. Permissions are resolved per request, so a revoked grant takes effect within the minute rather than at next login.
- `Session.revokedAt` makes "sign out everywhere" real, and gives the platform team an offboarding lever.

There is no second way in. No local credentials, no break-glass console, no mock provider. AIESEC OAuth is the sole identity authority for every AIESEC platform, so a parallel path would be a bypass of the only authority Pulse recognises and would have no offboarding story when a term ends. If AIESEC auth is down, Pulse is down; that availability ceiling is accepted deliberately.

---

## Project Structure

```
aiesec-pulse/
├── app/
│   ├── (public)/                 # Session required
│   │   ├── feed/                 # Global feed, scope-filtered
│   │   ├── posts/[slug]/         # Post detail
│   │   ├── profile/              # The author's own posts
│   │   └── settings/privacy/     # Member-facing GDPR controls
│   ├── (authed)/posts/           # Composer and queued posts
│   ├── admin/(protected)/        # Permission-gated, not role-gated
│   │   ├── queue/                # Approval queue, scoped to the viewer
│   │   ├── posts/                # Hide / restore
│   │   ├── comments/             # Comment moderation
│   │   ├── roles/                # Role grants
│   │   ├── activity/             # Publishing analytics
│   │   ├── audit/                # Audit log (read-only)
│   │   └── privacy/              # Data subject request queue
│   ├── legal/                    # Privacy notice, content policy, terms
│   ├── api/
│   │   ├── auth/                 # start, callback, logout
│   │   ├── storage/sign/         # Presigned upload URLs
│   │   ├── inngest/              # Background job endpoint
│   │   └── health/               # Readiness with a freshness timestamp
│   └── actions/                  # Server Actions — every mutation
│
├── lib/
│   ├── rbac/                     # can(), guards, catalogue, position mapping
│   ├── auth/                     # session, oauth, tokens, identity
│   ├── org/                      # entity tree, materialised paths, scope sets
│   ├── content/                  # document sanitisation, slugs
│   ├── privacy/                  # data subject requests
│   ├── audit.ts                  # withAudit() wrapper
│   ├── quota.ts                  # publishing quota resolution
│   ├── rate-limit.ts             # distributed rate limiting
│   └── env.ts                    # validated environment
│
├── jobs/                         # Inngest functions (entity sync, role sync,
│                                 # term transition, retention, DSR export)
├── server-utils/gis.ts           # GIS GraphQL client
├── components/                   # Feed, post detail, admin, shell, engagement
├── prisma/                       # schema.prisma, migrations, seed
├── e2e/                          # Playwright specs + axe assertions
├── __tests__/                    # Vitest unit tests
├── eslint-rules/                 # no-unguarded-server-action
└── proxy.ts                      # Security headers, CSP nonce, route gating
```

---

## Local Development Setup

**Prerequisites:** Node.js 20+, and a Postgres database.

### 1. Clone and install

```bash
git clone <repository-url>
cd aiesec-pulse
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root. Required:

```env
# Database. DIRECT_URL is the non-pooled connection Prisma CLI migrations need;
# set it when your provider puts a connection pooler in front of Postgres.
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# AIESEC OAuth. Credentials are issued by the AIESEC dev team.
AIESEC_OAUTH_AUTH_URL=https://auth.aiesec.org/oauth
AIESEC_OAUTH_CLIENT_ID=
AIESEC_OAUTH_CLIENT_SECRET=
AIESEC_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/callback
GIS_GRAPHQL_URL=https://gis-api.aiesec.org/graphql

# Secrets. Both need at least 32 characters; generate with:
#   openssl rand -base64 32
SESSION_SECRET=
TOKEN_ENCRYPTION_KEY=

NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

Optional. Each degrades gracefully when absent in development, and is **required in production**:

```env
# Object storage for post media
SUPABASE_URL=
SUPABASE_PUBLIC_URL=
SUPABASE_S3_ACCESS_KEY_ID=
SUPABASE_S3_SECRET_ACCESS_KEY=
SUPABASE_S3_REGION=

# Distributed cache and rate limiting. Without these, both fall back to a
# process-local map — correct for one dev server, ineffective across instances.
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Background jobs
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# Observability
SENTRY_DSN=
OTEL_EXPORTER_OTLP_ENDPOINT=

# Declares a non-Vercel host as the live deployment. Vercel sets VERCEL_ENV
# itself, so this is only needed elsewhere.
PULSE_DEPLOYMENT=

# Overrides the computed AIESEC term label. Only set to rehearse a rollover.
PULSE_TERM_LABEL=
```

### 3. Apply migrations and seed

```bash
npx prisma migrate deploy    # apply migrations
npx prisma generate          # generate the Prisma client
npm run seed                 # roles, permissions, topics, quotas, entity root
```

The seed is idempotent — running it twice is a no-op, and it never touches member data.

### 4. Set up object storage

Create a public bucket named `post-media`, then generate S3-compatible access keys for the `SUPABASE_S3_*` variables. Uploads go straight from the browser to the bucket via a presigned URL, so the app never proxies file bodies.

### 5. Start the dev server

```bash
npm run dev
```

The app is available at `http://localhost:3000`.

### Working without AIESEC OAuth credentials

There is no mock sign-in path in the application, so real credentials are required to use the app by hand. What the E2E suite does instead is point the two AIESEC endpoints somewhere else:

```bash
npx tsx e2e/gis-stub/server.ts     # answers as auth.aiesec.org and gis-api.aiesec.org

AIESEC_OAUTH_AUTH_URL=http://127.0.0.1:3099 \
GIS_GRAPHQL_URL=http://127.0.0.1:3099/graphql \
npm run dev
```

Sign in at `/login` as usual. Which persona you get is chosen by a `pulse_e2e_persona` cookie on `127.0.0.1:3099`, one per AIESEC position class — see `e2e/gis-stub/fixtures.ts`. The OAuth handshake, the code exchange, the GIS query and the grant reconciliation all run for real; only the far end of the socket is a stub, which is the point. `playwright.config.ts` wires the same thing up for `npm run test:e2e`.

---

## Available Scripts

```bash
npm run dev         # Dev server at localhost:3000
npm run build       # prisma generate + next build
npm run start       # Production server
npm run seed        # Seed roles, permissions, topics, quotas
npm run test        # Vitest unit tests
npm run test:watch  # Vitest in watch mode
npm run test:e2e    # Playwright E2E + accessibility
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run format      # Prettier
npm run db:migrate  # prisma migrate deploy
npm run db:diff     # Fail if the schema and migration chain disagree
npm run probe:pkce  # Check whether the auth server supports PKCE S256
```

---

## Pre-commit Hook

Husky + lint-staged run on every `git commit`, scoped to staged files:

1. `eslint --fix` on `.js/.jsx/.ts/.tsx/.mjs/.cjs`
2. `prettier --write` on those, plus `.json/.css/.md/.yml/.yaml`

Fixable issues are corrected and re-staged automatically. If ESLint finds an error it cannot fix, the commit is rejected.

The hook is installed by the `prepare` script on first `npm install`. To skip it for one commit — CI still runs the same checks, so this defers rather than removes them:

```bash
git commit --no-verify -m "message"
```

---

## Deployment

The app is built for Vercel but has no hard dependency on it. Set every environment variable in the platform's dashboard, and use separate databases and OAuth redirect URIs for preview and production.

Production refuses to boot without Redis, Sentry, and object storage configured — a deployment that silently falls back to in-memory rate limiting is not a production deployment. On a non-Vercel host, set `PULSE_DEPLOYMENT=production` so that check runs.

Background jobs run through Inngest, triggered by cron. Cron only triggers a job; a serverless request timeout is not a job runtime.

**Production checklist**

- [ ] Production database created and its password rotated
- [ ] `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) both set
- [ ] `npx prisma migrate deploy` run against production
- [ ] `npm run seed` run with production environment
- [ ] `post-media` bucket created with public read, S3 keys issued
- [ ] `SESSION_SECRET` and `TOKEN_ENCRYPTION_KEY` at least 32 characters, stored in a secret manager
- [ ] Redis, Sentry, and Inngest configured
- [ ] AIESEC OAuth client registered with the production redirect URI
- [ ] Every intended administrator holds an AI-level GIS position — there is no other way to grant admin access
- [ ] Smoke test: sign in → publish → approve → react → comment → check the audit log

---

## Contributing

### Non-negotiable conventions

- **Framework.** App Router with React Server Components and Server Actions. Do not introduce a client-side data fetching library — the architecture is server-first by design.
- **Database.** `prisma/schema.prisma` is the single source of truth. Every schema change ships with a migration; CI fails on drift.
- **Authorization.** Every Server Action and protected Route Handler calls exactly one guard from `lib/rbac/guards.ts` as its first statement. Mutations pass the concrete entity they write to, never `GLOBAL_SCOPE`. The `no-unguarded-server-action` ESLint rule enforces the first half; the second is on you.
- **Audit logging.** Every privileged mutation goes through `withAudit()`. Never write to the database directly from an admin action.
- **Validation.** All user input goes through a Zod schema before it reaches the database. Add schemas to `lib/zod-schemas.ts`.
- **Moderation is reversible.** Hide and restore, never delete. Hard deletion is reserved for erasure and legal takedown, behind `admin.privacy_execute`.
- **Styling.** Use the design tokens in `app/globals.css` — no raw hex values, no ad-hoc spacing.
- **Accessibility.** WCAG 2.2 AA. `jsx-a11y` runs at error level and axe-core runs in CI; neither replaces a manual keyboard and screen-reader pass.
- **Comments explain why, not what.** Keep them short, and only where the reasoning is not obvious from the code.

### Workflow

1. Fork the repository and create a feature branch.
2. Run `npm run lint`, `npm run typecheck`, and `npm run test` before pushing.
3. Open a pull request describing what changed and why.

CI runs lint, typecheck, Prettier, unit tests, a migration replay and drift check, E2E with accessibility assertions, a production dependency audit, and a secret scan.

---

## Data Model

The full schema is in [`prisma/schema.prisma`](prisma/schema.prisma). The main tables:

| Model                                            | Purpose                                                                                            |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `Entity`                                         | An AIESEC office mirrored from GIS. Tree: `GLOBAL → REGION → MC → LC`, with a materialised `path`. |
| `User`                                           | Created on first sign-in and reconciled from GIS. Never mastered here.                             |
| `Role` / `Permission` / `RoleGrant`              | Scoped, time-bounded authorization. Grants expire with the term.                                   |
| `Session`                                        | Server-side session record; what makes revocation real.                                            |
| `OauthToken`                                     | AIESEC tokens, AES-256-GCM encrypted at rest.                                                      |
| `Post`                                           | Content, with a status lifecycle and a structured JSON body plus a flattened text projection.      |
| `PostAudience`                                   | Who a post is targeted at. Drives read-path scope filtering.                                       |
| `Reaction` / `Comment` / `Bookmark` / `PostRead` | Engagement and measurement.                                                                        |
| `Report` / `Appeal` / `UserRestriction`          | Trust and safety.                                                                                  |
| `QuotaPolicy`                                    | `(scope, role, period) → max posts`, administered at runtime.                                      |
| `AuditEvent`                                     | Append-only. Never updated or deleted.                                                             |
| `DataSubjectRequest`                             | GDPR requests with a statutory deadline.                                                           |

---

## Security Notes

- Nonce-based CSP with `strict-dynamic` and no `unsafe-inline` in production; `frame-ancestors 'none'`.
- Cookies are `httpOnly`, `Secure` in production, and `SameSite=Lax` — `Lax`, not `Strict`, because the OAuth callback is a cross-site top-level navigation and `Strict` would withhold the cookie exactly when it is needed.
- OAuth `state` is verified before the authorization code is spent, which is what stops login-CSRF.
- OAuth tokens are encrypted at rest and never leave the server. Token material is redacted by field name at the logging sink, so a careless log line added later is contained by default.
- Client IPs are stored as a keyed HMAC, never raw.
- Post bodies are stored as structured JSON and rendered through a node allowlist. No `dangerouslySetInnerHTML`, no raw HTML ingestion. The document is re-sanitised on read as well as on write.
- Every Server Action input is validated with Zod. Prisma parameterizes all queries.
- Mutating Route Handlers are POST-only with an origin check, which Server Actions get from the framework.
- Rate limits are distributed via Redis and use a sliding window. Auth fails closed; everything else fails open, so a limiter outage degrades throttling rather than signing everyone out.
- Erasure removes the person from the append-only audit log without removing the events: `actorId` is nulled and `actorLabel` becomes a salted pseudonym.

---

## Accessibility & Privacy

Members can read the privacy notice, export their data immediately, and request access, correction, or erasure from `/settings/privacy`. Requests carry a statutory deadline and are worked from a queue sorted by that deadline.

Retention is enforced by a scheduled job, not by a document. Published posts, comments, and audit events are exempt — the first two are the organisational record, and the third is append-only.

---

## License

MIT.
