"use client";

import { Check, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { type FollowState, toggleFollow } from "@/app/actions/follows";
import type { FollowTarget } from "@/app/generated/prisma/enums";

type Props = {
  targetType: FollowTarget;
  targetId: string;
  initialState: FollowState;
  /** The topic or entity name — used only for the aria-label/live region, never shown. */
  label: string;
  /** Icon-only, for tight spaces (feed card meta rows). Defaults to icon+text. */
  compact?: boolean;
};

const DEBOUNCE_MS = 300;

// Same shape as ReactionButton (§10.8's cited reference): debounced so a
// double-tap can't fire two round-trips whose responses arrive out of order,
// optimistic with a revert-on-failure, aria-live announced.
export function FollowButton({
  targetType,
  targetId,
  initialState,
  label,
  compact = false,
}: Props) {
  const [state, setState] = useState<FollowState>(initialState);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    },
    []
  );

  function handleClick() {
    setError(null);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);

    const revert = state;
    // A muted target that gets "followed" here lands on "following" too —
    // this button only ever expresses the follow/unfollow half of the
    // toggle, matching M9's scope (mute has no inline control here).
    setState(state === "following" ? "none" : "following");

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await toggleFollow(targetType, targetId);
        if (!result.ok) throw new Error(result.error);
        setState(result.state);
      } catch {
        setState(revert);
        setError("Couldn't update — try again.");
        errorTimerRef.current = setTimeout(() => setError(null), 3000);
      }
    }, DEBOUNCE_MS);
  }

  const following = state === "following";

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={following}
        aria-label={following ? `Unfollow ${label}` : `Follow ${label}`}
        className={[
          "flex min-h-[36px] min-w-[44px] items-center justify-center gap-1 rounded-[var(--radius-sm)] px-2 text-[13px] font-bold transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]",
          following
            ? "text-[var(--primary-text)]"
            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
        ].join(" ")}
      >
        {following ? (
          <Check size={16} strokeWidth={2.5} aria-hidden />
        ) : (
          <Plus size={16} strokeWidth={2.5} aria-hidden />
        )}
        {!compact && <span aria-hidden>{following ? "Following" : "Follow"}</span>}
      </button>

      <span aria-live="polite" className="sr-only">
        {following ? `Now following ${label}` : `No longer following ${label}`}
      </span>

      {error && (
        <div
          role="alert"
          className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-sm)] bg-[var(--foreground)] px-3 py-1.5 text-[12px] font-medium text-[var(--card)]"
        >
          {error}
        </div>
      )}
    </div>
  );
}
