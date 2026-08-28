"use client";

import { Globe, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { demotePost, promotePost, type PromotionBudget } from "@/app/actions/posts";
import { PostLevel } from "@/app/generated/prisma/enums";
import { ReasonModal } from "@/components/ui/ReasonModal";

/**
 * The MCP's editorial valve, on the post it acts on.
 *
 * Rendered only when the viewer may actually promote this post — the server
 * returns no budget otherwise — so this control never has to explain why it's
 * disabled. The remaining quota is stated before the click rather than
 * discovered by refusal: promotion is meant to be a deliberate choice against
 * a known budget, which is the budget's whole purpose.
 */
export function PromotionControls({
  postId,
  postTitle,
  level,
  budget,
}: {
  postId: string;
  postTitle: string;
  level: PostLevel;
  budget: PromotionBudget;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();

  const promoted = level === PostLevel.NETWORK;
  const remaining = Math.max(0, budget.max - budget.used);

  function handleDemote() {
    setError(null);
    startTransition(async () => {
      const result = await demotePost(postId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStatus("Returned to local. Only your MC and its LCs can see this post.");
      router.refresh();
    });
  }

  return (
    <section
      aria-labelledby="promotion-heading"
      className="mt-10 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--elev-1)]"
    >
      <h2
        id="promotion-heading"
        className="text-[20px] font-bold leading-tight text-[color:var(--foreground)]"
      >
        Network reach
      </h2>

      <p className="mt-2 text-[14px] leading-[1.5] text-[color:var(--muted-foreground)]">
        {promoted
          ? "Every MC sees this post. Returning it to local does not give the promotion back."
          : "Only your MC and the LCs beneath it can see this post. Promoting it puts it in front of the whole network."}
      </p>

      <p className="tabular mt-3 text-[14px] text-[color:var(--foreground)]">
        {remaining} of {budget.max} {budget.max === 1 ? "promotion" : "promotions"} left for{" "}
        {budget.periodLabel}
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        {promoted ? (
          <button
            type="button"
            onClick={handleDemote}
            disabled={pending}
            className="inline-flex min-h-[36px] items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] px-4 py-2 text-[14px] font-bold text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:opacity-50"
          >
            <Undo2 size={15} strokeWidth={2.5} aria-hidden />
            {pending ? "Returning…" : "Return to local"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setModalOpen(true);
            }}
            disabled={!budget.available}
            className="inline-flex min-h-[36px] items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--primary-fill)] px-4 py-2 text-[14px] font-bold text-[color:var(--primary-foreground)] transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:opacity-50"
          >
            <Globe size={15} strokeWidth={2.5} aria-hidden />
            Promote to the network
          </button>
        )}
      </div>

      {!budget.available && !promoted && (
        <p className="mt-3 text-[13px] text-[color:var(--destructive-text)]">
          Your MC has spent this period&apos;s promotions. The budget refills next period.
        </p>
      )}

      {/* The outcome of a non-navigating action is announced, never left to a
          colour change nobody is looking at. Both regions are always rendered,
          so each exists before it has anything to say. */}
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>
      <p role="alert" className="mt-3 text-[13px] text-[color:var(--destructive-text)]">
        {error}
      </p>

      <ReasonModal
        key={modalOpen ? "open" : "closed"}
        open={modalOpen}
        title="Promote to the whole network?"
        description="Every MC will see this post. It spends one of your MC's promotions for this period, and returning it to local later does not give that back."
        targetLabel={postTitle}
        reasonLabel="Why the network should see this"
        reasonHint="Say why this is worth the whole network's attention — at least 5 characters."
        confirmLabel="Promote"
        pendingLabel="Promoting…"
        tone="primary"
        onClose={() => setModalOpen(false)}
        onConfirm={async (note) => {
          const result = await promotePost(postId, note);
          if (result.ok) {
            setStatus("Promoted. Every MC can now see this post.");
            router.refresh();
          }
          return result;
        }}
      />
    </section>
  );
}
