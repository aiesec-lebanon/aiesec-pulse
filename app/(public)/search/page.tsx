import { Reveal } from "@/components/motion/Reveal";
import { SearchForm, type SearchFormInitial } from "@/components/search/SearchForm";
import { SearchResultRow } from "@/components/search/SearchResultRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { listActiveTopics } from "@/lib/content/topics";
import { requireSession } from "@/lib/rbac/guards";
import { listFilterableEntities, parseSearchFilters, searchPosts } from "@/lib/search";

export const dynamic = "force-dynamic";

export const metadata = { title: "Search · AIESEC Pulse" };

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Best-effort preset match for SearchForm's selected state after reload;
// an unmatched "from" just shows "Any time" — results still honour it.
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
  // Guarded here, not just in searchPosts: an empty query skips that guard,
  // so unauthenticated users would otherwise see the filter chrome.
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
      <PageHeader
        title="Search"
        standfirst="Everything published across the network, by keyword — then narrowed by topic, entity, type or date."
        eyebrow={
          <span aria-hidden className="inline-flex gap-1.5">
            <span className="h-[7px] w-[7px] rounded-full bg-[var(--topic-programme)]" />
            <span className="h-[7px] w-[7px] rounded-full bg-[var(--topic-function)]" />
            <span className="h-[7px] w-[7px] rounded-full bg-[var(--topic-general)]" />
          </span>
        }
      />

      <Reveal y={16} delay={80} className="mt-10">
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
