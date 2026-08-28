import { DsrQueue, type DsrRow } from "@/components/admin/DsrQueue";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SpecStrip } from "@/components/ui/SpecStrip";
import { db } from "@/lib/db";
import { DSR_SLA_DAYS } from "@/lib/privacy/dsr";
import { requireAdmin } from "@/lib/rbac/guards";

export const dynamic = "force-dynamic";

function isOverdue(dueAt: Date, completedAt: Date | null): boolean {
  return completedAt === null && dueAt.getTime() < Date.now();
}

export default async function AdminPrivacyPage() {
  await requireAdmin();

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
    <main className="mx-auto w-full max-w-[1100px] px-4 pb-24 pt-8 sm:px-6">
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Privacy" }]}
        title="Data subject requests"
        standfirst={`Statutory deadline is ${DSR_SLA_DAYS} days from receipt. Erasure is irreversible and is the only path in Pulse that destroys personal data — verify the requester's identity and record the content election before executing one.`}
        bordered={false}
      />

      <SpecStrip
        ariaLabel="Data subject request totals"
        className="mt-8"
        cells={[
          { label: "Open", value: <span className="tabular">{open.length}</span> },
          {
            label: "Overdue",
            value: (
              <span
                className={
                  overdue.length > 0 ? "tabular text-[color:var(--destructive-text)]" : "tabular"
                }
              >
                {overdue.length}
              </span>
            ),
          },
          { label: "Total on record", value: <span className="tabular">{rows.length}</span> },
        ]}
      />

      <div className="mt-10">
        {rows.length === 0 ? (
          <EmptyState
            eyebrow="No requests"
            heading="Nothing on record."
            body="Data subject requests will appear here as soon as one is received."
          />
        ) : (
          <DsrQueue rows={rows} />
        )}
      </div>
    </main>
  );
}
