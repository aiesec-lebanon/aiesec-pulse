"use client";

import { useState, useTransition } from "react";

import { setRolePermission } from "@/app/actions/role-permissions";
import {
  PERMISSION_KEYS,
  PERMISSION_NAMES,
  type PermissionKey,
  ROLE_KEYS,
  ROLE_NAMES,
  type RoleKey,
} from "@/lib/rbac/catalogue";

export type MatrixCell = `${RoleKey}:${PermissionKey}`;

const cellKey = (role: RoleKey, permission: PermissionKey): MatrixCell => `${role}:${permission}`;

// The catalogue is already ordered by domain; this only names the runs so the
// 24 rows read as five short lists rather than one long one.
const GROUPS: ReadonlyArray<{ label: string; prefix: string }> = [
  { label: "Posts", prefix: "post." },
  { label: "Comments", prefix: "comment." },
  { label: "Moderation", prefix: "moderation." },
  { label: "Analytics", prefix: "analytics." },
  { label: "Administration", prefix: "admin." },
];

const groupedPermissions = GROUPS.map((group) => ({
  ...group,
  permissions: PERMISSION_KEYS.filter((key) => key.startsWith(group.prefix)),
}));

export function PermissionMatrix({ allowed }: { allowed: MatrixCell[] }) {
  const [granted, setGranted] = useState(() => new Set<string>(allowed));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [, startTransition] = useTransition();

  function toggle(role: RoleKey, permission: PermissionKey) {
    const key = cellKey(role, permission);
    const next = !granted.has(key);

    // The checkbox moves on click and moves back if the write is refused —
    // a control that waits on a round trip before responding reads as broken.
    setGranted((current) => {
      const updated = new Set(current);
      if (next) updated.add(key);
      else updated.delete(key);
      return updated;
    });
    setBusy(key);
    setError(null);

    startTransition(async () => {
      const result = await setRolePermission(role, permission, next);
      setBusy(null);
      if (result.ok) {
        setStatus(
          `${PERMISSION_NAMES[permission]} ${next ? "allowed for" : "withdrawn from"} ${ROLE_NAMES[role]}.`
        );
        return;
      }
      setGranted((current) => {
        const reverted = new Set(current);
        if (next) reverted.delete(key);
        else reverted.add(key);
        return reverted;
      });
      setError(result.error);
    });
  }

  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>
      {error && (
        <p role="alert" className="mb-3 text-[14px] text-[color:var(--destructive-text)]">
          {error}
        </p>
      )}

      <div className="aiesec-card overflow-x-auto p-0">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            What each AIESEC position class may do. Tick a box to allow a permission, untick it to
            withdraw it.
          </caption>
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th
                scope="col"
                className="sticky left-0 z-10 bg-[var(--card)] px-4 py-3 text-[14px] font-medium text-[color:var(--muted-foreground)]"
              >
                Permission
              </th>
              {ROLE_KEYS.map((role) => (
                <th
                  key={role}
                  scope="col"
                  className="px-2 py-3 text-center text-[14px] font-medium text-[color:var(--foreground)]"
                >
                  <span className="block whitespace-nowrap">{ROLE_NAMES[role]}</span>
                </th>
              ))}
            </tr>
          </thead>

          {groupedPermissions.map((group) => (
            <tbody key={group.label}>
              <tr>
                <th
                  scope="colgroup"
                  colSpan={ROLE_KEYS.length + 1}
                  className="pulse-label sticky left-0 bg-[var(--muted)] px-4 py-2 text-left"
                >
                  {group.label}
                </th>
              </tr>
              {group.permissions.map((permission) => (
                <tr key={permission} className="border-b border-[var(--border)] last:border-0">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-[var(--card)] px-4 py-2 text-[14px] font-medium text-[color:var(--foreground)]"
                  >
                    <span className="block whitespace-nowrap">{PERMISSION_NAMES[permission]}</span>
                    <span className="block whitespace-nowrap text-[12px] font-medium text-[color:var(--muted-foreground)]">
                      {permission}
                    </span>
                  </th>
                  {ROLE_KEYS.map((role) => {
                    const key = cellKey(role, permission);
                    return (
                      <td key={role} className="px-2 py-2 text-center">
                        <label className="mx-auto flex min-h-[44px] min-w-[44px] items-center justify-center">
                          <input
                            type="checkbox"
                            checked={granted.has(key)}
                            disabled={busy === key}
                            onChange={() => toggle(role, permission)}
                            className="h-6 w-6 accent-[var(--primary-fill)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
                          />
                          <span className="sr-only">
                            {PERMISSION_NAMES[permission]} for {ROLE_NAMES[role]}
                          </span>
                        </label>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </>
  );
}
