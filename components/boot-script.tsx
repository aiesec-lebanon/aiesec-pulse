/**
 * The pre-paint boot script: theme class and motion attribute, set on
 * <html> before the first paint so neither flashes the wrong state.
 *
 * Emitted directly by the root layout (a Server Component) rather than through
 * `useServerInsertedHTML`. That hook runs its callback on *every* flush of the
 * streaming response, so the previous ThemeScript was re-emitting its
 * `<script id="theme-init">` dozens of times in a single document — inert,
 * since it is idempotent, but real bytes on every page and duplicate element
 * ids in the DOM. Adding a second such component would have doubled it.
 *
 * One tag, emitted once, carrying both preferences. The nonce comes from
 * proxy.ts; without it the CSP blocks this outright, and neither a theme flash
 * nor a motion flash is worth `unsafe-inline`.
 */
const BOOT = `try{var d=document.documentElement,t=localStorage.getItem("theme");if(t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme:dark)").matches)){d.classList.add("dark")}d.setAttribute("data-motion",localStorage.getItem("pulse-motion")==="reduced"?"reduced":"full")}catch(e){document.documentElement.setAttribute("data-motion","full")}`;

export function BootScript({ nonce }: { nonce?: string }) {
  return <script id="pulse-boot" nonce={nonce} dangerouslySetInnerHTML={{ __html: BOOT }} />;
}
