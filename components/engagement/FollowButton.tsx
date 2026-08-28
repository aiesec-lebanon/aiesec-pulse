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
  /**
   * `inline` (default) is the quiet text+icon control in a metadata rule.
   * `prominent` is the boxed one 4a puts in a profile hero — the one place
   * §0.6 sanctions a box, since a standalone action needs to read as
   * pressable. Following inverts to an outline, so the two states read
   * apart by shape as well as colour and icon.
   */
  variant?: "inline" | "prominent";
};

const DEBOUNCE_MS = 300;

// Same shape as ReactionButton: debounced so a double-tap can't fire two
// round-trips whose responses arrive out of order, optimistic with
// revert-on-failure, aria-live announced.
export function FollowButton({
  targetType,
  targetId,
  initialState,
  label,
  compact = false,
  variant = "inline",
}: Props) {
  const [state, setState] = useState<FollowState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [pressKey, setPressKey] = useState(0);

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
    // this button only expresses the follow/unfollow half of the
    // toggle: mute has no inline control here.
    setState(state === "following" ? "none" : "following");
    setPressKey((k) => k + 1);

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

  const inlineClass = [
    "flex min-h-[36px] min-w-[44px] items-center justify-center gap-1 rounded-[var(--radius-sm)] px-2 text-[13px] font-bold transition-colors",
    following
      ? "text-[color:var(--primary-text)]"
      : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
  ].join(" ");

  const prominentClass = [
    "pulse-label flex min-h-[44px] items-center justify-center gap-2 rounded-[3px] px-5 transition-[background-color,border-color,color,transform] duration-[calc(var(--dur-micro)*var(--motion-scale))] active:scale-[0.97]",
    following
      ? "border border-[var(--hairline)] text-[color:var(--foreground)] hover:border-[var(--primary)] hover:text-[color:var(--primary-text)]"
      : "border border-transparent bg-[var(--foreground)] text-[color:var(--background)] hover:bg-[var(--primary-fill)] hover:text-[color:var(--primary-foreground)]",
  ].join(" ");

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={following}
        aria-label={following ? `Unfollow ${label}` : `Follow ${label}`}
        className={[
          variant === "prominent" ? prominentClass : inlineClass,
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]",
        ].join(" ")}
      >
        <span
          key={pressKey}
          aria-hidden
          className={pressKey > 0 ? "pulse-pop flex items-center" : "flex items-center"}
        >
          {following ? <Check size={16} strokeWidth={2.5} /> : <Plus size={16} strokeWidth={2.5} />}
        </span>
        {!compact && <span aria-hidden>{following ? "Following" : "Follow"}</span>}
      </button>

      <span aria-live="polite" className="sr-only">
        {following ? `Now following ${label}` : `No longer following ${label}`}
      </span>

      {error && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2">
          <div
            role="alert"
            className="pulse-copy-in whitespace-nowrap rounded-[var(--radius-sm)] bg-[var(--foreground)] px-3 py-1.5 text-[12px] font-medium text-[color:var(--card)]"
            style={{ ["--copy-y" as string]: "6px" }}
          >
            {error}
          </div>
        </div>
      )}
    </div>
  );
}
