"use client";

import { useState, useTransition } from "react";
import { approvePost } from "@/app/actions/posts";
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
  linkUrl: string | null;
}

export function QueueCard({
  postId,
  authorName,
  authorEntity,
  submittedAt,
  title,
  content,
  mediaUrl,
  linkUrl,
}: QueueCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isLong = content.length > EXCERPT_LIMIT;
  const displayContent =
    !isLong || expanded ? content : content.slice(0, EXCERPT_LIMIT) + "…";

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
        className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6 flex flex-col gap-4"
      >
        {/* Author row */}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[14px] text-[var(--muted-foreground)]">
          <span className="font-medium text-[var(--foreground)]">{authorName}</span>
          {authorEntity && (
            <>
              <span aria-hidden="true">·</span>
              <span>{authorEntity}</span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <time>{submittedAt}</time>
        </div>

        {/* Title */}
        <h2 className="text-[20px] font-bold leading-tight text-[var(--foreground)]">
          {title}
        </h2>

        {/* Content excerpt */}
        <div className="text-[16px] leading-[1.6] text-[var(--foreground)]">
          <p className="whitespace-pre-wrap break-words">{displayContent}</p>
          {isLong && (
            <button
              type="button"
              className="mt-1.5 text-[var(--primary)] text-[14px] font-medium hover:underline cursor-pointer"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? "Show less" : "Show full"}
            </button>
          )}
        </div>

        {/* Thumbnail */}
        {mediaUrl && (
          <div className="overflow-hidden rounded-[var(--radius-md)] w-[240px] h-[160px] flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaUrl}
              alt=""
              width={240}
              height={160}
              className="object-cover w-full h-full"
            />
          </div>
        )}

        {/* Link preview */}
        {linkUrl && linkDomain && (
          <div className="flex items-center gap-2 text-[14px] text-[var(--muted-foreground)] max-w-full">
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

        {/* Action row */}
        <div className="flex items-center gap-3 pt-4 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={handleApprove}
            disabled={isPending}
            className="bg-[var(--primary)] text-[var(--primary-foreground)] rounded-[var(--radius-sm)] px-6 py-[9px] text-[16px] font-bold disabled:opacity-50 transition-opacity cursor-pointer"
          >
            {isPending ? "Approving…" : "Approve"}
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            disabled={isPending}
            className="border border-[var(--border)] text-[var(--foreground)] rounded-[var(--radius-sm)] px-6 py-[9px] text-[16px] font-medium hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-50 transition-colors cursor-pointer"
          >
            Reject
          </button>
        </div>
      </article>

      <RejectModal
        postId={postId}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
