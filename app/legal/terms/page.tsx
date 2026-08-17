import Link from "next/link";

export const metadata = {
  title: "Terms of use · AIESEC Pulse",
  description: "The terms on which AIESEC members use Pulse.",
};

const LAST_UPDATED = "14 August 2026";

export default function TermsPage() {
  return (
    <>
      <h1>Terms of use</h1>
      <p className="lead">
        Pulse is an internal platform for AIESEC members. These terms set out what you can expect
        from it and what it expects from you.
      </p>
      <p className="meta">Last updated: {LAST_UPDATED}</p>

      <h2>Who can use Pulse</h2>
      <p>
        Anyone with a current AIESEC account can sign in and read. Publishing depends on the
        positions you hold in EXPA: Member Committee and Local Committee leadership and functional
        leads can publish for their own entity. Editing, moderation and platform administration are
        appointed by AIESEC governance and granted separately.
      </p>
      <p>
        Access follows your AIESEC membership. When your positions end, your publishing rights end
        with them, automatically, at the next role sync.
      </p>

      <h2>What you publish</h2>
      <p>
        You keep authorship of what you write. By publishing on Pulse you allow AIESEC to display,
        store and archive it as part of the organisation&apos;s record, including after your term
        ends.
      </p>
      <p>
        You are responsible for what you publish. Only publish material you have the right to
        publish — including images and anything about other people.
      </p>
      <p>
        Content must follow the <Link href="/legal/content-policy">content policy</Link>.
      </p>

      <h2>Pulse is not for confidential material</h2>
      <p>
        Audience targeting is a relevance tool, not a security boundary. Assume anything you post
        can reach any AIESEC member. Do not use Pulse for confidential, restricted or legally
        privileged material, or for personal data about other people.
      </p>

      <h2>Publishing limits</h2>
      <p>
        Each publisher has a weekly allowance. Posts beyond it are not blocked — they go to an
        approval queue and are reviewed by an editor in your entity. The allowance is configuration
        set by AIESEC governance, not a fixed rule of the software.
      </p>

      <h2>Moderation</h2>
      <p>
        Moderators can hide a post or comment. Hiding is reversible and always carries a reason you
        will be shown. Content is not deleted by moderation — the only exception is a lawful erasure
        request or a legal takedown, both of which are separately authorised and recorded.
      </p>
      <p>
        If your content is hidden, you can appeal. Appeals are decided by a moderator who did not
        make the original decision.
      </p>
      <p>
        Repeated or serious breaches can lead to your posting or commenting rights being restricted.
        Every such decision is recorded, with a reason.
      </p>

      <h2>What we do not promise</h2>
      <p>
        Pulse is run by a small volunteer team on managed infrastructure. We aim to keep it
        available and to restore it quickly if it fails, and we publish our targets — but this is an
        internal tool, not a service with a contractual uptime guarantee.
      </p>
      <p>
        Pulse depends on AIESEC&apos;s authentication and Global Information System. If those are
        unavailable, sign-in may be degraded or unavailable.
      </p>

      <h2>Your data</h2>
      <p>
        See the <Link href="/legal/privacy">privacy notice</Link>. You can export or request erasure
        of your data at any time from <Link href="/settings/privacy">Privacy &amp; your data</Link>.
      </p>

      <h2>Changes</h2>
      <p>Material changes to these terms will be announced in the feed before they take effect.</p>
    </>
  );
}
