"use client";

import { Zap, ZapOff } from "lucide-react";

import { useMotion } from "@/components/motion/motion-context";

/**
 * Icon-button toggle (§10.8): `aria-pressed` reflects state, `aria-label`
 * names the action the click performs, 44px hit area, and a visually-hidden
 * `aria-live` region announcing the result — the state change is not conveyed
 * by the icon alone.
 *
 * The two icons cross-fade and counter-rotate rather than swapping, so the
 * control demonstrates the thing it controls. Under Reduced that animation
 * collapses with everything else, which is the honest behaviour: the control
 * should look the way it is about to make the rest of the app look.
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
