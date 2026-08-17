"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { addComment } from "@/app/actions/comments";
import { PostAvatar } from "@/components/posts/_shared";
import type { CommentDto } from "@/types/comment";

const MAX_CHARS = 2000;

type Props = {
  postId: string;
  currentUserName: string;
  onOptimisticAdd: (optimistic: CommentDto) => void;
  onConfirm: (optimistic: CommentDto, confirmed: CommentDto) => void;
  onRemove: (optimistic: CommentDto) => void;
};

function SubmitButton({ empty }: { empty: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={empty || pending}
      className="min-h-[36px] rounded-[var(--radius-sm)] bg-[var(--primary-fill)] px-5 py-2 text-[14px] font-bold text-[var(--primary-foreground)] transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? "Posting…" : "Post"}
    </button>
  );
}

export function CommentComposer({
  postId,
  currentUserName,
  onOptimisticAdd,
  onConfirm,
  onRemove,
}: Props) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [content]);

  async function handleAction() {
    const trimmed = content.trim();
    if (!trimmed) return;

    setError(null);

    const optimistic: CommentDto = {
      id: `optimistic-${Date.now()}`,
      body: trimmed,
      tombstone: false,
      hiddenReason: null,
      createdAt: new Date().toISOString(),
      author: { fullName: currentUserName, entityName: null },
    };

    onOptimisticAdd(optimistic);
    setContent("");

    const result = await addComment(postId, trimmed);

    if (!result.ok) {
      onRemove(optimistic);
      setError(result.error);
      return;
    }

    onConfirm(optimistic, result.comment);
  }

  const chars = content.length;

  return (
    <div className="mb-8 flex gap-3">
      <div className="shrink-0 pt-1">
        <PostAvatar fullName={currentUserName} avatarUrl={null} size="md" />
      </div>
      <div className="min-w-0 flex-1">
        <form action={handleAction}>
          <textarea
            ref={textareaRef}
            name="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Write a comment…"
            rows={2}
            maxLength={MAX_CHARS}
            aria-label="Comment text"
            className="w-full resize-none overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[15px] leading-[1.5] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] transition-colors focus:border-[var(--primary)] focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-between gap-4">
            <span
              className={`text-[12px] tabular-nums ${
                chars > MAX_CHARS * 0.9
                  ? "text-[var(--destructive-text)]"
                  : "text-[var(--muted-foreground)]"
              }`}
            >
              {chars}/{MAX_CHARS}
            </span>
            <SubmitButton empty={!content.trim()} />
          </div>
        </form>

        {error && (
          <p role="alert" className="mt-2 text-[13px] text-[var(--destructive-text)]">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
