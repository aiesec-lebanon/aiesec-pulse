import { db } from "@/lib/db";
import { Prisma } from "@/app/generated/prisma/client";
import type { AdminSessionPayload } from "@/lib/auth/admin-session";

export async function withAudit<T>(
  admin: AdminSessionPayload,
  action: string,
  targetType: "post" | "comment",
  targetId: string,
  metadata: Record<string, unknown> | null,
  fn: () => Promise<T>,
): Promise<T> {
  const result = await fn();
  await db.adminAction.create({
    data: {
      adminId: admin.sub,
      action,
      targetType,
      targetId,
      metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
  return result;
}

export async function logUserAction(
  userId: string,
  action: string,
  targetType: "post" | "comment",
  targetId: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await db.userAction.create({
    data: {
      userId,
      action,
      targetType,
      targetId,
      metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
