import { splitBrandLockup } from "@/lib/org/display";

/**
 * An office's name.
 *
 * By default it is **one colour** — the ambient text colour, whatever that is.
 * That is the important part of this component, and it is a correction: the
 * first version painted the wordmark half in brand blue *everywhere* an entity
 * appeared, which put a saturated accent into every card footer, every byline,
 * every comment, every metadata rule on the page. Colour is the strongest
 * signal the system has; spending it on the same repeated subtext on every
 * surface spends it on nothing, and it pulls the eye away from the headline the
 * reader is actually there for.
 *
 * The two-tone lockup is a **title** treatment, and only that — the reference
 * file uses it once per screen, on the `h1` of an entity's own page, where the
 * name *is* the subject. And it accents the other half: the place name goes
 * italic in the accent colour ("AIESEC *in Brazil*"), while the wordmark stays
 * in the foreground colour. The wordmark is the constant; the place is the
 * variable, and the variable is what an accent is for.
 *
 * On a page that renders its title through `DisplayTitle`, prefer passing
 * `accentWord={brandPlaceAccent(name)}` — same result, one type register, and
 * the headline keeps its balance and clamp behaviour. `tone="title"` exists for
 * the cases that are not a `DisplayTitle`.
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
