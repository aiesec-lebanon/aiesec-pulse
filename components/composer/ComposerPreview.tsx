import type { TopicKind } from "@/app/generated/prisma/enums";
import { DisplayTitle } from "@/components/ui/DisplayTitle";
import { TopicPill } from "@/components/ui/TopicPill";
import { TopicPlate } from "@/components/ui/TopicPlate";
import { excerptFrom, readingMinutes } from "@/lib/content/document";
import { tokensForKind } from "@/lib/topics-shared";

export type ComposerPreviewProps = {
  title: string;
  /** The phrase chosen in `TitleAccentPicker`, so the preview shows the accent. */
  titleAccent: string;
  bodyText: string;
  summary: string;
  imagePreview: string | null;
  topic: { name: string; kind: TopicKind } | null;
  authorDisplayName: string;
  authorEntityName: string | null;
  status: "Draft" | "Scheduled";
};

/**
 * A live mirror of how the post will read, beside the fields that produce
 * it — 7a's split editor. Purely derived from the caller's form state: no
 * state of its own, no network calls.
 *
 * The standfirst fallback and word-count/reading-time line call the same
 * functions the server uses to fill a blank summary and store
 * `readingMinutes` — so the preview is never a rounder, prettier lie about
 * what's persisted.
 */
export function ComposerPreview({
  title,
  titleAccent,
  bodyText,
  summary,
  imagePreview,
  topic,
  authorDisplayName,
  authorEntityName,
  status,
}: ComposerPreviewProps) {
  const standfirst = summary.trim() || (bodyText ? excerptFrom(bodyText) : "");
  const words = bodyText.trim() ? bodyText.trim().split(/\s+/).filter(Boolean).length : 0;
  const mins = readingMinutes(bodyText);
  const plateEntity = authorEntityName ?? authorDisplayName;

  return (
    <div>
      <p className="pulse-label mb-4">Preview · {status}</p>
      <div className="border border-[var(--hairline)] bg-[var(--card)]">
        <div className="relative h-[190px] overflow-hidden">
          {imagePreview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL, same rationale as PostComposer's own dropzone preview
            <img src={imagePreview} alt="" className="h-full w-full object-cover" />
          ) : (
            <TopicPlate entityName={plateEntity} kind={topic?.kind ?? null} />
          )}
        </div>
        <div className="p-7">
          <p className="pulse-label mb-4 flex flex-wrap items-center gap-2.5">
            {topic && <TopicPill name={topic.name} kind={topic.kind} />}
            {authorEntityName && (
              <span className="normal-case tracking-[0.06em] text-[color:var(--muted-foreground)]">
                {authorEntityName}
              </span>
            )}
          </p>
          <DisplayTitle
            as="h2"
            size="sm"
            title={title.trim() || "Your headline will appear here"}
            accentWord={titleAccent}
            accentColor={topic ? tokensForKind(topic.kind).text : undefined}
            className="break-words text-[color:var(--foreground)]"
          />
          <p className="mt-4 text-[15px] leading-[1.6] text-[color:var(--muted-foreground)]">
            {standfirst || "Your standfirst will appear here."}
          </p>
        </div>
      </div>
      <p className="pulse-label mt-3 tracking-[0.1em]">
        {words} words · {mins} min read
      </p>
    </div>
  );
}
