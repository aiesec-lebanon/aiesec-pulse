import { Bone, HeaderSkeleton, SpecStripSkeleton } from "@/components/ui/PostGridSkeleton";

export default function QueueLoading() {
  return (
    <main className="mx-auto w-full max-w-[900px] px-4 pb-24 pt-8 sm:px-6" aria-busy="true">
      <HeaderSkeleton />
      <SpecStripSkeleton />
      <div className="mt-10 flex flex-col gap-7">
        {[0, 1, 2].map((i) => (
          <div key={i} className="border-b border-[var(--hairline)] pb-7">
            <Bone className="h-2.5 w-40" />
            <Bone className="mt-3 h-6 w-3/4" />
            <Bone className="mt-4 h-4 w-full" />
            <Bone className="mt-2 h-4 w-2/3" />
          </div>
        ))}
      </div>
    </main>
  );
}
