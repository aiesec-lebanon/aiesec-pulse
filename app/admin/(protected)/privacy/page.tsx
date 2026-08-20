import { DsrQueue, type DsrRow } from "@/components/admin/DsrQueue";
import { db } from "@/lib/db";
import { DSR_SLA_DAYS } from "@/lib/privacy/dsr";
import { requirePermission } from "@/lib/rbac/guards";

export const dynamic = "force-dynamic";

function isOverdue(dueAt: Date, completedAt: Date | null): boolean {
  return completedAt === null && dueAt.getTime() < Date.now();
}

export default async function AdminPrivacyPage() {
  await requirePermission("admin.privacy_execute");

  const requests = await db.dataSubjectRequest.findMany({
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    take: 200,
  });

  const userIds = requests.map((r) => r.userId).filter((id): id is string => Boolean(id));
  const users =
    userIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, fullName: true, email: true, status: true },
        })
      : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  const rows: DsrRow[] = requests.map((request) => {
    const user = request.userId ? userById.get(request.userId) : undefined;
    return {
      id: request.id,
      kind: request.kind,
      status: request.status,
      subjectName: user?.fullName ?? request.email ?? "Unidentified subject",
      subjectEmail: user?.email ?? request.email,
      subjectStatus: user?.status ?? null,
      receivedAt: request.receivedAt.toISOString(),
      dueAt: request.dueAt.toISOString(),
      overdue: isOverdue(request.dueAt, request.completedAt),
      completedAt: request.completedAt?.toISOString() ?? null,
      notes: request.notes,
    };
  });

  const open = rows.filter((r) => r.status === "RECEIVED" || r.status === "IN_PROGRESS");
  const overdue = open.filter((r) => r.overdue);

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-6">
      <h1 className="text-[24px] font-black text-[color:var(--foreground)]">
        Data subject requests
      </h1>
      <p className="mt-1 max-w-[70ch] text-[15px] leading-[1.6] text-[color:var(--muted-foreground)]">
        Statutory deadline is {DSR_SLA_DAYS} days from receipt. Erasure is irreversible and is the
        only path in Pulse that destroys personal data — verify the requester&apos;s identity and
        record the content election before executing one.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Open" value={open.length} />
        <Stat
          label="Overdue"
          value={overdue.length}
          tone={overdue.length > 0 ? "alert" : "normal"}
        />
        <Stat label="Total on record" value={rows.length} />
      </div>

      <div className="mt-8">
        {rows.length === 0 ? (
          <div className="aiesec-card px-8 py-12 text-center">
            <p className="text-[16px] text-[color:var(--muted-foreground)]">
              No requests on record.
            </p>
          </div>
        ) : (
          <DsrQueue rows={rows} />
        )}
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  tone = "normal",
}: {
  label: string;
  value: number;
  tone?: "normal" | "alert";
}) {
  return (
    <div className="aiesec-card px-5 py-4">
      <p
        className={`text-[28px] font-bold ${
          tone === "alert"
            ? "text-[color:var(--destructive-text)]"
            : "text-[color:var(--foreground)]"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[13px] text-[color:var(--muted-foreground)]">{label}</p>
    </div>
  );
}
