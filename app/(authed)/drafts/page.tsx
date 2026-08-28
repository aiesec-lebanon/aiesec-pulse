import Link from "next/link";

import { listMyDrafts } from "@/app/actions/drafts";
import { DeleteDraftButton } from "@/components/drafts/DeleteDraftButton";
import { Reveal } from "@/components/motion/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
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
        <EmptyState
          eyebrow="Nothing yet"
          heading="No drafts yet."
          body="Start writing an update — it's saved automatically as you go, so you can leave and pick it back up anytime."
          action={{ href: "/posts/new", label: "Write an update" }}
        />
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
