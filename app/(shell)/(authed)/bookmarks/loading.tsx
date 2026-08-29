import { HeaderSkeleton, IndexRowsSkeleton } from "@/components/ui/PostGridSkeleton";

export default function BookmarksLoading() {
  return (
    <main className="mx-auto w-full max-w-[1240px] flex-1 px-6 pb-24" aria-busy="true">
      <HeaderSkeleton />
      <IndexRowsSkeleton count={5} />
    </main>
  );
}
