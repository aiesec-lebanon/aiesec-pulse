import { splitBrandLockup } from "@/lib/org/display";

/**
 * An office's name. Defaults to one colour, the ambient text colour: an
 * earlier version coloured the wordmark everywhere an entity appeared,
 * spending the system's strongest signal on repeated subtext instead of the
 * headline.
 *
 * `tone="title"` is the two-tone lockup (place name italic in the accent
 * colour), meant for a single per-screen `h1`. Prefer
 * `accentWord={brandPlaceAccent(name)}` on a `DisplayTitle` heading instead —
 * using `tone="title"` there loses `DisplayTitle`'s balance/clamp behaviour.
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
