"use client";

import { useEffect, useRef } from "react";

import { motionEnabled } from "@/components/motion/motion-context";

/**
 * The network, drawn.
 *
 * A point cloud distributed evenly over a sphere (Fibonacci lattice), rotated
 * in three dimensions and projected to 2-D with real perspective divide, with
 * chords drawn between points that are close in 3-D space. It is the product's
 * own thesis as an image: ~110 member committees on one globe, connected, with
 * the near face lit and the far face receding.
 *
 * Deliberately 2-D canvas rather than WebGL: a few hundred projected points
 * cost far less than a GL context for the same read. The projection maths is the 3-D part; the renderer is not.
 *
 * Behaviour under the motion preference: Reduced draws exactly one frame and
 * stops. The image stays — it is composition, not decoration — but nothing
 * moves. Off-screen, the loop is cancelled outright rather than throttled.
 */

type Point = { x: number; y: number; z: number };

const ROTATION_PER_MS = 0.000045;

function fibonacciSphere(count: number): Point[] {
  const points: Point[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    points.push({ x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius });
  }
  return points;
}

function readToken(el: HTMLElement, name: string, fallback: string): string {
  const value = getComputedStyle(el).getPropertyValue(name).trim();
  return value || fallback;
}

export function NetworkField({
  className,
  density = 260,
  /** 0–1. How strongly the sphere reads against its ground. */
  intensity = 1,
}: {
  className?: string;
  density?: number;
  intensity?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    // A phone painting 260 projected points every frame spends its budget on
    // the background instead of the feed. Scale the cloud to the device.
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const count = Math.round(coarse ? density * 0.45 : density);
    const points = fibonacciSphere(count);

    // Sampled once rather than per frame: getComputedStyle in a rAF loop is
    // a layout read on every tick.
    const primary = readToken(canvas, "--primary", "#037ef3");
    const success = readToken(canvas, "--success", "#0cb9c1");
    // The same alphas that read as a lit constellation on the dark stage
    // disappear on a near-white one, so the ink is scaled per theme. Re-read
    // on the theme change event rather than per frame.
    let ink = document.documentElement.classList.contains("dark") ? 1 : 1.7;

    let width = 0;
    let height = 0;
    let radius = 0;
    let frame = 0;
    let visible = false;
    let last = 0;
    let angleY = 0;
    let angleX = 0.42;

    function resize() {
      if (!canvas || !context) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      radius = Math.min(width, height) * 0.42;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw() {
      if (!context) return;
      context.clearRect(0, 0, width, height);
      if (radius <= 0) return;

      const cx = width / 2;
      const cy = height / 2;
      const cosY = Math.cos(angleY);
      const sinY = Math.sin(angleY);
      const cosX = Math.cos(angleX);
      const sinX = Math.sin(angleX);

      const projected: Array<{ x: number; y: number; depth: number; r: number }> = [];

      for (const point of points) {
        // Yaw, then pitch.
        const x1 = point.x * cosY - point.z * sinY;
        const z1 = point.x * sinY + point.z * cosY;
        const y2 = point.y * cosX - z1 * sinX;
        const z2 = point.y * sinX + z1 * cosX;

        // Perspective divide — the reason the near face reads larger and the
        // far face collapses toward the centre.
        const perspective = 2.4 / (2.4 + z2);
        projected.push({
          x: cx + x1 * radius * perspective,
          y: cy + y2 * radius * perspective,
          depth: (z2 + 1) / 2,
          r: perspective,
        });
      }

      // Chords first, so nodes sit on top of their own connections. The pair
      // scan is O(n²), so both axes are rejected on a bare subtraction before
      // any square root runs — that bounding-box test throws out the large
      // majority of pairs and is what keeps this inside a frame budget.
      const maxChord = radius * 0.3;
      const maxChordSq = maxChord * maxChord;
      context.lineWidth = 0.6;
      for (let i = 0; i < projected.length; i++) {
        const a = projected[i];
        if (a.depth < 0.35) continue;
        for (let j = i + 1; j < projected.length; j++) {
          const b = projected[j];
          if (b.depth < 0.35) continue;
          const dx = a.x - b.x;
          if (dx > maxChord || dx < -maxChord) continue;
          const dy = a.y - b.y;
          if (dy > maxChord || dy < -maxChord) continue;
          const distanceSq = dx * dx + dy * dy;
          if (distanceSq > maxChordSq) continue;
          const alpha = (1 - Math.sqrt(distanceSq) / maxChord) * 0.3 * a.depth * intensity * ink;
          context.strokeStyle = primary;
          context.globalAlpha = alpha;
          context.beginPath();
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.stroke();
        }
      }

      for (const p of projected) {
        // Depth drives size, opacity and hue together — one cue read three
        // ways is what makes a flat canvas look volumetric.
        context.globalAlpha = Math.min(1, (0.12 + p.depth * 0.75) * intensity * ink);
        context.fillStyle = p.depth > 0.82 ? success : primary;
        context.beginPath();
        context.arc(p.x, p.y, Math.max(0.4, p.r * (0.5 + p.depth * 1.7)), 0, Math.PI * 2);
        context.fill();
      }

      context.globalAlpha = 1;
    }

    function loop(now: number) {
      const delta = last === 0 ? 16 : Math.min(now - last, 50);
      last = now;
      angleY += delta * ROTATION_PER_MS * Math.PI;
      angleX = 0.42 + Math.sin(now * 0.00008) * 0.18;
      draw();
      frame = requestAnimationFrame(loop);
    }

    function start() {
      if (frame) return;
      if (!motionEnabled()) {
        draw();
        return;
      }
      last = 0;
      frame = requestAnimationFrame(loop);
    }

    function stop() {
      if (!frame) return;
      cancelAnimationFrame(frame);
      frame = 0;
    }

    resize();
    draw();

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    });
    observer.observe(canvas);

    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (!frame) draw();
    });
    resizeObserver.observe(canvas);

    // The preference can flip mid-session from the header control; the loop
    // has to notice without a remount.
    function onThemeChange() {
      ink = document.documentElement.classList.contains("dark") ? 1 : 1.7;
      if (!frame) draw();
    }
    const themeObserver = new MutationObserver(onThemeChange);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    function onMotionChange() {
      stop();
      if (visible) start();
      else draw();
    }
    window.addEventListener("pulse:motion-change", onMotionChange);

    // A backgrounded tab keeps firing rAF in some engines; stop paying for it.
    function onVisibility() {
      if (document.hidden) stop();
      else if (visible) start();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      observer.disconnect();
      resizeObserver.disconnect();
      themeObserver.disconnect();
      window.removeEventListener("pulse:motion-change", onMotionChange);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [density, intensity]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={["pointer-events-none block h-full w-full", className].filter(Boolean).join(" ")}
    />
  );
}
