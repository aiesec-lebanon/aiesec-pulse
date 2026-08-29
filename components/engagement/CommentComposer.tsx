"use client";

import { SendHorizonal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { addComment } from "@/app/actions/comments";
import { PostAvatar } from "@/components/posts/_shared";
import type { CommentDto } from "@/types/comment";

const MAX_CHARS = 2000;

type Props = {
  postId: string;
  currentUserName: string;
  onOptimisticAdd: (_optimistic: CommentDto) => void;
  onConfirm: (_optimistic: CommentDto, _confirmed: CommentDto) => void;
  onRemove: (_optimistic: CommentDto) => void;
};

function SubmitButton({ empty }: { empty: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={empty || pending}
      className="group/send flex min-h-[38px] items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--primary-fill)] px-5 text-[13px] font-bold text-[color:var(--primary-foreground)] transition-[opacity,transform] duration-[calc(var(--dur-micro)*var(--motion-scale))] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? "Posting…" : "Post comment"}
      <SendHorizonal
        size={14}
        strokeWidth={2.5}
        aria-hidden
        className={[
          "transition-transform duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)]",
          pending
            ? "animate-float-drift"
            : "group-hover/send:translate-x-[calc(3px*var(--motion-travel))]",
        ].join(" ")}
      />
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
            placeholder="Add a comment…"
            rows={2}
            maxLength={MAX_CHARS}
            aria-label="Comment text"
            className="w-full resize-none overflow-hidden rounded-[3px] border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-[15px] leading-[1.5] text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] transition-[border-color,box-shadow] duration-[calc(var(--dur-element)*var(--motion-scale))] focus:border-[var(--primary)] focus:shadow-[0_0_0_4px_var(--glow-primary-soft)] focus:outline-none"
          />
          <div className="mt-2.5 flex items-center justify-between gap-4">
            <span
              className={`text-[12px] tabular-nums transition-colors duration-[calc(var(--dur-micro)*var(--motion-scale))] ${
                chars > MAX_CHARS * 0.9
                  ? "text-[color:var(--destructive-text)]"
                  : "text-[color:var(--muted-foreground)]"
              }`}
            >
              {chars}/{MAX_CHARS}
            </span>
            <SubmitButton empty={!content.trim()} />
          </div>
        </form>

        {error && (
          <p role="alert" className="mt-2 text-[13px] text-[color:var(--destructive-text)]">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
