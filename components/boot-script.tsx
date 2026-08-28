/**
 * The pre-paint boot script: theme class and motion attribute, set on
 * <html> before the first paint so neither flashes the wrong state.
 *
 * Emitted directly by the root layout (a Server Component) rather than
 * through `useServerInsertedHTML`, which runs its callback on every flush of
 * the streaming response — the previous script was re-emitting its
 * `<script id="theme-init">` dozens of times in a single document: inert,
 * since idempotent, but real bytes on every page and duplicate element ids
 * in the DOM.
 *
 * The nonce comes from proxy.ts; without it the CSP blocks this outright,
 * and neither a theme flash nor a motion flash is worth `unsafe-inline`.
 *
 * Both preferences resolve the same way — an explicit stored choice first,
 * the OS setting second. For motion, `prefers-reduced-motion` has to be
 * honoured by default since the header no longer carries a standalone Motion
 * button — a reader who set it years ago must not get the full cinematic
 * treatment with no way to have asked otherwise. An explicit choice (the
 * account menu, or the sign-in page) still wins over the OS in both
 * directions, which is why "full" is *written* rather than removed on
 * opt-in.
 */
const BOOT = `try{var d=document.documentElement,t=localStorage.getItem("theme");if(t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme:dark)").matches)){d.classList.add("dark")}var m=localStorage.getItem("pulse-motion");d.setAttribute("data-motion",(m==="reduced"||(m!=="full"&&window.matchMedia("(prefers-reduced-motion:reduce)").matches))?"reduced":"full")}catch(e){document.documentElement.setAttribute("data-motion","full")}`;

export function BootScript({ nonce }: { nonce?: string }) {
  return (
    <script
      id="pulse-boot"
      nonce={nonce}
      // Browsers blank the `nonce` content attribute right after parsing it (a
      // deliberate anti-exfiltration measure — see
      // https://html.spec.whatwg.org/multipage/urls-and-fetching.html#cryptographic-nonces),
      // so the DOM reads back `nonce=""` even though the real nonce was applied
      // for CSP purposes during the initial parse. React's hydration check
      // compares against that already-blanked attribute and flags a mismatch
      // that isn't one; suppress it the same way the `data-motion` divergence
      // on <html> is suppressed in app/layout.tsx.
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: BOOT }}
    />
  );
}
