"use client";

import type { ReachOptions } from "@/lib/content/level";

export type ReachValue = "local" | "network";

type Props = {
  options: ReachOptions;
  /** True once the audience is aimed at something narrower than everyone. */
  narrowed?: boolean;
  value: ReachValue;
  onChange: (value: ReachValue) => void;
  note: string;
  onNoteChange: (note: string) => void;
  error?: string;
  disabled?: boolean;
};

/**
 * How far this post will travel, chosen at publication. AI-level offices
 * publish network-wide automatically (a sentence, not a control). Others
 * may spend an MC promotion now — same permission/budget check as the
 * post-detail promotion panel, with a mandatory note.
 */
export function ReachPicker({
  options,
  narrowed = false,
  value,
  onChange,
  note,
  onNoteChange,
  error,
  disabled,
}: Props) {
  if (options.kind === "network") {
    return (
      <div>
        <p className="mb-1.5 text-[14px] font-medium text-[color:var(--foreground)]">Reach</p>
        {narrowed ? (
          <p className="text-[15px] text-[color:var(--muted-foreground)]">
            This post stays inside{" "}
            <span className="font-medium text-[color:var(--foreground)]">
              the audience you chose
            </span>
            . Set the audience to Everyone to reach every MC.
          </p>
        ) : (
          <p className="text-[15px] text-[color:var(--muted-foreground)]">
            This post reaches{" "}
            <span className="font-medium text-[color:var(--foreground)]">every MC</span> — your
            office publishes at network level.
          </p>
        )}
      </div>
    );
  }

  const remaining = Math.max(0, options.max - options.used);
  const exhausted = remaining === 0;
  const networkChosen = value === "network";

  return (
    <div>
      <p className="mb-1.5 text-[14px] font-medium text-[color:var(--foreground)]" id="reach-label">
        Reach
      </p>

      <div
        role="group"
        aria-labelledby="reach-label"
        className="inline-flex flex-wrap gap-1 rounded-[var(--radius-md)] bg-[var(--muted)] p-1"
      >
        <ReachOption
          label="Your MC"
          active={!networkChosen}
          disabled={disabled}
          onClick={() => onChange("local")}
        />
        <ReachOption
          label="The whole network"
          active={networkChosen}
          disabled={disabled || exhausted}
          onClick={() => onChange("network")}
        />
      </div>

      <p className="tabular mt-2 text-[13px] text-[color:var(--muted-foreground)]">
        {exhausted
          ? `Your MC has spent its ${options.max} ${options.max === 1 ? "promotion" : "promotions"} for ${options.periodLabel}. The budget refills next period.`
          : `${remaining} of ${options.max} ${options.max === 1 ? "promotion" : "promotions"} left for ${options.periodLabel}.`}
      </p>

      {networkChosen && (
        <div className="mt-3">
          <label
            htmlFor="promotion-note"
            className="mb-1.5 block text-[14px] font-medium text-[color:var(--foreground)]"
          >
            Why the network should see this{" "}
            <span aria-hidden className="text-[color:var(--destructive-text)]">
              *
            </span>
          </label>
          <input
            id="promotion-note"
            type="text"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            maxLength={500}
            disabled={disabled}
            aria-describedby={error ? "promotion-note-error" : undefined}
            aria-invalid={error ? true : undefined}
            className="min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[15px] text-[color:var(--foreground)] focus:border-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:opacity-50"
          />
          {error && (
            <p
              id="promotion-note-error"
              role="alert"
              className="mt-1 text-[13px] text-[color:var(--destructive-text)]"
            >
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ReachOption({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={[
        "rounded-[var(--radius-sm)] px-3.5 py-2 text-[13px] font-medium tracking-[0.02em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "bg-[var(--card)] text-[color:var(--foreground)]"
          : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
