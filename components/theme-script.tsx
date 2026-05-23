"use client";

// useServerInsertedHTML injects this during SSR streaming — the callback runs
// only on the server and the resulting HTML is sent as raw bytes, never
// processed by React's virtual DOM. On the client the hook is a no-op, so
// React never "sees" the <script> tag and emits no React 19 script warning.
import { useServerInsertedHTML } from "next/navigation";

const SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme:dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}`;

export function ThemeScript() {
  useServerInsertedHTML(() => (
    <script
      id="theme-init"
      dangerouslySetInnerHTML={{ __html: SCRIPT }}
    />
  ));
  return null;
}
