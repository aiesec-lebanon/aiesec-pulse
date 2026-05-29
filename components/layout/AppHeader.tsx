"use client";

import Link from "next/link";
import { useAuth } from "@/app/context/auth-context";
import { ThemeToggle } from "@/components/ThemeToggle";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  if (pathname.startsWith("/admin")) return null;
  const [isSwitching, setIsSwitching] = useState(false);

  const redirectToLogin = () => {
    router.push("/login");
  };

  const redirectToProfile = () => {
    router.push("/profile");
  };

  const handleRoleSwitch = async (positionId: string) => {
    try {
      setIsSwitching(true);
      const res = await fetch("/api/auth/active-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionId }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        setIsSwitching(false);
      }
    } catch {
      setIsSwitching(false);
    }
  };

  return (
    <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex items-center gap-4">
          <span className="text-[18px] font-bold tracking-[0.08em] text-[var(--brand)] uppercase">
            AIESEC Pulse
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <>
              <div className="text-right">
                <div className="text-sm font-semibold text-[var(--foreground)]">
                  {user.full_name}
                </div>
                <div className="text-xs text-[var(--muted)]">
                  {user.current_positions && user.current_positions.length > 1 ? (
                    <select
                      disabled={isSwitching}
                      value={user.activePositionId || user.current_positions[0].id}
                      onChange={(e) => handleRoleSwitch(e.target.value)}
                      className="max-w-[200px] cursor-pointer border-none bg-transparent text-xs outline-none"
                    >
                      {user.current_positions.map((pos) => (
                        <option key={pos.id} value={pos.id}>
                          {pos.role.name} - {pos.office.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span>
                      {user.current_positions?.[0]?.role?.name || "Member"} -{" "}
                      {user.current_positions?.[0]?.office?.name || ""}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface)]"
              >
                Logout
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={redirectToLogin}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface)]"
            >
              Login
            </button>
          )}
          {/* <Image
            src="https://cdn-expa.aiesec.org/assets/images/aiesec_logo_black.svg"
            alt="AIESEC"
            width={211}
            height={30}
            className="h-6 w-auto shrink-0"
          /> */}
        </div>
      </div>
    </header>
  );
}
