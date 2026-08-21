import "server-only";

import { Prisma } from "@/app/generated/prisma/client";
import { PostKind } from "@/app/generated/prisma/enums";
import { db } from "@/lib/db";
import { scopeSetFor } from "@/lib/org/scope";
import { requireSession } from "@/lib/rbac/guards";
import { type FilterableEntity, KIND_LABELS } from "@/lib/search-shared";

// architecture.md §12's canonical shape: websearch_to_tsquery over the
// generated searchVector column, ranked with ts_rank, snippeted with
// ts_headline. The audience check there is illustrated as a plain JOIN; this
// uses EXISTS instead (matching lib/org/scope.ts's visibilityFilter() Prisma
// semantics exactly) so a post targeted at more than one entity the viewer
// belongs to can't produce duplicate rows.

// Re-exported so server-side callers (the search page, SearchResultRow) can
// keep importing everything from this one module — only the client-side
// SearchForm needs to reach past this file to lib/search-shared directly.
export { type FilterableEntity, KIND_LABELS };

export type SnippetPart = { text: string; highlighted: boolean };

// ts_headline is asked (via chr(1)/chr(2) in the query below) to wrap
// matches in charCode 1/2 rather than HTML, so the snippet can be rendered
// as plain React text nodes below — never dangerouslySetInnerHTML — with no
// risk of a post body that happens to contain literal "<mark>"-like text
// being interpreted as markup. fromCharCode rather than embedding the raw
// control character keeps the source file plain, diffable ASCII.
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
 * Pure param parsing, independent of any request or database — a topic id
 * or kind that doesn't resolve to anything real is dropped rather than
 * rejected, the same "silently ignore a stale filter" call topics.ts's
 * resolveValidTopicIds already makes, since a filter carries no
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
};

type RawHit = {
  id: string;
  slug: string;
  title: string;
  kind: PostKind;
  entityName: string;
  authorName: string;
  publishedAt: Date;
  snippet: string;
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
  // visibilityFilter): a post is visible because it is NETWORK, or because it
  // is aimed at somewhere in the viewer's local scope. Search is neither a way
  // around targeting nor a way around level — hold one of the two arms back
  // here and a promoted post from another MC would be readable in the feed and
  // missing from search.
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

  // CROSS JOIN, not the comma-join architecture.md §12 illustrates
  // (`FROM "Post" p, websearch_to_tsquery(...) q`) — Postgres accepts the
  // comma form fine on its own (verified directly against it), but Prisma
  // 7's $queryRaw interpreter throws "invalid reference to FROM-clause entry
  // for table p" once an explicit `JOIN ... ON` referencing p follows it in
  // the same FROM clause. ANSI CROSS JOIN sidesteps whatever that parser
  // trips on and behaves identically.
  const rows = await db.$queryRaw<RawHit[]>(Prisma.sql`
    SELECT
      p."id" AS "id",
      p."slug" AS "slug",
      p."title" AS "title",
      p."kind" AS "kind",
      e."name" AS "entityName",
      u."fullName" AS "authorName",
      p."publishedAt" AS "publishedAt",
      ts_headline(
        'simple', p."bodyText", q,
        'MaxWords=32, MinWords=15, MaxFragments=2, StartSel=' || chr(1) || ', StopSel=' || chr(2)
      ) AS "snippet"
    FROM "Post" p
    CROSS JOIN websearch_to_tsquery('simple', ${query}) q
    JOIN "Entity" e ON e."id" = p."publisherEntityId"
    JOIN "User" u ON u."id" = p."authorId"
    WHERE ${Prisma.join(conditions, " AND ")}
    ORDER BY ts_rank(p."searchVector", q) DESC, p."publishedAt" DESC
    LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}
  `);

  const page1 = rows.slice(0, PAGE_SIZE);
  return {
    results: page1.map((row) => ({ ...row, snippet: parseSnippet(row.snippet) })),
    hasNext: rows.length > PAGE_SIZE,
  };
}

// A flat, alphabetised list for the filter bar's plain <select> (design
// system §10.3 — no typeahead here, unlike the composer's
// AudiencePicker). Small enough to list in full at this org's actual scale;
// escalate to the same trigram search the audience picker already uses if
// that stops being true.
export async function listFilterableEntities(): Promise<FilterableEntity[]> {
  return db.entity.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, tag: true },
  });
}

export const SEARCH_PAGE_SIZE = PAGE_SIZE;
