import Link from "next/link";

import { listMyDrafts } from "@/app/actions/drafts";
import { DeleteDraftButton } from "@/components/drafts/DeleteDraftButton";
import { Reveal } from "@/components/motion/Reveal";
import { PageHeader } from "@/components/ui/PageHeader";
import { requirePermission } from "@/lib/rbac/guards";
import { relativeTime } from "@/lib/relative-time";

export default async function DraftsPage() {
  await requirePermission("post.draft");
  const drafts = await listMyDrafts();

  return (
    <main className="mx-auto w-full max-w-[1240px] flex-1 px-6 pb-24">
      <PageHeader
        title="Drafts"
        count={drafts.length}
        standfirst="Saved automatically as you write. Nothing here is visible to anyone else yet."
        breadcrumb={[
          { href: "/feed", label: "Feed" },
          { href: "/profile", label: "Your posts" },
          { label: "Drafts" },
        ]}
        actions={
          <Link href="/posts/new" className="aiesec-btn-primary">
            New post
          </Link>
        }
      />

      {drafts.length === 0 ? (
        <DraftsEmptyState />
      ) : (
        <ul className="mt-10 flex flex-col gap-3">
          {drafts.map((draft, i) => (
            <Reveal
              as="li"
              key={draft.id}
              y={18}
              delay={Math.min(i, 8) * 55}
              className="pulse-plate pulse-plate-interactive flex flex-wrap items-center justify-between gap-3 p-5"
            >
              <Link
                href={`/posts/${draft.slug}/edit`}
                className="min-w-0 flex-1 rounded-[var(--radius-sm)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
              >
                <p className="truncate text-[15px] font-bold leading-snug text-[color:var(--foreground)] transition-colors hover:text-[color:var(--primary-text)]">
                  {draft.title || "Untitled draft"}
                </p>
                <p className="mt-1 line-clamp-1 text-[13px] leading-[1.5] text-[color:var(--muted-foreground)]">
                  {draft.summary || draft.bodyText || "No content yet."}
                </p>
                <time
                  dateTime={draft.updatedAt.toISOString()}
                  className="mt-1 block text-[12px] text-[color:var(--muted-foreground)]"
                >
                  Last saved {relativeTime(draft.updatedAt)}
                </time>
              </Link>

              <DeleteDraftButton postId={draft.id} title={draft.title} />
            </Reveal>
          ))}
        </ul>
      )}
    </main>
  );
}

function DraftsEmptyState() {
  return (
    <div className="pulse-plate mt-10 flex flex-col items-center gap-7 px-8 py-20 text-center">
      <div
        className="animate-float-drift pulse-ambient text-[color:var(--muted-foreground)] opacity-60"
        aria-hidden="true"
      >
        <DraftIllustration className="h-auto w-28" />
      </div>

      <div className="flex max-w-sm flex-col gap-3">
        <h2 className="text-[20px] font-bold text-[color:var(--foreground)]">No drafts yet.</h2>
        <p className="text-[16px] leading-[1.6] text-[color:var(--muted-foreground)]">
          Start writing an update — it&apos;s saved automatically as you go, so you can leave and
          pick it back up anytime.
        </p>
      </div>

      <Link href="/posts/new" className="aiesec-btn-primary">
        Write an update
      </Link>
    </div>
  );
}

function DraftIllustration({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      {/* Page */}
      <path
        d="M24 6 H64 L78 20 V82 H24 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.04"
      />
      {/* Folded corner */}
      <path d="M64 6 V20 H78" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Text lines */}
      <line
        x1="33"
        y1="38"
        x2="69"
        y2="38"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
      />
      <line
        x1="33"
        y1="48"
        x2="69"
        y2="48"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
      />
      <line
        x1="33"
        y1="58"
        x2="54"
        y2="58"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* Pencil */}
      <path
        d="M58 74 L86 46 L94 54 L66 82 L56 84 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.06"
      />
      <line x1="80" y1="52" x2="88" y2="60" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
