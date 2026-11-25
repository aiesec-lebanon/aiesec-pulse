import Link from "next/link";

import { PrivacyContactForm } from "@/components/legal/PrivacyContactForm";
import { DisplayTitle } from "@/components/ui/DisplayTitle";

export const metadata = {
  title: "Privacy notice · AIESEC Pulse",
  description: "What AIESEC Pulse collects, why, and what you can do about it.",
};

// Derived from Annex C of the AIESEC in Lebanon Privacy and Cookie Policy;
// change both together.
const LAST_UPDATED = "25 November 2026";

const LINK_CLASS =
  "pulse-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]";

const RETENTION: Array<[string, string]> = [
  ["Published posts and comments", "Kept as the organisation's record until removed or erased"],
  ["Drafts you never published", "Deleted 12 months after you last edited them"],
  ["Earlier versions of a post", "The latest 50 per post"],
  ["Comments you delete", "Text removed after 30 days"],
  ["Images", "Deleted within two days once no post uses them"],
  ["Notifications", "6 months"],
  ["Email delivery records", "12 months"],
  [
    "Sign-in sessions",
    "End after 7 days without use, and always after 30 days; deleted 30 days after they end",
  ],
  [
    "Your AIESEC sign-in tokens",
    "Deleted when you sign out everywhere, or after 90 days without use",
  ],
  ["Records of refused sign-ins", "90 days, holding a keyed reference instead of your EXPA ID"],
  [
    "Audit events",
    "24 months; the network-address hash and browser details are removed after 90 days",
  ],
  ["Synchronisation records", "90 days"],
  ["Reports and appeals", "3 years after they are resolved"],
  [
    "Privacy requests and messages to the privacy team",
    "3 years after they are closed; the email you gave for our reply is removed on closure",
  ],
  [
    "Your account",
    "Anonymised 24 months after your last activity, or 12 months after your last AIESEC position ends if you have not used Pulse since",
  ],
];

export default function PrivacyNoticePage() {
  return (
    <>
      <DisplayTitle as="h1" size="lg" title="Privacy notice" />
      <p className="lead">
        This explains what AIESEC Pulse collects about you, why, how long it is kept, and what you
        can ask us to do about it.
      </p>
      <p className="pulse-label">Last updated: {LAST_UPDATED}</p>

      <h2>Who is responsible</h2>
      <p>
        <strong>AIESEC in Lebanon</strong> builds, hosts and runs AIESEC Pulse and is the data
        controller for the personal data processed on it. AIESEC International remains the
        controller of the data held in EXPA and GIS, which Pulse reads when you sign in.
      </p>
      <p>
        For anything in this notice, write to the AIESEC in Lebanon Data Protection Officer with the{" "}
        <a href="#contact" className={LINK_CLASS}>
          contact form
        </a>{" "}
        at the end of this page, or use{" "}
        <Link href="/settings/privacy" className={LINK_CLASS}>
          Privacy &amp; your data
        </Link>{" "}
        once you are signed in.
      </p>

      <h2>What we collect, and why</h2>

      <h3>Your identity, from AIESEC</h3>
      <p>
        When you sign in, and once a day while you use Pulse, we read your EXPA person ID, name,
        email address, profile-photo link and current positions (office, role and dates) from
        AIESEC&apos;s Global Information System (GIS). We need them to know which office you belong
        to and what you may publish or moderate. Pulse never edits them: a correction made in EXPA
        reaches Pulse at your next sign-in.
      </p>

      <h3>What you do on Pulse</h3>
      <p>
        Your bio, the posts you write and their earlier versions, comments, reactions, bookmarks,
        acknowledgements, the topics, offices and people you follow or mute, the images you upload,
        and the privacy requests and messages you send us. Pulse does not record which posts you
        read.
      </p>

      <h3>Your sessions and security records</h3>
      <p>
        A record per signed-in device with a description of the browser and a keyed hash of the
        network address you signed in from, plus when you were last active. Actions that change
        content or settings are written to an audit log. We keep a hash rather than the address, so
        the record helps spot suspicious access without becoming a location trail.
      </p>

      <h3>Your AIESEC sign-in tokens</h3>
      <p>
        Stored on our servers, encrypted (AES-256-GCM), never in your browser. They keep your roles
        in step with GIS without asking you to sign in again. Signing out everywhere deletes them.
      </p>
      <p>
        <strong>Office directory.</strong> GIS offers no service account, so once a week Pulse uses
        the stored sign-in of a recently active member to read the list of AIESEC offices. Only the
        office directory is read; nothing about that member is read or changed.
      </p>

      <h3>Images</h3>
      <p>
        Images you upload are shown with your post and can only be opened by signed-in members. When
        you upload one we remove its embedded metadata, including location (EXIF/GPS), and store it
        under a random name. Images are deleted once no post uses them, for example when the post or
        your account is deleted.
      </p>

      <h2>Why we are allowed to do this</h2>
      <ul>
        <li>
          <strong>Membership relationship</strong> (GDPR Art. 6(1)(b)): running AIESEC&apos;s
          internal communications for its members, including your profile, posts and roles.
        </li>
        <li>
          <strong>Legitimate interest</strong> (Art. 6(1)(f)): security, the audit log, and keeping
          the office directory current.
        </li>
        <li>
          <strong>Legal obligation</strong> (Art. 6(1)(c)): handling your privacy requests and
          messages.
        </li>
      </ul>
      <p>Pulse uses no analytics, advertising or push notifications.</p>

      <h2>Who sees it</h2>
      <ul>
        <li>Members, according to each post&apos;s audience.</li>
        <li>AIESEC International (GIS), for sign-in and role synchronisation.</li>
        <li>
          Our processors: Vercel (application hosting), Supabase (database and image storage) and
          GitHub (triggers scheduled publishing; it receives no personal data).
        </li>
      </ul>

      <h2>Where it is held</h2>
      <p>
        The database and image storage are hosted by Supabase in <strong>Seoul, South Korea</strong>
        , and the application runs on Vercel in the same region. South Korea has an adequacy
        decision from the European Commission.
      </p>

      <h2>How long we keep it</h2>
      <div className="overflow-x-auto">
        <table>
          <caption>Retention periods, enforced by a nightly scheduled job</caption>
          <thead>
            <tr>
              <th scope="col">Data</th>
              <th scope="col">Kept for</th>
            </tr>
          </thead>
          <tbody>
            {RETENTION.map(([data, period]) => (
              <tr key={data}>
                <td>{data}</td>
                <td>{period}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Your rights</h2>
      <p>
        You can download your data at any time, and ask for access, correction, erasure,
        restriction, or object to processing, from{" "}
        <Link href="/settings/privacy" className={LINK_CLASS}>
          Privacy &amp; your data
        </Link>{" "}
        or with the{" "}
        <a href="#contact" className={LINK_CLASS}>
          contact form
        </a>{" "}
        below, which also works if you can no longer sign in. The download is immediate; everything
        else is answered by a person within one month.
      </p>
      <p>
        <strong>On erasure and our records.</strong> If you ask us to erase your data, your account
        is anonymised, your engagement history is deleted, and you choose whether your posts and
        comments stay published under &ldquo;Former member&rdquo; or are removed. Audit events are
        kept for their retention period, but your name, email and EXPA ID in them are replaced by a
        random pseudonym. The events remain; you do not appear in them.
      </p>
      <p>
        You also have the right to complain to a data protection supervisory authority, in
        particular in the country where you live or work.
      </p>

      <h2>Confidentiality</h2>
      <p>
        Pulse is not for confidential material. Audience targeting decides what is <em>relevant</em>{" "}
        to whom; it is not a security boundary, and you should assume anything you post can reach
        any AIESEC member. Do not put personal data about other people, commercially sensitive
        material, or anything under an obligation of confidence into a post or a comment.
      </p>

      <h2>Members under 18</h2>
      <p>
        AIESEC has no members under 18, in any entity. Pulse therefore applies no age-gating,
        parental-consent basis, or other under-18 safeguards to any account.
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
        The date at the top of this page always reflects the current version. See also the{" "}
        <Link href="/legal/cookies" className={LINK_CLASS}>
          cookie policy
        </Link>
        .
      </p>

      <h2 id="contact" className="scroll-mt-[calc(var(--rail-h)+40px)]">
        Contact the privacy team
      </h2>
      <p>
        Your message goes to the AIESEC in Lebanon Data Protection Officer inside Pulse. It is not
        sent to any other service, and we answer from our own email to the address you give. If you
        are signed in, the message is linked to your account so we know it is you; otherwise we may
        ask you to confirm your identity before acting on your data.
      </p>
      <PrivacyContactForm />
    </>
  );
}
