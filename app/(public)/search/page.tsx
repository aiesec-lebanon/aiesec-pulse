import { FeedIllustration } from "@/components/feed/FeedIllustration";
import { SearchForm, type SearchFormInitial } from "@/components/search/SearchForm";
import { SearchResultRow } from "@/components/search/SearchResultRow";
import { listActiveTopics } from "@/lib/content/topics";
import { requireSession } from "@/lib/rbac/guards";
import { listFilterableEntities, parseSearchFilters, searchPosts } from "@/lib/search";

export const dynamic = "force-dynamic";

export const metadata = { title: "Search · AIESEC Pulse" };

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Best-effort only: reconstructs which preset the form should show as
// selected after a reload, by checking whether "from" lands close to one of
// SearchForm's fixed day-counts. A "from" the presets couldn't have produced
// (a hand-edited URL, or a future preset added there but not here) simply
// shows as "Any time" — the results themselves still honour the real value.
function inferDaysPreset(dateFrom: Date | null): string {
  if (!dateFrom) return "";
  const diffDays = Math.round((Date.now() - dateFrom.getTime()) / ONE_DAY_MS);
  for (const preset of [7, 30, 365]) {
    if (Math.abs(diffDays - preset) <= 1) return String(preset);
  }
  return "";
}

type RawSearchParams = Record<string, string | string[] | undefined>;

function paginationHref(params: RawSearchParams, page: number): string {
  const qs = new URLSearchParams();
  for (const key of ["q", "topics", "entity", "kind", "from", "to"]) {
    const value = params[key];
    const first = Array.isArray(value) ? value[0] : value;
    if (first) qs.set(key, first);
  }
  if (page > 1) qs.set("page", String(page));
  const query = qs.toString();
  return query ? `/search?${query}` : "/search";
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  // Search is a signed-in surface (context.md §7.1's permission matrix lists
  // "View feed, search, archive" alongside the rest of the reader
  // experience) — guarded here even though an empty query never reaches
  // searchPosts's own guard, so landing on /search unauthenticated still
  // redirects rather than rendering the filter chrome.
  await requireSession();

  const params = await searchParams;
  const filters = parseSearchFilters(params);

  const [topics, entities, { results, hasNext }] = await Promise.all([
    listActiveTopics(),
    listFilterableEntities(),
    searchPosts(filters),
  ]);

  const initial: SearchFormInitial = {
    query: filters.query,
    topicIds: filters.topicIds,
    entityId: filters.entityId ?? "",
    kind: filters.kind ?? "",
    days: inferDaysPreset(filters.dateFrom),
  };

  return (
    <main className="mx-auto w-full max-w-[900px] flex-1 px-6 py-10">
      <h1 className="text-[32px] font-black leading-[1.1] tracking-tight text-[var(--foreground)]">
        Search
      </h1>

      <div className="mt-6">
        <SearchForm topics={topics} entities={entities} initial={initial} />
      </div>

      {!filters.query ? (
        <EmptyState
          heading="Search the network"
          body="Find posts by keyword, then narrow by topic, entity, type, or date."
        />
      ) : results.length === 0 ? (
        <EmptyState
          heading={`Nothing matched "${filters.query}"`}
          body="Try a different keyword, or loosen a filter."
        />
      ) : (
        <section aria-label={`Results for ${filters.query}`} className="mt-8">
          <div role="list" className="flex flex-col gap-4">
            {results.map((hit) => (
              <SearchResultRow key={hit.id} hit={hit} />
            ))}
          </div>
        </section>
      )}

      {filters.query && (results.length > 0 || filters.page > 1) && (
        <nav
          aria-label="Search pagination"
          className="mt-12 flex items-center justify-center gap-4"
        >
          {filters.page > 1 && (
            <a
              href={paginationHref(params, filters.page - 1)}
              className="min-h-[44px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-5 py-2.5 text-[15px] font-bold text-[var(--foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              <span aria-hidden>←</span> Newer
            </a>
          )}
          {results.length > 0 && (
            <span className="select-none text-[14px] tabular-nums text-[var(--muted-foreground)]">
              Page {filters.page}
            </span>
          )}
          {hasNext && (
            <a
              href={paginationHref(params, filters.page + 1)}
              className="min-h-[44px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-5 py-2.5 text-[15px] font-bold text-[var(--foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              Older <span aria-hidden>→</span>
            </a>
          )}
        </nav>
      )}
    </main>
  );
}

function EmptyState({ heading, body }: { heading: string; body: string }) {
  return (
    <div className="mx-auto mt-16 flex max-w-sm flex-col items-center gap-6 text-center">
      <div
        className="text-[var(--muted-foreground)] opacity-60 animate-float-drift"
        aria-hidden="true"
      >
        <FeedIllustration className="h-auto w-36" />
      </div>
      <div className="flex flex-col gap-3">
        <h2 className="text-[20px] font-bold text-[var(--foreground)]">{heading}</h2>
        <p className="text-[16px] leading-[1.6] text-[var(--muted-foreground)]">{body}</p>
      </div>
    </div>
  );
}
