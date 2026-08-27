"use client";

import { Check, Pencil, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { updateOwnBio } from "@/app/actions/profile";

const MAX_CHARS = 280;

/**
 * The member's own standfirst, edited where it is read.
 *
 * Editing in place rather than on a settings page, because this is one field
 * and the whole point of it is how it looks in the hero — a separate form would
 * make the author write blind and then navigate to check. The read state is the
 * hero's own standfirst; the edit state is the same measure and the same type,
 * so what they are typing into is the thing they are making.
 *
 * The empty state is a real invitation rather than a blank space. A profile with
 * no bio is the common case, and a hero that simply omits the line gives the
 * member no reason to believe a line is available.
 */
export function BioEditor({ initialBio }: { initialBio: string | null }) {
  const [bio, setBio] = useState(initialBio ?? "");
  const [saved, setSaved] = useState(initialBio);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!editing) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [bio, editing]);

  function cancel() {
    setBio(saved ?? "");
    setError(null);
    setEditing(false);
    triggerRef.current?.focus();
  }

  async function save() {
    setPending(true);
    setError(null);
    const result = await updateOwnBio({ bio });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(result.bio);
    setBio(result.bio ?? "");
    setEditing(false);
    triggerRef.current?.focus();
  }

  if (!editing) {
    return (
      <div className="mt-6 max-w-[46ch]">
        {saved ? (
          <p className="whitespace-pre-line text-[17px] leading-[1.62] text-[color:var(--muted-foreground)]">
            {saved}
          </p>
        ) : (
          <p className="text-[17px] leading-[1.62] text-[color:var(--muted-foreground)]">
            No bio yet — a sentence or two about what you write about.
          </p>
        )}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setEditing(true)}
          className="pulse-label pulse-underline group/bio mt-3 inline-flex min-h-[36px] items-center gap-2 rounded-[var(--radius-sm)] text-[color:var(--primary-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
        >
          <Pencil
            size={12}
            strokeWidth={2.5}
            aria-hidden
            className="transition-transform duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)] group-hover/bio:-rotate-12"
          />
          {saved ? "Edit bio" : "Add a bio"}
        </button>
        <span aria-live="polite" className="sr-only">
          {pending ? "Saving your bio" : ""}
        </span>
      </div>
    );
  }

  return (
    <div className="mt-6 max-w-[46ch]">
      <label htmlFor="profile-bio" className="pulse-label pulse-label-wide mb-2 block">
        Your bio
      </label>
      <textarea
        ref={textareaRef}
        id="profile-bio"
        value={bio}
        maxLength={MAX_CHARS}
        rows={2}
        onChange={(event) => setBio(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            cancel();
          }
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void save();
          }
        }}
        placeholder="What you write about, and where you write it from."
        className="w-full resize-none overflow-hidden rounded-[3px] border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-[17px] leading-[1.62] text-[color:var(--foreground)] transition-[border-color,box-shadow] duration-[calc(var(--dur-element)*var(--motion-scale))] placeholder:text-[color:var(--muted-foreground)] focus:border-[var(--primary)] focus:shadow-[0_0_0_4px_var(--glow-primary-soft)] focus:outline-none"
      />
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
        <span
          className={`text-[12px] tabular-nums ${
            bio.length > MAX_CHARS * 0.9
              ? "text-[color:var(--destructive-text)]"
              : "text-[color:var(--muted-foreground)]"
          }`}
        >
          {bio.length}/{MAX_CHARS}
        </span>
        <span className="flex items-center gap-2">
          <button
            type="button"
            onClick={cancel}
            className="pulse-label inline-flex min-h-[36px] items-center gap-1.5 rounded-[3px] px-3 text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          >
            <X size={13} strokeWidth={2.5} aria-hidden />
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={pending}
            className="pulse-label inline-flex min-h-[36px] items-center gap-1.5 rounded-[3px] bg-[var(--primary-fill)] px-4 text-[color:var(--primary-foreground)] transition-[opacity,transform] duration-[calc(var(--dur-micro)*var(--motion-scale))] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] active:scale-[0.97] disabled:opacity-50"
          >
            <Check size={13} strokeWidth={2.5} aria-hidden />
            {pending ? "Saving…" : "Save"}
          </button>
        </span>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-[color:var(--destructive-text)]">
          {error}
        </p>
      )}
    </div>
  );
}
