"use client";

import { Zap, ZapOff } from "lucide-react";

import { useMotion } from "@/components/motion/motion-context";

/**
 * `aria-pressed` reflects state, `aria-label` names the action (not the
 * icon), and a visually-hidden `aria-live` region announces the result —
 * the icon alone doesn't convey the change.
 */
export function MotionToggle() {
  const { motion, setMotion } = useMotion();
  const reduced = motion === "reduced";

  return (
    <button
      type="button"
      aria-pressed={reduced}
      aria-label={reduced ? "Turn on full motion" : "Reduce motion"}
      title={reduced ? "Motion: reduced" : "Motion: full"}
      onClick={() => setMotion(reduced ? "full" : "reduced")}
      className="group relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[color:var(--muted-foreground)] transition-colors duration-200 hover:bg-[var(--muted)] hover:text-[color:var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
    >
      <span className="relative flex h-[18px] w-[18px] items-center justify-center">
        <Zap
          size={18}
          strokeWidth={2}
          aria-hidden
          className="absolute transition-[opacity,transform] duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)]"
          style={{
            opacity: reduced ? 0 : 1,
            transform: reduced ? "rotate(-90deg) scale(0.6)" : "none",
          }}
        />
        <ZapOff
          size={18}
          strokeWidth={2}
          aria-hidden
          className="absolute transition-[opacity,transform] duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)]"
          style={{
            opacity: reduced ? 1 : 0,
            transform: reduced ? "none" : "rotate(90deg) scale(0.6)",
          }}
        />
      </span>
      <span aria-live="polite" className="sr-only">
        {reduced ? "Motion reduced" : "Full motion"}
      </span>
    </button>
  );
}

/**
 * Same preference, as a menu row: `role="menuitemcheckbox"` states what it
 * is and its value, the label names the setting (not the action), and the
 * trailing word repeats the value — correct whether announced or read.
 */
export function MotionMenuItem({
  className,
  role = "menuitemcheckbox",
}: {
  className?: string;
  role?: "menuitemcheckbox" | "switch";
}) {
  const { motion, setMotion } = useMotion();
  const reduced = motion === "reduced";

  return (
    <button
      type="button"
      role={role}
      aria-checked={!reduced}
      onClick={() => setMotion(reduced ? "full" : "reduced")}
      className={className}
    >
      <span className="flex flex-1 items-center gap-2.5">
        <span className="relative flex h-[15px] w-[15px] shrink-0 items-center justify-center">
          <Zap
            size={15}
            strokeWidth={2}
            aria-hidden
            className="absolute transition-[opacity,transform] duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)]"
            style={{
              opacity: reduced ? 0 : 1,
              transform: reduced ? "rotate(-90deg) scale(0.6)" : "none",
            }}
          />
          <ZapOff
            size={15}
            strokeWidth={2}
            aria-hidden
            className="absolute transition-[opacity,transform] duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)]"
            style={{
              opacity: reduced ? 1 : 0,
              transform: reduced ? "none" : "rotate(90deg) scale(0.6)",
            }}
          />
        </span>
        Animation
      </span>
      <span className="pulse-label shrink-0 text-[10px]">{reduced ? "Reduced" : "Full"}</span>
    </button>
  );
}
