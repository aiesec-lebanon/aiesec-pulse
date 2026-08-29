import Link from "next/link";

import { DisplayTitle } from "@/components/ui/DisplayTitle";

export const metadata = {
  title: "Cookies · AIESEC Pulse",
  description: "Every cookie AIESEC Pulse sets, and why.",
};

// The table must stay exhaustive and match the code.
export default function CookiesPage() {
  return (
    <>
      <DisplayTitle as="h1" size="lg" title="Cookies" />
      <p className="lead">
        Pulse sets no advertising cookies, no third-party cookies, and no cross-site trackers. There
        is no consent banner because there is nothing here that needs consent — every item below is
        required for the platform to work.
      </p>

      <h2>What we set</h2>
      <table>
        <caption>Cookies and local storage used by AIESEC Pulse</caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Purpose</th>
            <th scope="col">Lifetime</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>pulse_session</code>
            </td>
            <td>
              Keeps you signed in. Contains a signed reference to your session record — no personal
              data and no AIESEC credentials.
            </td>
            <td>30 days, extended while you use the platform</td>
          </tr>
          <tr>
            <td>
              <code>pulse_oauth_state</code>
            </td>
            <td>
              Ties your sign-in attempt to your browser, so an attacker cannot complete a sign-in on
              your behalf.
            </td>
            <td>10 minutes</td>
          </tr>
          <tr>
            <td>
              <code>pulse_oauth_verifier</code>
            </td>
            <td>
              Additional sign-in protection, when the AIESEC authorisation server supports it.
            </td>
            <td>10 minutes</td>
          </tr>
          <tr>
            <td>
              <code>pulse_oauth_return_to</code>
            </td>
            <td>Remembers the page you were heading to before signing in.</td>
            <td>10 minutes</td>
          </tr>
          <tr>
            <td>
              <code>theme</code> (local storage)
            </td>
            <td>
              Remembers whether you chose light or dark, so the page does not flash the wrong one
              while loading.
            </td>
            <td>Until you clear your browser storage</td>
          </tr>
        </tbody>
      </table>

      <h2>What we do not set</h2>
      <ul>
        <li>No advertising or retargeting cookies. Pulse carries no advertising.</li>
        <li>No third-party analytics cookies.</li>
        <li>
          No cross-site tracking. Cookies are same-site and marked <code>HttpOnly</code>.
        </li>
      </ul>

      <h2>Controlling cookies</h2>
      <p>
        You can clear or block cookies in your browser, but blocking <code>pulse_session</code> will
        sign you out and prevent you signing back in. To end all your sessions deliberately, use{" "}
        <Link
          href="/settings/privacy"
          className="pulse-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
        >
          Privacy &amp; your data
        </Link>
        .
      </p>

      <p>
        See the{" "}
        <Link
          href="/legal/privacy"
          className="pulse-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
        >
          privacy notice
        </Link>{" "}
        for what we do with data once you are signed in.
      </p>
    </>
  );
}
