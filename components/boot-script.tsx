/**
 * Sets theme + motion on <html> pre-paint to avoid a flash. Emitted by the
 * root layout directly, not useServerInsertedHTML, which re-emits on every
 * stream flush and duplicated this script many times over.
 *
 * Nonce (proxy.ts) is required — CSP blocks this without it. Stored choice
 * wins over OS setting; motion defaults to prefers-reduced-motion since
 * there's no standalone Motion toggle, but an explicit opt-in still beats
 * the OS, so "full" is written rather than just cleared.
 */
const BOOT = `try{var d=document.documentElement,t=localStorage.getItem("theme");if(t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme:dark)").matches)){d.classList.add("dark")}var m=localStorage.getItem("pulse-motion");d.setAttribute("data-motion",(m==="reduced"||(m!=="full"&&window.matchMedia("(prefers-reduced-motion:reduce)").matches))?"reduced":"full")}catch(e){document.documentElement.setAttribute("data-motion","full")}`;

export function BootScript({ nonce }: { nonce?: string }) {
  return (
    <script
      id="pulse-boot"
      nonce={nonce}
      // Browsers blank the nonce attribute right after parsing (anti-exfil
      // spec behavior), so React's hydration check sees a false mismatch —
      // suppressed the same way as the data-motion divergence in layout.tsx.
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: BOOT }}
    />
  );
}
