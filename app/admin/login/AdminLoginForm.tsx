"use client";

import { useActionState } from "react";

import { adminLogin, type AdminLoginState } from "@/app/actions/admin-auth";

const FIELD =
  "min-h-[44px] w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[16px] text-[color:var(--foreground)] focus:border-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]";

const LABEL = "mb-1.5 block text-[14px] font-medium text-[color:var(--foreground)]";

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState<AdminLoginState, FormData>(adminLogin, null);

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-5">
      {state && (
        <p
          role="alert"
          className="rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--destructive)_30%,transparent)] bg-[color-mix(in_srgb,var(--destructive)_10%,var(--card))] px-4 py-3 text-[14px] leading-[1.5] text-[color:var(--destructive-text)]"
        >
          {state.error}
        </p>
      )}

      <div>
        <label htmlFor="admin-email" className={LABEL}>
          Email
        </label>
        <input
          id="admin-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className={FIELD}
        />
      </div>

      <div>
        <label htmlFor="admin-password" className={LABEL}>
          Password
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={FIELD}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="min-h-[44px] w-full rounded-[var(--radius-sm)] bg-[var(--primary-fill)] px-6 text-[16px] font-bold text-[color:var(--primary-foreground)] shadow-[var(--elev-2)] transition-[transform,box-shadow] duration-[calc(var(--dur-element)*var(--motion-scale))] ease-[var(--ease-out-expo)] hover:-translate-y-[calc(2px*var(--motion-travel))] hover:shadow-[var(--elev-3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
