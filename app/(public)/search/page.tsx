import { Reveal } from "@/components/motion/Reveal";
import { SearchForm, type SearchFormInitial } from "@/components/search/SearchForm";
import { SearchResultRow } from "@/components/search/SearchResultRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
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
    <main className="mx-auto w-full max-w-[940px] flex-1 px-6 pb-24">
      <header className="pb-8 pt-12 sm:pt-16">
        <Reveal y={16}>
          <h1 className="pulse-display pulse-display-md text-[color:var(--foreground)]">Search</h1>
          <p className="mt-3 max-w-[52ch] text-[17px] leading-[1.55] text-[color:var(--muted-foreground)]">
            Everything published across the network, by keyword — then narrowed by topic, entity,
            type or date.
          </p>
        </Reveal>
      </header>

      <Reveal y={16} delay={80}>
        <SearchForm topics={topics} entities={entities} initial={initial} />
      </Reveal>

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
        <section aria-label={`Results for ${filters.query}`} className="mt-12">
          <p className="pulse-label mb-5 border-b border-[var(--hairline)] pb-4">
            {results.length} {results.length === 1 ? "result" : "results"} on this page
          </p>
          <div role="list" className="flex flex-col">
            {results.map((hit, i) => (
              <Reveal key={hit.id} y={18} delay={Math.min(i, 6) * 55}>
                <SearchResultRow hit={hit} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {filters.query && (results.length > 0 || filters.page > 1) && (
        <Pagination
          label="Search pagination"
          page={filters.page}
          hasNext={hasNext}
          previousHref={filters.page > 1 ? paginationHref(params, filters.page - 1) : null}
          nextHref={paginationHref(params, filters.page + 1)}
        />
      )}
    </main>
  );
}
