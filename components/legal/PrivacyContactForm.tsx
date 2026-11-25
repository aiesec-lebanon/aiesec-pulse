"use client";

import { useActionState, useState } from "react";

import { sendPrivacyMessage } from "@/app/actions/privacy-contact";
import {
  CONTACT_LIMITS,
  CONTACT_TOPICS,
  type ContactField,
  type ContactState,
} from "@/lib/privacy/contact";

const FIELD =
  "min-h-[44px] w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[16px] text-[color:var(--foreground)] focus:border-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]";
const LABEL = "mb-1.5 block text-[14px] font-medium text-[color:var(--foreground)]";
const FIELD_ERROR = "mt-1.5 text-[14px] text-[color:var(--destructive-text)]";

type Values = Record<ContactField, string>;
const EMPTY: Values = { name: "", email: "", kind: "QUESTION", message: "" };

// Controlled fields: a form action resets uncontrolled ones, which would wipe
// a long message the moment one field needed fixing.
export function PrivacyContactForm() {
  const [state, formAction, pending] = useActionState<ContactState, FormData>(sendPrivacyMessage, {
    status: "idle",
  });
  const [values, setValues] = useState<Values>(EMPTY);
  // Each send returns a new state object, so dismissing one never hides the next.
  const [dismissed, setDismissed] = useState<ContactState | null>(null);

  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const showSent = state.status === "sent" && state !== dismissed;

  function update(key: ContactField) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setValues((current) => ({ ...current, [key]: event.target.value }));
  }

  function errorProps(key: ContactField) {
    return fieldErrors[key]
      ? { "aria-invalid": true as const, "aria-describedby": `contact-${key}-error` }
      : {};
  }

  if (showSent) {
    return (
      <div className="aiesec-card mt-4 p-6" role="status">
        <div className="mb-2 font-bold text-[color:var(--success-text)]">Message sent.</div>
        <div className="mb-4 text-[16px] leading-[1.6]">
          The privacy team will reply to {state.email} within one month. If you asked us to act on
          your data, we may first ask you to confirm it&apos;s you.
        </div>
        <button
          type="button"
          className="aiesec-btn-secondary min-h-[44px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          onClick={() => {
            setValues(EMPTY);
            setDismissed(state);
          }}
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      aria-labelledby="contact"
      noValidate
      className="mt-4 flex flex-col gap-5"
    >
      <div aria-live="polite">
        {state.status === "error" && (
          <div
            role="alert"
            className="rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--destructive)_30%,transparent)] bg-[color-mix(in_srgb,var(--destructive)_10%,var(--card))] px-4 py-3 text-[14px] leading-[1.5] text-[color:var(--destructive-text)]"
          >
            {state.error}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="contact-name" className={LABEL}>
          Your name
        </label>
        <input
          id="contact-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          maxLength={CONTACT_LIMITS.name}
          value={values.name}
          onChange={update("name")}
          className={FIELD}
          {...errorProps("name")}
        />
        {fieldErrors.name && (
          <div id="contact-name-error" className={FIELD_ERROR}>
            {fieldErrors.name}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="contact-email" className={LABEL}>
          Email for our reply
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={CONTACT_LIMITS.email}
          value={values.email}
          onChange={update("email")}
          className={FIELD}
          {...errorProps("email")}
        />
        {fieldErrors.email && (
          <div id="contact-email-error" className={FIELD_ERROR}>
            {fieldErrors.email}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="contact-kind" className={LABEL}>
          What is it about?
        </label>
        <select
          id="contact-kind"
          name="kind"
          value={values.kind}
          onChange={update("kind")}
          className={FIELD}
          {...errorProps("kind")}
        >
          {CONTACT_TOPICS.map((topic) => (
            <option key={topic.kind} value={topic.kind}>
              {topic.label}
            </option>
          ))}
        </select>
        {fieldErrors.kind && (
          <div id="contact-kind-error" className={FIELD_ERROR}>
            {fieldErrors.kind}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="contact-message" className={LABEL}>
          Your message
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={6}
          maxLength={CONTACT_LIMITS.message}
          value={values.message}
          onChange={update("message")}
          className={`${FIELD} resize-y`}
          {...errorProps("message")}
        />
        {fieldErrors.message && (
          <div id="contact-message-error" className={FIELD_ERROR}>
            {fieldErrors.message}
          </div>
        )}
      </div>

      {/* Bots fill every field; people never reach this one. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="aiesec-btn-primary min-h-[44px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send to the privacy team"}
        </button>
      </div>
    </form>
  );
}
