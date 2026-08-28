"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { advanceRequest, executeErasureRequest } from "@/app/actions/privacy";
import { Pill } from "@/components/ui/Pill";
import type { ErasureChoice } from "@/lib/privacy/dsr";

export type DsrRow = {
  id: string;
  kind: string;
  status: string;
  subjectName: string;
  subjectEmail: string | null;
  subjectStatus: string | null;
  receivedAt: string;
  dueAt: string;
  overdue: boolean;
  completedAt: string | null;
  notes: string | null;
};

const STATUS_TINT: Record<string, { tint: string; text: string }> = {
  RECEIVED: {
    tint: "color-mix(in srgb, var(--primary) 10%, transparent)",
    text: "var(--primary-text)",
  },
  IN_PROGRESS: {
    tint: "color-mix(in srgb, var(--destructive) 10%, transparent)",
    text: "var(--destructive-text)",
  },
  COMPLETED: {
    tint: "color-mix(in srgb, var(--success) 10%, transparent)",
    text: "var(--success-text)",
  },
  REFUSED: { tint: "var(--muted)", text: "var(--muted-foreground)" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Erasure is irreversible and the content election is the subject’s, so the
// operator records what was asked for rather than picking a default.
export function DsrQueue({ rows }: { rows: DsrRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [erasureTarget, setErasureTarget] = useState<DsrRow | null>(null);
  const [choice, setChoice] = useState<ErasureChoice>("reattribute");
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  function closeErasure() {
    setErasureTarget(null);
    setConfirmText("");
    setError(null);
  }

  useEffect(() => {
    if (!erasureTarget) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLInputElement>("#erasure-choice-reattribute")?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeErasure();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), a[href]"
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus.current?.focus();
    };
  }, [erasureTarget]);

  function advance(row: DsrRow, status: "IN_PROGRESS" | "COMPLETED" | "REFUSED") {
    setBusyId(row.id);
    setError(null);
    startTransition(async () => {
      const result = await advanceRequest(row.id, status, row.notes ?? "");
      if (!result.ok) setError(result.error);
      setBusyId(null);
      router.refresh();
    });
  }

  function runErasure() {
    if (!erasureTarget) return;
    if (confirmText !== "ERASE") {
      setError("Type ERASE to confirm.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await executeErasureRequest(erasureTarget.id, choice);
      if (result.ok) {
        setErasureTarget(null);
        setConfirmText("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      {error && !erasureTarget && (
        <p role="alert" className="mb-4 text-[14px] text-[color:var(--destructive-text)]">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2" role="list" aria-label="Data subject requests">
        {rows.map((row) => (
          <article key={row.id} role="listitem" className="aiesec-card p-4">
            <div className="flex flex-wrap items-start gap-3">
              <Pill
                className="shrink-0"
                label={row.status.replace("_", " ").toLowerCase()}
                tint={(STATUS_TINT[row.status] ?? STATUS_TINT.REFUSED).tint}
                text={(STATUS_TINT[row.status] ?? STATUS_TINT.REFUSED).text}
              />
              <Pill
                className="shrink-0"
                label={row.kind.toLowerCase()}
                tint="var(--muted)"
                text="var(--muted-foreground)"
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold text-[color:var(--foreground)]">
                  {row.subjectName}
                  {row.subjectStatus === "ERASED" && (
                    <span className="ml-2 text-[13px] font-normal text-[color:var(--muted-foreground)]">
                      (already erased)
                    </span>
                  )}
                </p>
                {row.subjectEmail && (
                  <p className="truncate text-[13px] text-[color:var(--muted-foreground)]">
                    {row.subjectEmail}
                  </p>
                )}
              </div>

              <div className="shrink-0 text-right text-[13px]">
                <p className="text-[color:var(--muted-foreground)]">
                  Received {formatDate(row.receivedAt)}
                </p>
                <p
                  className={
                    row.overdue
                      ? "font-bold text-[color:var(--destructive-text)]"
                      : "text-[color:var(--muted-foreground)]"
                  }
                >
                  {row.completedAt
                    ? `Closed ${formatDate(row.completedAt)}`
                    : `Due ${formatDate(row.dueAt)}`}
                  {row.overdue ? " · overdue" : ""}
                </p>
              </div>
            </div>

            {row.notes && (
              <p className="mt-2 text-[13px] leading-[1.5] text-[color:var(--muted-foreground)]">
                {row.notes}
              </p>
            )}

            {row.status !== "COMPLETED" && row.status !== "REFUSED" && (
              <div className="mt-3 flex flex-wrap gap-2">
                {row.status === "RECEIVED" && (
                  <button
                    type="button"
                    onClick={() => advance(row, "IN_PROGRESS")}
                    disabled={pending && busyId === row.id}
                    className="aiesec-btn-secondary min-h-[36px]"
                  >
                    Start
                  </button>
                )}
                {row.kind === "ERASURE" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setErasureTarget(row);
                      setConfirmText("");
                      setError(null);
                    }}
                    className="min-h-[36px] rounded-[var(--radius-sm)] bg-[var(--destructive-text)] px-4 py-2 text-[14px] font-bold text-[color:var(--primary-foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                  >
                    Execute erasure…
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => advance(row, "COMPLETED")}
                    disabled={pending && busyId === row.id}
                    className="aiesec-btn-primary min-h-[36px]"
                  >
                    Mark complete
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => advance(row, "REFUSED")}
                  disabled={pending && busyId === row.id}
                  className="aiesec-btn-secondary min-h-[36px]"
                >
                  Refuse
                </button>
              </div>
            )}
          </article>
        ))}
      </div>

      {erasureTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="erasure-title"
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
        >
          <div className="absolute inset-0 bg-black/50" onClick={closeErasure} aria-hidden="true" />

          <div
            ref={dialogRef}
            className="relative w-full max-w-lg rounded-[var(--radius-lg)] border border-[var(--destructive)]/40 bg-[var(--card)] p-6"
          >
            <h2
              id="erasure-title"
              className="text-[18px] font-bold text-[color:var(--destructive-text)]"
            >
              Execute erasure for {erasureTarget.subjectName}
            </h2>
            <p className="mt-2 text-[14px] leading-[1.6] text-[color:var(--muted-foreground)]">
              This cannot be undone. The account is anonymised, reading and engagement history is
              deleted, sessions and tokens are revoked, and the audit log keeps its events with the
              person removed.
            </p>

            <fieldset className="mt-5">
              <legend className="mb-2 text-[14px] font-medium text-[color:var(--foreground)]">
                What did the subject elect for their authored content?
              </legend>
              <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--border)] p-3">
                <input
                  id="erasure-choice-reattribute"
                  type="radio"
                  name="erasure-choice"
                  value="reattribute"
                  checked={choice === "reattribute"}
                  onChange={() => setChoice("reattribute")}
                  aria-describedby="erasure-choice-reattribute-hint"
                  className="mt-1"
                />
                <span>
                  <label
                    htmlFor="erasure-choice-reattribute"
                    className="block text-[15px] font-medium text-[color:var(--foreground)]"
                  >
                    Reattribute to &ldquo;Former member&rdquo;
                  </label>
                  <span
                    id="erasure-choice-reattribute-hint"
                    className="block text-[13px] text-[color:var(--muted-foreground)]"
                  >
                    Posts and comments stay published without naming the author.
                  </span>
                </span>
              </div>
              <div className="mt-2 flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--border)] p-3">
                <input
                  id="erasure-choice-remove"
                  type="radio"
                  name="erasure-choice"
                  value="remove"
                  checked={choice === "remove"}
                  onChange={() => setChoice("remove")}
                  aria-describedby="erasure-choice-remove-hint"
                  className="mt-1"
                />
                <span>
                  <label
                    htmlFor="erasure-choice-remove"
                    className="block text-[15px] font-medium text-[color:var(--foreground)]"
                  >
                    Remove their content
                  </label>
                  <span
                    id="erasure-choice-remove-hint"
                    className="block text-[13px] text-[color:var(--muted-foreground)]"
                  >
                    Posts are archived and emptied; comments become tombstones.
                  </span>
                </span>
              </div>
            </fieldset>

            <label
              htmlFor="erasure-confirm"
              className="mb-1.5 mt-5 block text-[14px] font-medium text-[color:var(--foreground)]"
            >
              Type <span className="font-bold">ERASE</span> to confirm
            </label>
            <input
              id="erasure-confirm"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              className="w-full min-h-[36px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[15px] text-[color:var(--foreground)] focus:border-[var(--destructive)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            />

            {error && (
              <p role="alert" className="mt-2 text-[13px] text-[color:var(--destructive-text)]">
                {error}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeErasure}
                disabled={pending}
                className="aiesec-btn-secondary min-h-[36px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runErasure}
                disabled={pending || confirmText !== "ERASE"}
                className="min-h-[36px] rounded-[var(--radius-sm)] bg-[var(--destructive-text)] px-4 py-2 text-[14px] font-bold text-[color:var(--primary-foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:opacity-40"
              >
                {pending ? "Erasing…" : "Execute erasure"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
