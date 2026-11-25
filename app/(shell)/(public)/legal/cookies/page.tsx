import Link from "next/link";

import { DisplayTitle } from "@/components/ui/DisplayTitle";
import {
  BROWSER_STORAGE,
  COOKIE_NAMES,
  COOKIE_POLICY_UPDATED,
  COOKIES,
  type StorageItem,
} from "@/lib/cookie-policy";

export const metadata = {
  title: "Cookie policy · AIESEC Pulse",
  description: "Every cookie and browser-storage item AIESEC Pulse sets, and why.",
};

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
            <th scope="col">Category</th>
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
              <td>Strictly necessary</td>
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
        AIESEC in Lebanon uses only strictly necessary cookies and browser storage on AIESEC Pulse:
        to keep you signed in, protect the platform and remember your settings. Pulse sets no
        analytics, advertising or marketing cookies, and nothing that follows you to other sites.
      </p>
      <p className="pulse-label">Last updated: {COOKIE_POLICY_UPDATED}</p>

      <h2>Cookies</h2>
      <p>
        Small pieces of data your browser sends back to Pulse with each request. Every one is
        first-party and same-site. All except <code>{COOKIE_NAMES.consent}</code> are marked{" "}
        <code>HttpOnly</code>, so scripts on the page cannot read them; the cookie choice has to be
        readable by the banner that shows it.
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
        <li>No performance or analytics cookies, first- or third-party.</li>
        <li>No advertising, retargeting or other marketing cookies.</li>
        <li>No cookies from other companies, and no cross-site tracking.</li>
      </ul>

      <h2>Your choice</h2>
      <p>
        On your first visit a banner offers <strong>Allow all</strong>, <strong>Reject all</strong>{" "}
        and <strong>Learn more / choose preferences</strong>. Every AIESEC in Lebanon platform uses
        the same banner. On Pulse the performance and marketing categories are not used, so your
        choice does not switch anything on: everything listed above is strictly necessary and is set
        whatever you choose. Your choice is kept for six months, or until this policy changes, and
        then you are asked again. Change it at any time with the <strong>Cookies</strong> button at
        the bottom of every page.
      </p>

      <h2>Controlling cookies</h2>
      <p>
        You can clear or block cookies in your browser, but blocking{" "}
        <code>{COOKIE_NAMES.session}</code> will sign you out and prevent you signing back in.
        Clearing browser storage resets your theme and motion choices. To end all your sessions
        deliberately, use{" "}
        <Link href="/settings/privacy" className={LINK_CLASS}>
          Privacy &amp; your data
        </Link>
        .
      </p>

      <h2>Changes to this policy</h2>
      <p>
        When anything in the lists above changes, the date at the top of this page changes with it,
        and the cookie banner is shown again so you hear about it.
      </p>

      <p>
        See the{" "}
        <Link href="/legal/privacy" className={LINK_CLASS}>
          privacy notice
        </Link>{" "}
        for what we do with your data once you are signed in.
      </p>
    </>
  );
}
