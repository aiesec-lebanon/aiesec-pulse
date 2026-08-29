import { splitBrandLockup } from "@/lib/org/display";

/**
 * Defaults to one plain colour so the two-tone treatment stays a scarce
 * signal, not a wordmark on every mention. `tone="title"` gives that
 * two-tone lockup for a lone per-screen h1 — prefer DisplayTitle's
 * accentWord={brandPlaceAccent(name)} instead, which keeps balance/clamp.
 */
export function EntityName({
  name,
  tone = "plain",
  className,
}: {
  name: string;
  /** `plain` (default) — one colour. `title` — the two-tone lockup, once per screen. */
  tone?: "plain" | "title";
  className?: string;
}) {
  const { mark, rest } = splitBrandLockup(name);

  if (tone === "plain" || !mark || !rest.trim()) {
    return <span className={className}>{name}</span>;
  }

  return (
    <span className={className}>
      {mark}
      <span className="pulse-brand-place">{rest}</span>
    </span>
  );
}
