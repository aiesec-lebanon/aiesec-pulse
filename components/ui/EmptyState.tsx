import Link from "next/link";

import { Reveal } from "@/components/motion/Reveal";
import { DisplayTitle } from "@/components/ui/DisplayTitle";

type EmptyStateLinkAction = { href: string; label: string };
/** A destructive-free POST (sign-out, and the like) — no client handler, no GET. */
type EmptyStateFormAction = { label: string; formAction: string };

function isFormAction(
  action: EmptyStateLinkAction | EmptyStateFormAction
): action is EmptyStateFormAction {
  return "formAction" in action;
}

/** Empty and error states in one component, styled in type not illustration. */
export function EmptyState({
  heading,
  accentWord,
  body,
  action,
  secondaryAction,
  tone = "neutral",
  headingLevel = "h2",
  eyebrow,
}: {
  heading: string;
  /** A word from `heading` to set italic in the accent colour. */
  accentWord?: string;
  body: React.ReactNode;
  action?: EmptyStateLinkAction;
  /** A quieter second way out. Also takes a `formAction` shape for a
   *  `<form method="post">` submit (e.g. sign-out) with no URL to link to. */
  secondaryAction?: EmptyStateLinkAction | EmptyStateFormAction;
  tone?: "neutral" | "error";
  /** h1 where the empty state replaces the page's only heading. */
  headingLevel?: "h1" | "h2";
  /** The state's own name, in the instrument register. */
  eyebrow?: string;
}) {
  const accentColor = tone === "error" ? "var(--destructive-text)" : "var(--primary-text)";

  return (
    <div className="flex w-full max-w-[52ch] flex-col items-start gap-6 py-24">
      {eyebrow && (
        <Reveal y={12}>
          <p className="pulse-label pulse-label-wide">{eyebrow}</p>
        </Reveal>
      )}

      <Reveal y={16}>
        <DisplayTitle
          as={headingLevel}
          size="md"
          title={heading}
          accentWord={accentWord}
          accentColor={accentColor}
          className="text-[color:var(--foreground)]"
        />
      </Reveal>

      <Reveal y={16} delay={90}>
        <div className="max-w-[46ch] text-[17px] leading-[1.6] text-[color:var(--muted-foreground)]">
          {body}
        </div>
      </Reveal>

      {(action || secondaryAction) && (
        <Reveal y={16} delay={170} className="flex flex-wrap items-center gap-5">
          {action && (
            <Link href={action.href} className="pulse-action">
              {action.label}
            </Link>
          )}
          {secondaryAction &&
            (isFormAction(secondaryAction) ? (
              <form action={secondaryAction.formAction} method="post">
                <button
                  type="submit"
                  className="pulse-label pulse-underline min-h-[36px] inline-flex items-center rounded-[var(--radius-sm)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                >
                  {secondaryAction.label}
                </button>
              </form>
            ) : (
              <Link
                href={secondaryAction.href}
                className="pulse-label pulse-underline min-h-[36px] inline-flex items-center rounded-[var(--radius-sm)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
              >
                {secondaryAction.label}
              </Link>
            ))}
        </Reveal>
      )}
    </div>
  );
}
