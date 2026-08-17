"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { grantRole } from "@/app/actions/roles";

type RoleOption = { key: string; name: string; description: string; requiresEntity: boolean };
type Option = { id: string; label: string };

// Search-driven rather than a dropdown: the network is ~40,000 members.
export function GrantRoleForm({
  roles,
  entities,
  members,
  searchQuery,
}: {
  roles: RoleOption[];
  entities: Array<Option & { kind: string }>;
  members: Option[];
  searchQuery: string;
}) {
  const router = useRouter();
  const [roleKey, setRoleKey] = useState(roles[0]?.key ?? "");
  const [userId, setUserId] = useState("");
  const [scopeEntityId, setScopeEntityId] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedRole = roles.find((r) => r.key === roleKey);
  const requiresEntity = selectedRole?.requiresEntity ?? false;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await grantRole({
        userId,
        roleKey,
        scopeEntityId: requiresEntity ? scopeEntityId || null : null,
        reason,
      });
      if (result.ok) {
        setMessage({ tone: "ok", text: "Grant recorded. It takes effect within a minute." });
        setUserId("");
        setReason("");
        router.refresh();
      } else {
        setMessage({ tone: "error", text: result.error });
      }
    });
  }

  const inputClass =
    "w-full min-h-[36px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[15px] text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none";

  return (
    <div className="aiesec-card p-5">
      {/* Server-rendered member search — works with scripting disabled. */}
      <form method="get" action="/admin/roles" className="mb-5 flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1">
          <label
            htmlFor="member-search"
            className="mb-1.5 block text-[14px] font-medium text-[var(--foreground)]"
          >
            Find a member
          </label>
          <input
            id="member-search"
            name="q"
            type="search"
            defaultValue={searchQuery}
            placeholder="Name or email"
            className={inputClass}
          />
        </div>
        <button type="submit" className="aiesec-btn-secondary min-h-[36px]">
          Search
        </button>
      </form>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="grant-member"
            className="mb-1.5 block text-[14px] font-medium text-[var(--foreground)]"
          >
            Member{" "}
            <span aria-hidden className="text-[var(--destructive-text)]">
              *
            </span>
          </label>
          <select
            id="grant-member"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            required
            disabled={members.length === 0}
            aria-describedby="grant-member-hint"
            className={inputClass}
          >
            <option value="">
              {members.length === 0 ? "Search for a member first" : "Choose a member"}
            </option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <p id="grant-member-hint" className="mt-1 text-[13px] text-[var(--muted-foreground)]">
            Members appear once they have signed in at least once.
          </p>
        </div>

        <div>
          <label
            htmlFor="grant-role"
            className="mb-1.5 block text-[14px] font-medium text-[var(--foreground)]"
          >
            Role{" "}
            <span aria-hidden className="text-[var(--destructive-text)]">
              *
            </span>
          </label>
          <select
            id="grant-role"
            value={roleKey}
            onChange={(e) => setRoleKey(e.target.value)}
            required
            aria-describedby="grant-role-hint"
            className={inputClass}
          >
            {roles.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name}
              </option>
            ))}
          </select>
          <p id="grant-role-hint" className="mt-1 text-[13px] text-[var(--muted-foreground)]">
            {selectedRole?.description}
          </p>
        </div>

        {requiresEntity && (
          <div>
            <label
              htmlFor="grant-entity"
              className="mb-1.5 block text-[14px] font-medium text-[var(--foreground)]"
            >
              Entity{" "}
              <span aria-hidden className="text-[var(--destructive-text)]">
                *
              </span>
            </label>
            <select
              id="grant-entity"
              value={scopeEntityId}
              onChange={(e) => setScopeEntityId(e.target.value)}
              required
              aria-describedby="grant-entity-hint"
              className={inputClass}
            >
              <option value="">Choose an entity</option>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </select>
            <p id="grant-entity-hint" className="mt-1 text-[13px] text-[var(--muted-foreground)]">
              The grant covers this entity and everything beneath it in the tree.
            </p>
          </div>
        )}

        <div>
          <label
            htmlFor="grant-reason"
            className="mb-1.5 block text-[14px] font-medium text-[var(--foreground)]"
          >
            Reason{" "}
            <span aria-hidden className="text-[var(--destructive-text)]">
              *
            </span>
          </label>
          <input
            id="grant-reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={5}
            maxLength={500}
            placeholder="e.g. Nominated as MC comms lead for 26.27"
            className={inputClass}
          />
        </div>

        {message && (
          <p
            role="alert"
            className={`text-[14px] ${message.tone === "ok" ? "text-[var(--success-text)]" : "text-[var(--destructive-text)]"}`}
          >
            {message.text}
          </p>
        )}

        <div>
          <button
            type="submit"
            disabled={pending || !userId}
            className="aiesec-btn-primary disabled:opacity-50"
          >
            {pending ? "Granting…" : "Grant role"}
          </button>
        </div>
      </form>
    </div>
  );
}
