import Link from "next/link";

import { DisplayTitle } from "@/components/ui/DisplayTitle";
import { COOKIE_NOTICE_STORAGE_KEY, COOKIE_POLICY_UPDATED } from "@/lib/cookie-policy";

export const metadata = {
  title: "Cookie policy · AIESEC Pulse",
  description: "Every cookie and browser-storage item AIESEC Pulse sets, and why.",
};

type StorageItem = { name: string; purpose: string; lifetime: string };

// Must stay exhaustive and match the code. Changing it means bumping
// COOKIE_POLICY_UPDATED, which re-shows the notice to everyone.
const COOKIES: StorageItem[] = [
  {
    name: "pulse_session",
    purpose:
      "Keeps you signed in. Contains a signed reference to your session record — no personal data and no AIESEC credentials.",
    lifetime: "30 days, extended while you use the platform",
  },
  {
    name: "pulse_oauth_state",
    purpose:
      "Ties your sign-in attempt to your browser, so an attacker cannot complete a sign-in on your behalf.",
    lifetime: "10 minutes",
  },
  {
    name: "pulse_oauth_verifier",
    purpose: "Additional sign-in protection, when the AIESEC authorisation server supports it.",
    lifetime: "10 minutes",
  },
  {
    name: "pulse_oauth_return_to",
    purpose: "Remembers the page you were heading to before signing in.",
    lifetime: "10 minutes",
  },
  {
    name: "pulse_feed_mode",
    purpose:
      "Remembers whether you chose Latest or For You on the feed. Set only when you switch views.",
    lifetime: "1 year",
  },
  {
    name: "pulse_admin_session",
    purpose:
      "Keeps the platform administrator signed in to the administration console. Never set for members.",
    lifetime: "12 hours",
  },
];

const BROWSER_STORAGE: StorageItem[] = [
  {
    name: "theme",
    purpose:
      "Remembers whether you chose light or dark, so the page does not flash the wrong one while loading. Set only if you pick one; otherwise Pulse follows your device.",
    lifetime: "Until you clear your browser storage",
  },
  {
    name: "pulse-motion",
    purpose:
      "Remembers whether you chose full or reduced motion. Set only if you pick one; otherwise Pulse follows your device.",
    lifetime: "Until you clear your browser storage",
  },
  {
    name: COOKIE_NOTICE_STORAGE_KEY,
    purpose:
      "Remembers that you have seen the cookie notice, so it is not shown again until this policy changes.",
    lifetime: "Until you clear your browser storage",
  },
];

function StorageTable({ caption, items }: { caption: string; items: StorageItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Purpose</th>
            <th scope="col">Lifetime</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.name}>
              <td>
                <code>{item.name}</code>
              </td>
              <td>{item.purpose}</td>
              <td>{item.lifetime}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const LINK_CLASS =
  "pulse-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]";

export default function CookiesPage() {
  return (
    <>
      <DisplayTitle as="h1" size="lg" title="Cookie policy" />
      <p className="lead">
        Pulse sets no advertising cookies, no analytics cookies, and nothing that follows you to
        other sites. Everything below either keeps the platform working or remembers a choice you
        made here.
      </p>
      <p className="pulse-label">Last updated: {COOKIE_POLICY_UPDATED}</p>

      <h2>Cookies</h2>
      <p>
        Small pieces of data your browser sends back to Pulse with each request. Every one is
        first-party, same-site and marked <code>HttpOnly</code>, so scripts on the page cannot read
        them.
      </p>
      <StorageTable caption="Cookies set by AIESEC Pulse" items={COOKIES} />

      <h2>Browser storage</h2>
      <p>
        Preferences kept in your browser&apos;s local storage. They never leave your device — Pulse
        does not send them to its servers.
      </p>
      <StorageTable caption="Local storage used by AIESEC Pulse" items={BROWSER_STORAGE} />

      <h2>What we do not set</h2>
      <ul>
        <li>No advertising or retargeting cookies. Pulse carries no advertising.</li>
        <li>No analytics cookies, first- or third-party.</li>
        <li>No cookies from other companies, and no cross-site tracking.</li>
      </ul>

      <h2>Why we do not ask for consent</h2>
      <p>
        Consent is required for storage that is not needed to provide the service you asked for.
        Everything listed above is either needed for Pulse to work or stores a choice you made
        yourself, so there is nothing to opt in to or out of. The notice you see on your first visit
        is there to tell you this, not to ask.
      </p>
      <p>
        If Pulse ever adds something that does need consent — optional analytics, for example — it
        will be listed here first, and you will be asked before it is set.
      </p>

      <h2>Controlling cookies</h2>
      <p>
        You can clear or block cookies in your browser, but blocking <code>pulse_session</code> will
        sign you out and prevent you signing back in. Clearing browser storage resets your theme and
        motion choices and shows the cookie notice again. To end all your sessions deliberately, use{" "}
        <Link href="/settings/privacy" className={LINK_CLASS}>
          Privacy &amp; your data
        </Link>
        .
      </p>

      <h2>Changes to this policy</h2>
      <p>
        When anything in the lists above changes, the date at the top of this page changes with it,
        and the cookie notice is shown again so you hear about it.
      </p>

      <p>
        See the{" "}
        <Link href="/legal/privacy" className={LINK_CLASS}>
          privacy notice
        </Link>{" "}
        for what we do with data once you are signed in.
      </p>
    </>
  );
}
