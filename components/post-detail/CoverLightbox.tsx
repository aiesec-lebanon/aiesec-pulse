"use client";

import { Maximize2, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Transparent button overlaid on the cover image, not wrapped around it —
 * the hero's clip-path/parallax layers would clip or transform a wrapper.
 * Dialog follows the same a11y contract as ReasonModal (role="dialog",
 * focus management, Escape/backdrop close, Tab trap, scroll lock), and is
 * portalled to `document.body` since the clip-path/overflow-hidden
 * ancestors here would clip a `position: fixed` dialog rendered in place.
 */
export function CoverLightbox({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      // Two focusable elements at most, so the trap is the simple form: keep
      // focus on the close control whichever direction Tab travels.
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>("button");
      if (focusable.length === 0) return;
      event.preventDefault();
      focusable[0].focus();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={[
          "pulse-zoomable group absolute inset-0 z-[3] focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[var(--primary)]",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span className="sr-only">View the cover image at full size</span>
        <span
          aria-hidden
          className="pulse-zoom-hint pulse-label absolute bottom-4 right-4 flex items-center gap-2 rounded-[3px] bg-[color-mix(in_srgb,var(--ink)_72%,transparent)] px-2.5 py-1.5 text-white/90 backdrop-blur-sm"
        >
          <Maximize2 size={12} strokeWidth={2.5} />
          View
        </span>
      </button>

      {open &&
        createPortal(
          <div
            className="pulse-lightbox fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-10"
            role="presentation"
            onClick={(event) => {
              if (event.target === event.currentTarget) setOpen(false);
            }}
          >
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label={alt || "Cover image"}
              className="pulse-lightbox-figure relative flex max-h-full w-full max-w-[1200px] flex-col items-center gap-4"
            >
              <Image
                src={src}
                alt={alt}
                width={1600}
                height={1067}
                sizes="100vw"
                className="h-auto max-h-[76vh] w-auto max-w-full object-contain"
              />

              {alt && (
                <p className="max-w-[70ch] text-center text-[14px] leading-[1.5] text-white/70">
                  {alt}
                </p>
              )}

              <button
                ref={closeRef}
                type="button"
                onClick={() => {
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                className="pulse-label absolute -top-1 right-0 flex min-h-[44px] items-center gap-2 rounded-[3px] px-3 text-white/80 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] sm:-top-12"
              >
                <X size={16} strokeWidth={2.5} aria-hidden />
                Close
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
