"use client";

import { Maximize2, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * The cover photograph, openable.
 *
 * A story's cover is cropped hard by the hero — an angled clip on wide
 * viewports, a 16:9 band on narrow ones — so a reader wanting to actually
 * *look* at the photograph currently can't. This makes the frame a control
 * that opens it at full size, crop removed.
 *
 * It renders as a transparent button laid over the image rather than wrapping
 * it: the hero's cover lives inside a `clip-path` container with a parallax
 * layer inside that, and wrapping either would clip the control or hand it a
 * transform. The hint mark in the corner is the affordance — `cursor:
 * zoom-in` is invisible on touch and to anyone not already moving their
 * pointer.
 *
 * Dialog mechanics follow §9.4 exactly, the same contract `ReasonModal`
 * already meets: `role="dialog"` + `aria-modal`, focus moved to the close
 * control on open and returned to the trigger on close, Escape closes,
 * backdrop click closes, Tab is trapped, and the page behind it does not
 * scroll.
 *
 * The dialog is **portalled to `document.body`**, and has to be: the trigger
 * sits inside the hero's `clip-path` container on wide viewports and an
 * `overflow: hidden` media frame on narrow ones. Both clip their descendants,
 * `position: fixed` included, so a dialog rendered in place would open as an
 * angled sliver of itself. It renders only while `open` — necessarily after
 * mount — so there's no server-render branch to guard.
 */
export function CoverLightbox({
  src,
  alt,
  /** Extra classes for the overlay button — usually a rounding to match its frame. */
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
