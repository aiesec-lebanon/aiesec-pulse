"use client";

import { useEffect, useRef } from "react";

import { motionEnabled } from "@/components/motion/motion-context";

/**
 * Scroll-driven parallax.
 *
 * One shared scroll listener per mounted layer would be wasteful, so every
 * layer registers with a single module-level rAF loop instead. The loop only
 * runs while at least one layer is registered *and* that layer is on screen,
 * and it writes a CSS custom property rather than a transform — the actual
 * translate lives in `.pulse-parallax`, which multiplies by `--motion-travel`
 * so Reduced motion flattens every layer without this file knowing.
 */

type Layer = {
  el: HTMLElement;
  depth: number;
  visible: boolean;
};

const layers = new Set<Layer>();
let frame = 0;

function tick() {
  frame = 0;
  const viewportH = window.innerHeight;

  for (const layer of layers) {
    if (!layer.visible) continue;
    const rect = layer.el.getBoundingClientRect();
    // -1 when the element's centre sits a full viewport below the fold,
    // 0 when it is centred, +1 when it has travelled a viewport above.
    const centre = rect.top + rect.height / 2;
    const progress = (viewportH / 2 - centre) / (viewportH / 2 + rect.height / 2);
    layer.el.style.setProperty("--parallax", clamp(progress, -1, 1).toFixed(4));
  }

  if (hasVisibleLayer()) schedule();
}

function hasVisibleLayer(): boolean {
  for (const layer of layers) if (layer.visible) return true;
  return false;
}

function schedule() {
  if (frame) return;
  frame = requestAnimationFrame(tick);
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

type ParallaxProps = {
  children: React.ReactNode;
  /** Travel in px across the full scroll range. Negative moves against scroll. */
  depth?: number;
  /** Oversize the layer so its travel never exposes an edge. */
  scale?: number;
  className?: string;
};

export function Parallax({ children, depth = 40, scale = 1, className }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const layer: Layer = { el, depth, visible: false };
    layers.add(layer);

    // Visibility gates the loop: a feed with a dozen parallax layers should
    // cost one rAF for the two on screen, not twelve.
    const observer = new IntersectionObserver(
      ([entry]) => {
        layer.visible = entry.isIntersecting;
        if (layer.visible) schedule();
      },
      { rootMargin: "20% 0px" }
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      layers.delete(layer);
      if (layers.size === 0 && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };
  }, [depth]);

  return (
    <div
      ref={ref}
      className={["pulse-parallax", className].filter(Boolean).join(" ")}
      style={
        {
          "--parallax-depth": `${depth}px`,
          "--parallax-scale": scale,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}

/**
 * Pointer-driven 3-D tilt. Writes rotation and pointer position as custom
 * properties consumed by `.pulse-tilt` / `.pulse-tilt-sheen`; the transform
 * itself is multiplied by `--motion-travel`, so Reduced motion leaves the
 * plate flat while the listeners simply write values nothing reads.
 *
 * Pointer-type gated: a coarse pointer has no hover, so a touch drag must not
 * leave a card stuck at an angle.
 */
export function Tilt({
  children,
  max = 6,
  lift = 14,
  sheen = true,
  className,
}: {
  children: React.ReactNode;
  /** Maximum rotation in degrees on either axis. */
  max?: number;
  /** How far the plate rises toward the viewer, in px. */
  lift?: number;
  sheen?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function reset() {
      const node = ref.current;
      if (!node) return;
      node.style.setProperty("--tilt-x", "0deg");
      node.style.setProperty("--tilt-y", "0deg");
      node.style.setProperty("--tilt-z", "0px");
      node.style.setProperty("--sheen-opacity", "0");
    }

    function onPointerMove(event: PointerEvent) {
      const node = ref.current;
      if (!node || event.pointerType !== "mouse" || !motionEnabled()) return;

      const rect = node.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;

      node.style.setProperty("--tilt-x", `${(0.5 - py) * max * 2}deg`);
      node.style.setProperty("--tilt-y", `${(px - 0.5) * max * 2}deg`);
      node.style.setProperty("--tilt-z", `${lift}px`);
      node.style.setProperty("--pointer-x", `${px * 100}%`);
      node.style.setProperty("--pointer-y", `${py * 100}%`);
      node.style.setProperty("--sheen-opacity", sheen ? "1" : "0");
    }

    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerleave", reset);
    el.addEventListener("pointercancel", reset);
    // A card tilted by the mouse must flatten when a keyboard user tabs to it,
    // otherwise focus lands on a plate at a random angle.
    el.addEventListener("focusin", reset);

    return () => {
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerleave", reset);
      el.removeEventListener("pointercancel", reset);
      el.removeEventListener("focusin", reset);
    };
  }, [max, lift, sheen]);

  return (
    // The className lands on the perspective scene, not the tilting plate:
    // callers size the scene (`h-full` in a card grid), and the plate must
    // fill it, or the tilt wrappers swallow the height and a row of cards
    // renders at three different heights.
    <div className={["pulse-tilt-scene", className].filter(Boolean).join(" ")}>
      <div ref={ref} className="pulse-tilt h-full">
        {children}
        {sheen && <span aria-hidden className="pulse-tilt-sheen" />}
      </div>
    </div>
  );
}
