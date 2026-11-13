// Still public: proxy.ts lists /legal, because a privacy notice you can only
// read after signing in is one you cannot read before deciding whether to.
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[1240px] flex-1 px-6 pb-24">
      {/* Left-aligned at a reading measure so it shares the header's left edge. */}
      <article className="legal-prose max-w-[760px] pt-12 sm:pt-16">{children}</article>
    </main>
  );
}
