"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { breakGlassSignIn, type BreakGlassState } from "@/app/actions/break-glass";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="aiesec-btn-primary w-full disabled:opacity-50"
    >
      {pending ? "Verifying…" : "Sign in"}
    </button>
  );
}

/**
 * WCAG 3.3.8 (Accessible Authentication) requires an authentication form to
 * permit paste and password managers. So: no `onPaste` blocking, and no
 * `autocomplete="off"` on the password field. Both are common hardening
 * folklore, and both lock out the people most likely to be using a strong
 * randomly generated credential — which is exactly who should be using this one.
 */
export function BreakGlassForm() {
  const [state, formAction] = useActionState<BreakGlassState, FormData>(breakGlassSignIn, null);

  const inputClass =
    "w-full min-h-[40px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[15px] text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none";

  return (
    <form action={formAction} className="aiesec-card flex flex-col gap-4 p-6">
      <div>
        <label
          htmlFor="bg-email"
          className="mb-1.5 block text-[14px] font-medium text-[var(--foreground)]"
        >
          Email
        </label>
        <input
          id="bg-email"
          name="email"
          type="email"
          required
          autoComplete="username"
          className={inputClass}
        />
      </div>

      <div>
        <label
          htmlFor="bg-password"
          className="mb-1.5 block text-[14px] font-medium text-[var(--foreground)]"
        >
          Password
        </label>
        <input
          id="bg-password"
          name="password"
          type="password"
          required
          minLength={12}
          autoComplete="current-password"
          className={inputClass}
        />
      </div>

      <div>
        <label
          htmlFor="bg-totp"
          className="mb-1.5 block text-[14px] font-medium text-[var(--foreground)]"
        >
          Authenticator code
        </label>
        <input
          id="bg-totp"
          name="totp"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoComplete="one-time-code"
          aria-describedby="bg-totp-hint"
          className={`${inputClass} tracking-[0.4em]`}
        />
        <p id="bg-totp-hint" className="mt-1 text-[13px] text-[var(--muted-foreground)]">
          Six digits from the authenticator enrolled for this account.
        </p>
      </div>

      {state?.error && (
        <p role="alert" className="text-[14px] text-[var(--destructive-text)]">
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
