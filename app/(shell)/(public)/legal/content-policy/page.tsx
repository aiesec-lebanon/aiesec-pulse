import Link from "next/link";

import { DisplayTitle } from "@/components/ui/DisplayTitle";

export const metadata = {
  title: "Content policy · AIESEC Pulse",
  description: "What belongs on AIESEC Pulse, how moderation works, and how to appeal.",
};

const LAST_UPDATED = "14 August 2026";

export default function ContentPolicyPage() {
  return (
    <>
      <DisplayTitle as="h1" size="lg" title="Content policy" />
      <p className="lead">
        Pulse is the AIESEC network&apos;s record of what is happening across the organisation. This
        policy sets out what belongs here, what does not, and what happens when something crosses
        the line.
      </p>
      <p className="pulse-label">Last updated: {LAST_UPDATED}</p>

      <h2>What belongs here</h2>
      <ul>
        <li>Announcements, decisions, policy and deadlines from AI, regions, MCs and LCs</li>
        <li>Entity updates, results, case studies and member stories</li>
        <li>Congresses, conferences, webinars and other events</li>
        <li>Calls for applications, open roles and exchange pushes</li>
        <li>Toolkits, decks and guidelines</li>
      </ul>

      <h2>What does not</h2>
      <ul>
        <li>
          <strong>Confidential or restricted material.</strong> Audience targeting decides
          relevance, not access. Assume any post can reach any AIESEC member. Anything genuinely
          confidential belongs somewhere else.
        </li>
        <li>
          <strong>Personal data about other people</strong> published without their knowledge —
          contact details, photographs where the subject would not expect publication, health or
          disciplinary information.
        </li>
        <li>
          <strong>Harassment, hate, or content targeting a person or group</strong> on the basis of
          race, ethnicity, nationality, religion, gender, sexual orientation, disability or any
          other protected characteristic.
        </li>
        <li>
          <strong>Misinformation</strong> presented as AIESEC fact, particularly about programmes,
          safety or partner organisations.
        </li>
        <li>
          <strong>Commercial promotion</strong> unrelated to AIESEC, and anything you were paid to
          post.
        </li>
        <li>
          <strong>Material you do not have the right to publish</strong> — images, text or media
          belonging to someone else.
        </li>
        <li>
          <strong>Party-political campaigning.</strong> AIESEC is politically neutral.
        </li>
      </ul>

      <h2>Publishing standards</h2>
      <ul>
        <li>Publish as your entity, not anonymously. Every post carries its author and entity.</li>
        <li>Describe every image for members using a screen reader. The composer requires it.</li>
        <li>Say when something applies to and who it is for.</li>
        <li>Correct errors by editing and saying what changed, rather than deleting quietly.</li>
      </ul>

      <h2>How moderation works</h2>
      <p>
        Any member can report a post or comment with a reason. Reports route first to a moderator in
        the publishing entity, and escalate to global moderation when they are severe, repeated, or
        unhandled past the triage window.
      </p>
      <p>A moderator can:</p>
      <ul>
        <li>
          <strong>Dismiss</strong> the report;
        </li>
        <li>
          <strong>Hide</strong> the content — it disappears from the feed, the author is told why,
          and nothing is deleted;
        </li>
        <li>
          <strong>Hide and restrict</strong> the author&apos;s posting or commenting rights for a
          period;
        </li>
        <li>
          <strong>Escalate</strong> to global moderation.
        </li>
      </ul>
      <p>Every one of those decisions is recorded, with the moderator, the reason and the time.</p>

      <h2>Hiding, not deleting</h2>
      <p>
        Moderation hides content; it does not destroy it. That is deliberate — an appeal is only
        meaningful if the decision can be reversed, and a deleted post cannot be restored.
      </p>
      <p>
        Content is permanently deleted only for a lawful erasure request or a legal takedown. Both
        require a separate authorisation and are themselves recorded.
      </p>

      <h2>Appeals</h2>
      <p>
        If your content is hidden or your rights are restricted, you will be told why and you can
        appeal. An appeal is decided by a moderator who did not make the original decision. If it is
        upheld, the content is restored.
      </p>

      <h2>Automated decisions</h2>
      <p>
        No content decision on Pulse is made automatically. Software may flag or rank reports for
        attention; a person decides every outcome.
      </p>

      <h2>Who owns this policy</h2>
      <p>
        The AI Communications and Information Management portfolios own this policy and the
        publishing rights that go with it. Changes are announced in the feed before taking effect.
      </p>
      <p>
        See also the{" "}
        <Link
          href="/legal/terms"
          className="pulse-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
        >
          terms of use
        </Link>{" "}
        and the{" "}
        <Link
          href="/legal/privacy"
          className="pulse-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
        >
          privacy notice
        </Link>
        .
      </p>
    </>
  );
}
