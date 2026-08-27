"use client";

import { useState, useTransition } from "react";

import { approvePost } from "@/app/actions/posts";
import type { TopicKind } from "@/app/generated/prisma/enums";
import { EntityName } from "@/components/ui/EntityName";
import { TopicLabel } from "@/components/ui/TopicPill";

import { RejectModal } from "./RejectModal";

const EXCERPT_LIMIT = 300;

interface QueueCardProps {
  postId: string;
  authorName: string;
  authorEntity: string;
  submittedAt: string;
  title: string;
  content: string;
  mediaUrl: string | null;
  mediaAlt: string | null;
  linkUrl: string | null;
  topicName: string | null;
  topicKind: TopicKind | null;
}

export function QueueCard({
  postId,
  authorName,
  authorEntity,
  submittedAt,
  title,
  content,
  mediaUrl,
  mediaAlt,
  linkUrl,
  topicName,
  topicKind,
}: QueueCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isLong = content.length > EXCERPT_LIMIT;
  const displayContent = !isLong || expanded ? content : content.slice(0, EXCERPT_LIMIT) + "…";

  const handleApprove = () => {
    startTransition(async () => {
      await approvePost(postId);
    });
  };

  let linkDomain: string | null = null;
  try {
    if (linkUrl) linkDomain = new URL(linkUrl).hostname;
  } catch {
    linkDomain = linkUrl;
  }

  return (
    <>
      <article
        aria-label={`Queued post: ${title}`}
        className="flex flex-col gap-4 border-b border-[var(--hairline)] py-7 first:pt-0"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="pulse-label flex flex-wrap items-center gap-x-2.5 gap-y-1">
              {topicName && topicKind && <TopicLabel name={topicName} kind={topicKind} />}
              <span className="normal-case tracking-[0.06em] text-[color:var(--foreground)]">
                {authorName}
              </span>
              {authorEntity && (
                <>
                  <span aria-hidden>·</span>
                  <EntityName name={authorEntity} className="normal-case tracking-[0.06em]" />
                </>
              )}
              <span aria-hidden>·</span>
              <time className="normal-case tracking-[0.06em]">{submittedAt}</time>
            </p>

            <h2 className="pulse-serif pulse-serif-sm pulse-balance mt-3 text-[color:var(--foreground)]">
              {title}
            </h2>
          </div>

          {mediaUrl && (
            <div className="h-[100px] w-[150px] shrink-0 overflow-hidden bg-[var(--stage-deep)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mediaUrl}
                alt={mediaAlt ?? ""}
                width={150}
                height={100}
                className="h-full w-full object-cover"
              />
            </div>
          )}
        </div>

        <div className="max-w-[70ch] text-[15px] leading-[1.6] text-[color:var(--muted-foreground)]">
          <p className="whitespace-pre-wrap break-words">{displayContent}</p>
          {isLong && (
            <button
              type="button"
              className="mt-1.5 cursor-pointer text-[13px] font-bold text-[color:var(--primary-text)] hover:underline"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? "Show less" : "Show full"}
            </button>
          )}
        </div>

        {linkUrl && linkDomain && (
          <div className="flex max-w-full items-center gap-2 text-[13px] text-[color:var(--muted-foreground)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://www.google.com/s2/favicons?domain=${linkDomain}&sz=16`}
              alt=""
              width={16}
              height={16}
              className="flex-shrink-0"
            />
            <span className="truncate">{linkUrl}</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleApprove}
            disabled={isPending}
            className="cursor-pointer rounded-[var(--radius-sm)] bg-[var(--primary-fill)] px-6 py-[9px] text-[14px] font-bold text-[color:var(--primary-foreground)] transition-opacity disabled:opacity-50"
          >
            {isPending ? "Approving…" : "Approve"}
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            disabled={isPending}
            className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--hairline)] px-6 py-[9px] text-[14px] font-bold text-[color:var(--foreground)] transition-colors hover:border-[color-mix(in_srgb,var(--primary)_45%,var(--hairline))] hover:text-[color:var(--primary-text)] disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </article>

      <RejectModal
        key={modalOpen ? "open" : "closed"}
        postId={postId}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
