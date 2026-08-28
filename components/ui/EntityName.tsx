import { splitBrandLockup } from "@/lib/org/display";

/**
 * An office's name.
 *
 * By default it is **one colour** — the ambient text colour, whatever that is.
 * That's the important part of this component, and it's a correction: the
 * first version painted the wordmark half in brand blue *everywhere* an entity
 * appeared, putting a saturated accent into every card footer, byline,
 * comment, and metadata rule on the page. Colour is the system's strongest
 * signal; spending it on the same repeated subtext everywhere spends it on
 * nothing, and pulls the eye from the headline the reader is actually there
 * for.
 *
 * The two-tone lockup is a **title** treatment, and only that — the reference
 * file uses it once per screen, on the `h1` of an entity's own page, where the
 * name *is* the subject. It accents the other half: the place name goes
 * italic in the accent colour ("AIESEC *in Brazil*"), while the wordmark
 * stays in the foreground colour — the constant, with the place as the
 * variable an accent is for.
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
