"use client";

import { useActionState } from "react";
import { adminLogin, type AdminLoginState } from "@/app/actions/admin";

export default function LoginForm() {
  const [state, action, pending] = useActionState<AdminLoginState, FormData>(
    adminLogin,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="email"
          className="text-[14px] font-medium text-foreground"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="h-10 rounded-[var(--radius-sm)] border border-border bg-card px-3 text-[16px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
          placeholder="moderator@aiesec.org"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="password"
          className="text-[14px] font-medium text-foreground"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="h-10 rounded-[var(--radius-sm)] border border-border bg-card px-3 text-[16px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
        />
      </div>

      {state?.error && (
        <p role="alert" className="text-[14px] text-destructive">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="aiesec-btn-primary w-full mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
