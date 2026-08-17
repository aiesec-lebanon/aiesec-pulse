"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { exportOwnData, raiseOwnRequest } from "@/app/actions/privacy";

type OpenRequest = {
  id: string;
  kind: string;
  status: string;
  receivedAt: string;
  dueAt: string;
};

const REQUEST_KINDS = [
  { value: "RECTIFICATION", label: "Correct something that's wrong" },
  { value: "ERASURE", label: "Erase my data" },
  { value: "OBJECTION", label: "Object to how my data is used" },
  { value: "ACCESS", label: "Ask what you hold about me" },
] as const;

// Downloads via a Blob rather than a server route, so the bundle never exists
// as a fetchable URL.
export function PrivacyControls({
  openRequests,
  slaDays,
}: {
  openRequests: OpenRequest[];
  slaDays: number;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<string>("RECTIFICATION");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [exporting, startExport] = useTransition();

  function handleExport() {
    setMessage(null);
    startExport(async () => {
      const result = await exportOwnData();
      if (!result.ok) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      const blob = new Blob([result.bundle], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `aiesec-pulse-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage({ tone: "ok", text: "Your export has been downloaded." });
    });
  }

  function handleRaise(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await raiseOwnRequest({ kind: kind as never, notes: notes || undefined });
      if (result.ok) {
        setMessage({
          tone: "ok",
          text: `Request received. We'll respond within ${slaDays} days.`,
        });
        setNotes("");
        router.refresh();
      } else {
        setMessage({ tone: "error", text: result.error });
      }
    });
  }

  return (
    <>
      <section aria-labelledby="export-heading" className="mt-10">
        <h2 id="export-heading" className="mb-3 text-[20px] font-bold text-[var(--foreground)]">
          Download your data
        </h2>
        <p className="text-[15px] leading-[1.6] text-[var(--muted-foreground)]">
          A machine-readable copy of your profile, posts, comments, reactions, bookmarks, reading
          history, notifications and sessions.
        </p>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="aiesec-btn-primary mt-3 disabled:opacity-50"
        >
          {exporting ? "Preparing…" : "Download my data (JSON)"}
        </button>
      </section>

      <section aria-labelledby="request-heading" className="mt-10">
        <h2 id="request-heading" className="mb-3 text-[20px] font-bold text-[var(--foreground)]">
          Make a request
        </h2>
        <p className="text-[15px] leading-[1.6] text-[var(--muted-foreground)]">
          Requests are handled by AIESEC International as data controller, within {slaDays} days.
        </p>

        {openRequests.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2">
            {openRequests.map((request) => (
              <li key={request.id} className="aiesec-card flex flex-wrap items-center gap-3 p-3">
                <span className="rounded-[var(--radius-md)] bg-[var(--muted)] px-2 py-0.5 text-[12px] font-medium text-[var(--muted-foreground)]">
                  {request.kind.toLowerCase()}
                </span>
                <span className="text-[14px] text-[var(--foreground)]">
                  {request.status.replace("_", " ").toLowerCase()}
                </span>
                <span className="ml-auto text-[13px] text-[var(--muted-foreground)]">
                  Due{" "}
                  {new Date(request.dueAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleRaise} className="mt-4 flex flex-col gap-4">
          <div>
            <label
              htmlFor="dsr-kind"
              className="mb-1.5 block text-[14px] font-medium text-[var(--foreground)]"
            >
              What would you like to do?
            </label>
            <select
              id="dsr-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="w-full min-h-[36px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[15px] text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
            >
              {REQUEST_KINDS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="dsr-notes"
              className="mb-1.5 block text-[14px] font-medium text-[var(--foreground)]"
            >
              Anything we should know?{" "}
              <span className="font-normal text-[var(--muted-foreground)]">(optional)</span>
            </label>
            <textarea
              id="dsr-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={2000}
              className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[15px] text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
            />
          </div>

          {kind === "ERASURE" && (
            <p className="rounded-[var(--radius-md)] border border-[var(--destructive)]/30 bg-[color-mix(in_srgb,var(--destructive)_8%,var(--card))] px-4 py-3 text-[14px] leading-[1.5] text-[var(--destructive-text)]">
              Erasure is permanent. You&apos;ll be asked whether your posts and comments should stay
              published under &ldquo;Former member&rdquo; or be removed. Records of moderation
              decisions are kept for seven years with your identity removed.
            </p>
          )}

          {message && (
            <p
              role="alert"
              className={`text-[14px] ${
                message.tone === "ok"
                  ? "text-[var(--success-text)]"
                  : "text-[var(--destructive-text)]"
              }`}
            >
              {message.text}
            </p>
          )}

          <div>
            <button
              type="submit"
              disabled={pending}
              className="aiesec-btn-secondary disabled:opacity-50"
            >
              {pending ? "Sending…" : "Send request"}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
