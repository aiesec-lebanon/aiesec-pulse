import Link from "next/link";

export const metadata = {
  title: "Privacy notice · AIESEC Pulse",
  description: "What AIESEC Pulse collects, why, and what you can do about it.",
};

const LAST_UPDATED = "14 August 2026";

export default function PrivacyNoticePage() {
  return (
    <>
      <h1>Privacy notice</h1>
      <p className="lead">
        This explains what AIESEC Pulse collects about you, why, how long it is kept, and what you
        can ask us to do about it.
      </p>
      <p className="meta">Last updated: {LAST_UPDATED}</p>

      <h2>Who is responsible</h2>
      <p>
        AIESEC International is the data controller for AIESEC Pulse. The platform is operated by
        the Information Management portfolio. For anything in this notice, or to exercise a right
        described below, use the controls on your{" "}
        <Link href="/settings/privacy">Privacy &amp; your data</Link> page or contact your Member
        Committee&apos;s IM lead.
      </p>

      <h2>What we collect, and why</h2>

      <h3>Your identity, mirrored from AIESEC</h3>
      <p>
        When you sign in, Pulse reads your name, email address, profile photo and current positions
        from AIESEC&apos;s Global Information System (GIS) and stores a copy. We do this so the
        platform knows which entity you belong to and what you are allowed to publish or moderate.
        Pulse never edits this data — EXPA and GIS remain the source, and a correction made there
        flows through at your next sign-in.
      </p>

      <h3>What you publish</h3>
      <p>
        Posts, comments and reactions, together with the entity you published on behalf of and the
        AIESEC term in which you published. This is the organisational record the platform exists to
        keep.
      </p>

      <h3>What you read</h3>
      <p>
        Which posts you opened, roughly how far you scrolled, and roughly how long you spent.
        Publishers see this as aggregate reach and read rate for their own posts — never as a list
        of who read what. Aggregate reporting suppresses small counts so individual reading
        behaviour cannot be inferred from a dashboard.
      </p>
      <p>
        This is personal data and we are telling you about it deliberately, because the honest
        alternative to disclosure is not collecting it.
      </p>

      <h3>Your sessions</h3>
      <p>
        A session record per device, holding a description of the browser and a keyed one-way hash
        of the network address you signed in from. We store the hash rather than the address itself
        so that the record is useful for spotting suspicious access without being a directly
        identifying location trail.
      </p>

      <h3>Your AIESEC access tokens</h3>
      <p>
        Encrypted, on our servers, never in your browser. They let Pulse refresh your details from
        GIS without asking you to sign in again. Signing out everywhere discards them.
      </p>

      <h2>Why we are allowed to do this</h2>
      <ul>
        <li>
          <strong>Legitimate interest</strong> — running internal communications for a global
          organisation you are a member of. This covers your profile, your published content, and
          reach measurement.
        </li>
        <li>
          <strong>Consent</strong> — web push notifications and any non-essential analytics. You can
          withdraw consent at any time without losing access to the platform.
        </li>
      </ul>

      <h2>How long we keep it</h2>
      <table>
        <caption>Retention periods, enforced by a nightly scheduled job</caption>
        <thead>
          <tr>
            <th scope="col">Data</th>
            <th scope="col">Kept for</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Published posts and comments</td>
            <td>Indefinitely — organisational record</td>
          </tr>
          <tr>
            <td>Drafts you never published</td>
            <td>12 months after you last touched them</td>
          </tr>
          <tr>
            <td>Reading history</td>
            <td>13 months, then aggregated and deleted</td>
          </tr>
          <tr>
            <td>Notifications</td>
            <td>6 months</td>
          </tr>
          <tr>
            <td>Email delivery records</td>
            <td>12 months</td>
          </tr>
          <tr>
            <td>Sessions</td>
            <td>30 days after expiry</td>
          </tr>
          <tr>
            <td>AIESEC access tokens</td>
            <td>Until you sign out, or 90 days of inactivity</td>
          </tr>
          <tr>
            <td>Moderation and administration records</td>
            <td>7 years</td>
          </tr>
          <tr>
            <td>Reports and appeals</td>
            <td>3 years after resolution</td>
          </tr>
        </tbody>
      </table>

      <h2>Your rights</h2>
      <p>
        You can ask for access, a copy, correction, erasure, restriction, or object to processing.
        Use <Link href="/settings/privacy">Privacy &amp; your data</Link>. Export is immediate;
        everything else is handled by a person within 30 days.
      </p>
      <p>
        <strong>On erasure and our records.</strong> If you ask us to erase your data, your account
        is anonymised, your reading and engagement history is deleted, and you choose whether your
        posts and comments stay published under &ldquo;Former member&rdquo; or are removed. Records
        of moderation decisions are kept for seven years as required for accountability — but your
        identity is removed from them, replaced by an irreversible pseudonym. The events remain; you
        do not appear in them.
      </p>
      <p>
        You also have the right to complain to a supervisory authority in your country of residence.
      </p>

      <h2>Where your data is held, and who else sees it</h2>
      <p>
        Our database and file storage are hosted in the European Union. We use the following
        processors, each under a data processing agreement:
      </p>
      <ul>
        <li>Vercel — application hosting</li>
        <li>Supabase — database and file storage (EU region)</li>
        <li>Upstash — caching and rate limiting</li>
        <li>Inngest — scheduled background jobs</li>
        <li>Sentry — error reporting (pseudonymous identifier only, never your name)</li>
      </ul>
      <p>
        The current list, and what each one processes, is maintained in the platform&apos;s data
        map. AIESEC entities do not receive your data through Pulse beyond what is visible in the
        product itself.
      </p>

      <h2>Confidentiality</h2>
      <p>
        Pulse is not for confidential material. Audience targeting decides what is <em>relevant</em>{" "}
        to whom; it is not a security boundary, and you should assume anything you post can reach
        any AIESEC member. Do not put personal data about other people, commercially sensitive
        material, or anything under an obligation of confidence into a post or a comment.
      </p>

      <h2>Members under 18</h2>
      <p className="open-question">
        <strong>Open.</strong> We are confirming with AIESEC International whether members under 18
        use Pulse in any entity, and will publish the position — including any additional safeguards
        — before that is settled. If you are under 18 and using Pulse, tell your Member
        Committee&apos;s IM lead so we can account for it.
      </p>

      <h2>If something goes wrong</h2>
      <p>
        We have a documented procedure for assessing and, where required, reporting a personal data
        breach within 72 hours. If a breach affects you and is likely to present a high risk, we
        will tell you directly.
      </p>

      <h2>Changes</h2>
      <p>
        Material changes will be announced in the feed before they take effect, not applied quietly.
        The date at the top of this page always reflects the current version.
      </p>
    </>
  );
}
