import type { TopicKind } from "@/app/generated/prisma/enums";
import { DisplayTitle } from "@/components/ui/DisplayTitle";
import { MetaLine } from "@/components/ui/MetaLine";
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
 * Standfirst fallback and reading-time reuse the server's own functions,
 * so the preview never diverges from what actually gets persisted.
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
          <MetaLine
            className="mb-4"
            items={[
              topic && <TopicPill key="topic" name={topic.name} kind={topic.kind} />,
              authorEntityName,
            ]}
          />
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
