import "server-only";

import { Prisma } from "@/app/generated/prisma/client";
import { type EntityKind, PostKind, type TopicKind } from "@/app/generated/prisma/enums";
import { db } from "@/lib/db";
import { entityDisplayName } from "@/lib/org/display";
import { scopeSetFor } from "@/lib/org/scope";
import { requireSession } from "@/lib/rbac/guards";
import { type FilterableEntity, KIND_LABELS } from "@/lib/search-shared";

// The audience check uses EXISTS — matching lib/org/scope.ts's
// visibilityFilter() Prisma semantics exactly — so a post targeted at several
// of the viewer's entities can't produce duplicate rows.

export { type FilterableEntity, KIND_LABELS };

export type SnippetPart = { text: string; highlighted: boolean };

// ts_headline is asked (via chr(1)/chr(2) below) to wrap matches in charCode
// 1/2 rather than HTML, so the snippet renders as plain React text nodes —
// never dangerouslySetInnerHTML — with no risk that a post body's literal
// "<mark>"-like text gets read as markup.
const SNIPPET_START = String.fromCharCode(1);
const SNIPPET_STOP = String.fromCharCode(2);

export function parseSnippet(raw: string): SnippetPart[] {
  const parts: SnippetPart[] = [];
  let rest = raw;

  while (rest.length > 0) {
    const start = rest.indexOf(SNIPPET_START);
    if (start === -1) {
      parts.push({ text: rest, highlighted: false });
      break;
    }
    if (start > 0) parts.push({ text: rest.slice(0, start), highlighted: false });

    const stop = rest.indexOf(SNIPPET_STOP, start + 1);
    if (stop === -1) {
      // No closing marker — shouldn't happen given how the marker is
      // generated, but the remainder is still shown rather than dropped.
      parts.push({ text: rest.slice(start + 1), highlighted: false });
      break;
    }
    parts.push({ text: rest.slice(start + 1, stop), highlighted: true });
    rest = rest.slice(stop + 1);
  }

  return parts;
}

export type SearchFilters = {
  query: string;
  topicIds: string[];
  entityId: string | null;
  kind: PostKind | null;
  dateFrom: Date | null;
  dateTo: Date | null;
  page: number;
};

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isPostKind(value: string): value is PostKind {
  return (Object.values(PostKind) as string[]).includes(value);
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Pure param parsing, independent of any request or database — an
 * unresolvable topic id or kind is dropped, not rejected: a filter carries no
 * authorisation weight the way audience targeting does.
 */
export function parseSearchFilters(params: RawSearchParams): SearchFilters {
  const query = (firstValue(params.q) ?? "").trim();

  const topicIds = (firstValue(params.topics) ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const entityId = firstValue(params.entity)?.trim() || null;

  const kindRaw = firstValue(params.kind);
  const kind = kindRaw && isPostKind(kindRaw) ? kindRaw : null;

  const dateFrom = parseDate(firstValue(params.from));
  const dateTo = parseDate(firstValue(params.to));

  const pageRaw = parseInt(firstValue(params.page) ?? "1", 10);
  const page = Math.max(1, Number.isNaN(pageRaw) ? 1 : pageRaw);

  return { query, topicIds, entityId, kind, dateFrom, dateTo, page };
}

export type SearchHit = {
  id: string;
  slug: string;
  title: string;
  kind: PostKind;
  entityName: string;
  authorName: string;
  publishedAt: Date;
  snippet: SnippetPart[];
  topicName: string | null;
  topicKind: TopicKind | null;
};

type RawHit = {
  id: string;
  slug: string;
  title: string;
  kind: PostKind;
  entityName: string;
  entityKind: EntityKind;
  authorName: string;
  publishedAt: Date;
  snippet: string;
  topicName: string | null;
  topicKind: TopicKind | null;
};

const PAGE_SIZE = 20;

export async function searchPosts(
  filters: SearchFilters
): Promise<{ results: SearchHit[]; hasNext: boolean }> {
  const query = filters.query.trim();
  if (!query) return { results: [], hasNext: false };

  const user = await requireSession();
  const scope = await scopeSetFor(user);

  // Same union the feed and topic archive enforce (lib/org/scope.ts's
  // visibilityFilter): a post is visible if it's NETWORK, or aimed at
  // somewhere in the viewer's local scope. Search bypasses neither targeting
  // nor level — drop either arm and a promoted post from another MC would
  // show in the feed but be missing from search.
  const visibilityCondition = scope.unrestricted
    ? Prisma.sql`TRUE`
    : Prisma.sql`(
        p."level" = 'NETWORK'
        OR EXISTS (
          SELECT 1 FROM "PostAudience" pa
          WHERE pa."postId" = p."id"
            AND (
              pa."scopeType" = 'GLOBAL'
              ${
                scope.entityIds.length > 0
                  ? Prisma.sql`OR pa."entityId" IN (${Prisma.join(scope.entityIds)})`
                  : Prisma.empty
              }
            )
        )
      )
  `;

  const conditions: Prisma.Sql[] = [
    Prisma.sql`p."status" = 'PUBLISHED'`,
    Prisma.sql`p."publishedAt" <= now()`,
    Prisma.sql`(p."expiresAt" IS NULL OR p."expiresAt" > now())`,
    Prisma.sql`p."searchVector" @@ q`,
    visibilityCondition,
  ];
  if (filters.entityId) {
    conditions.push(Prisma.sql`p."publisherEntityId" = ${filters.entityId}`);
  }
  if (filters.kind) {
    conditions.push(Prisma.sql`p."kind" = ${filters.kind}::"PostKind"`);
  }
  if (filters.dateFrom) {
    conditions.push(Prisma.sql`p."publishedAt" >= ${filters.dateFrom}`);
  }
  if (filters.dateTo) {
    conditions.push(Prisma.sql`p."publishedAt" <= ${filters.dateTo}`);
  }
  if (filters.topicIds.length > 0) {
    conditions.push(Prisma.sql`
      EXISTS (
        SELECT 1 FROM "PostTopic" pt
        WHERE pt."postId" = p."id" AND pt."topicId" IN (${Prisma.join(filters.topicIds)})
      )
    `);
  }

  const page = Math.max(1, filters.page);

  // CROSS JOIN, not the comma-join form
  // (`FROM "Post" p, websearch_to_tsquery(...) q`) — Postgres accepts the
  // comma form fine on its own (verified directly), but Prisma 7's $queryRaw
  // interpreter throws "invalid reference to FROM-clause entry for table p"
  // once an explicit `JOIN ... ON` referencing p follows in the same FROM
  // clause. ANSI CROSS JOIN sidesteps whatever the parser trips on, behaving
  // identically.
  const rows = await db.$queryRaw<RawHit[]>(Prisma.sql`
    SELECT
      p."id" AS "id",
      p."slug" AS "slug",
      p."title" AS "title",
      p."kind" AS "kind",
      e."name" AS "entityName",
      e."kind" AS "entityKind",
      u."fullName" AS "authorName",
      p."publishedAt" AS "publishedAt",
      ts_headline(
        'simple', p."bodyText", q,
        'MaxWords=32, MinWords=15, MaxFragments=2, StartSel=' || chr(1) || ', StopSel=' || chr(2)
      ) AS "snippet",
      t."name" AS "topicName",
      t."kind" AS "topicKind"
    FROM "Post" p
    CROSS JOIN websearch_to_tsquery('simple', ${query}) q
    JOIN "Entity" e ON e."id" = p."publisherEntityId"
    JOIN "User" u ON u."id" = p."authorId"
    LEFT JOIN LATERAL (
      SELECT pt."topicId" FROM "PostTopic" pt WHERE pt."postId" = p."id" ORDER BY pt."topicId" LIMIT 1
    ) first_topic ON true
    LEFT JOIN "Topic" t ON t."id" = first_topic."topicId"
    WHERE ${Prisma.join(conditions, " AND ")}
    ORDER BY ts_rank(p."searchVector", q) DESC, p."publishedAt" DESC
    LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}
  `);

  const page1 = rows.slice(0, PAGE_SIZE);
  return {
    results: page1.map((row) => ({
      ...row,
      entityName: entityDisplayName(row.entityName, row.entityKind) ?? row.entityName,
      snippet: parseSnippet(row.snippet),
    })),
    hasNext: rows.length > PAGE_SIZE,
  };
}

// A flat, alphabetised list for the filter bar's plain <select> — no
// typeahead, unlike the composer's AudiencePicker; escalate to the trigram
// search the audience picker already uses if the entity count outgrows this.
export async function listFilterableEntities(): Promise<FilterableEntity[]> {
  const rows = await db.entity.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, tag: true, kind: true },
  });
  return rows.map((row) => ({
    id: row.id,
    tag: row.tag,
    name: entityDisplayName(row.name, row.kind) ?? row.name,
  }));
}
