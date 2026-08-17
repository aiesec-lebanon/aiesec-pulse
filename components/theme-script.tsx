"use client";

// The nonce comes from proxy.ts. Without it this script is blocked outright —
// the CSP carries no `unsafe-inline`, and a theme flash is not worth weakening it.
import { useServerInsertedHTML } from "next/navigation";

const SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme:dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}`;

export function ThemeScript({ nonce }: { nonce?: string }) {
  useServerInsertedHTML(() => (
    <script id="theme-init" nonce={nonce} dangerouslySetInnerHTML={{ __html: SCRIPT }} />
  ));
  return null;
}
