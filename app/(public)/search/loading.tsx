import { HeaderSkeleton } from "@/components/ui/PostGridSkeleton";

export default function SearchLoading() {
  return (
    <main className="mx-auto w-full max-w-[940px] flex-1 px-6 pb-24" aria-busy="true">
      <HeaderSkeleton />
    </main>
  );
}
