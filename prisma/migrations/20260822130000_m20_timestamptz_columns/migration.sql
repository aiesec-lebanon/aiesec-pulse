-- Postgres recommends against `timestamp without time zone` outside a narrow
-- set of cases (https://www.postgresql.org/docs/current/datatype-datetime.html).
-- Every timestamp this schema stores is an instant (UTC), never a wall-clock
-- value meant to float across zones, so every `timestamp(3)` column becomes
-- `timestamptz(3)`. Client formatting continues to render each instant in the
-- viewer's zone (architecture.md §12 "Formatting"); the DB itself stays UTC.
--
-- `USING "col" AT TIME ZONE 'UTC'` is explicit about how the existing naive
-- values are interpreted, rather than relying on the session's `TimeZone`
-- setting at migration time — the existing values were always written as UTC
-- instants (`now()`, or `scheduledAt`/`startsAt` resolved client-side per
-- architecture.md §8.5), so this reinterpretation is lossless: it changes the
-- column's wire representation, not the instant each row already recorded.
--
-- `PostMetricDaily.day` stays `date` — it has no time-of-day component to be
-- timezone-ambiguous about.

-- ── Organisation & identity ────────────────────────────────────────────────
ALTER TABLE "Entity" ALTER COLUMN "syncedAt" TYPE TIMESTAMPTZ(3) USING "syncedAt" AT TIME ZONE 'UTC';
ALTER TABLE "Entity" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "Entity" ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "User" ALTER COLUMN "lastSyncedAt" TYPE TIMESTAMPTZ(3) USING "lastSyncedAt" AT TIME ZONE 'UTC';
ALTER TABLE "User" ALTER COLUMN "lastSeenAt" TYPE TIMESTAMPTZ(3) USING "lastSeenAt" AT TIME ZONE 'UTC';
ALTER TABLE "User" ALTER COLUMN "erasedAt" TYPE TIMESTAMPTZ(3) USING "erasedAt" AT TIME ZONE 'UTC';
ALTER TABLE "User" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "User" ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "RoleGrant" ALTER COLUMN "startsAt" TYPE TIMESTAMPTZ(3) USING "startsAt" AT TIME ZONE 'UTC';
ALTER TABLE "RoleGrant" ALTER COLUMN "endsAt" TYPE TIMESTAMPTZ(3) USING "endsAt" AT TIME ZONE 'UTC';
ALTER TABLE "RoleGrant" ALTER COLUMN "revokedAt" TYPE TIMESTAMPTZ(3) USING "revokedAt" AT TIME ZONE 'UTC';
ALTER TABLE "RoleGrant" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "Session" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "Session" ALTER COLUMN "lastSeenAt" TYPE TIMESTAMPTZ(3) USING "lastSeenAt" AT TIME ZONE 'UTC';
ALTER TABLE "Session" ALTER COLUMN "expiresAt" TYPE TIMESTAMPTZ(3) USING "expiresAt" AT TIME ZONE 'UTC';
ALTER TABLE "Session" ALTER COLUMN "revokedAt" TYPE TIMESTAMPTZ(3) USING "revokedAt" AT TIME ZONE 'UTC';

ALTER TABLE "OauthToken" ALTER COLUMN "expiresAt" TYPE TIMESTAMPTZ(3) USING "expiresAt" AT TIME ZONE 'UTC';
ALTER TABLE "OauthToken" ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- ── Content ─────────────────────────────────────────────────────────────────
ALTER TABLE "Post" ALTER COLUMN "pinnedUntil" TYPE TIMESTAMPTZ(3) USING "pinnedUntil" AT TIME ZONE 'UTC';
ALTER TABLE "Post" ALTER COLUMN "expiresAt" TYPE TIMESTAMPTZ(3) USING "expiresAt" AT TIME ZONE 'UTC';
ALTER TABLE "Post" ALTER COLUMN "promotedAt" TYPE TIMESTAMPTZ(3) USING "promotedAt" AT TIME ZONE 'UTC';
ALTER TABLE "Post" ALTER COLUMN "scheduledAt" TYPE TIMESTAMPTZ(3) USING "scheduledAt" AT TIME ZONE 'UTC';
ALTER TABLE "Post" ALTER COLUMN "publishedAt" TYPE TIMESTAMPTZ(3) USING "publishedAt" AT TIME ZONE 'UTC';
ALTER TABLE "Post" ALTER COLUMN "archivedAt" TYPE TIMESTAMPTZ(3) USING "archivedAt" AT TIME ZONE 'UTC';
ALTER TABLE "Post" ALTER COLUMN "hiddenAt" TYPE TIMESTAMPTZ(3) USING "hiddenAt" AT TIME ZONE 'UTC';
ALTER TABLE "Post" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "Post" ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "PostVersion" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "EventDetail" ALTER COLUMN "startsAt" TYPE TIMESTAMPTZ(3) USING "startsAt" AT TIME ZONE 'UTC';
ALTER TABLE "EventDetail" ALTER COLUMN "endsAt" TYPE TIMESTAMPTZ(3) USING "endsAt" AT TIME ZONE 'UTC';

ALTER TABLE "Media" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

-- ── Engagement & measurement ───────────────────────────────────────────────
ALTER TABLE "Reaction" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "Comment" ALTER COLUMN "editedAt" TYPE TIMESTAMPTZ(3) USING "editedAt" AT TIME ZONE 'UTC';
ALTER TABLE "Comment" ALTER COLUMN "hiddenAt" TYPE TIMESTAMPTZ(3) USING "hiddenAt" AT TIME ZONE 'UTC';
ALTER TABLE "Comment" ALTER COLUMN "deletedAt" TYPE TIMESTAMPTZ(3) USING "deletedAt" AT TIME ZONE 'UTC';
ALTER TABLE "Comment" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "Bookmark" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "Follow" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "PostRead" ALTER COLUMN "firstReadAt" TYPE TIMESTAMPTZ(3) USING "firstReadAt" AT TIME ZONE 'UTC';
ALTER TABLE "PostRead" ALTER COLUMN "lastReadAt" TYPE TIMESTAMPTZ(3) USING "lastReadAt" AT TIME ZONE 'UTC';

ALTER TABLE "Acknowledgement" ALTER COLUMN "acknowledgedAt" TYPE TIMESTAMPTZ(3) USING "acknowledgedAt" AT TIME ZONE 'UTC';

ALTER TABLE "PostDelivery" ALTER COLUMN "deliveredAt" TYPE TIMESTAMPTZ(3) USING "deliveredAt" AT TIME ZONE 'UTC';

-- ── Notifications ───────────────────────────────────────────────────────────
ALTER TABLE "Notification" ALTER COLUMN "readAt" TYPE TIMESTAMPTZ(3) USING "readAt" AT TIME ZONE 'UTC';
ALTER TABLE "Notification" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "UserDigestSetting" ALTER COLUMN "lastSentAt" TYPE TIMESTAMPTZ(3) USING "lastSentAt" AT TIME ZONE 'UTC';
ALTER TABLE "UserDigestSetting" ALTER COLUMN "unsubscribedAt" TYPE TIMESTAMPTZ(3) USING "unsubscribedAt" AT TIME ZONE 'UTC';

ALTER TABLE "PushSubscription" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "PushSubscription" ALTER COLUMN "lastUsedAt" TYPE TIMESTAMPTZ(3) USING "lastUsedAt" AT TIME ZONE 'UTC';

ALTER TABLE "EmailDelivery" ALTER COLUMN "sentAt" TYPE TIMESTAMPTZ(3) USING "sentAt" AT TIME ZONE 'UTC';
ALTER TABLE "EmailDelivery" ALTER COLUMN "openedAt" TYPE TIMESTAMPTZ(3) USING "openedAt" AT TIME ZONE 'UTC';
ALTER TABLE "EmailDelivery" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

-- ── Trust & safety, governance, operations ─────────────────────────────────
ALTER TABLE "Report" ALTER COLUMN "resolvedAt" TYPE TIMESTAMPTZ(3) USING "resolvedAt" AT TIME ZONE 'UTC';
ALTER TABLE "Report" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "Appeal" ALTER COLUMN "decidedAt" TYPE TIMESTAMPTZ(3) USING "decidedAt" AT TIME ZONE 'UTC';
ALTER TABLE "Appeal" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "UserRestriction" ALTER COLUMN "startsAt" TYPE TIMESTAMPTZ(3) USING "startsAt" AT TIME ZONE 'UTC';
ALTER TABLE "UserRestriction" ALTER COLUMN "endsAt" TYPE TIMESTAMPTZ(3) USING "endsAt" AT TIME ZONE 'UTC';

ALTER TABLE "AuditEvent" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "FeatureFlag" ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "RankingWeight" ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "DataSubjectRequest" ALTER COLUMN "receivedAt" TYPE TIMESTAMPTZ(3) USING "receivedAt" AT TIME ZONE 'UTC';
ALTER TABLE "DataSubjectRequest" ALTER COLUMN "dueAt" TYPE TIMESTAMPTZ(3) USING "dueAt" AT TIME ZONE 'UTC';
ALTER TABLE "DataSubjectRequest" ALTER COLUMN "completedAt" TYPE TIMESTAMPTZ(3) USING "completedAt" AT TIME ZONE 'UTC';

ALTER TABLE "SyncRun" ALTER COLUMN "startedAt" TYPE TIMESTAMPTZ(3) USING "startedAt" AT TIME ZONE 'UTC';
ALTER TABLE "SyncRun" ALTER COLUMN "finishedAt" TYPE TIMESTAMPTZ(3) USING "finishedAt" AT TIME ZONE 'UTC';
