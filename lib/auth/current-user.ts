import "server-only";

import { after } from "next/server";
import { cache } from "react";

import type { User } from "@/app/generated/prisma/client";
import type { EntityKind } from "@/app/generated/prisma/enums";
import { getActiveSession, touchSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

// cache() deduplicates within a request, so a layout and its nested server
// components share one query.
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const session = await getActiveSession();
  if (!session) return null;

  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user) return null;

  if (user.status === "ERASED" || user.status === "SUSPENDED") return null;

  // Must never delay the response, so it runs after the flush.
  after(() => touchSession(session.sessionId, session.userId));

  return user;
});

export const getCurrentUserWithEntity = cache(
  async (): Promise<
    | (User & {
        primaryEntity: {
          name: string;
          tag: string | null;
          path: string;
          kind: EntityKind;
        } | null;
      })
    | null
  > => {
    const session = await getActiveSession();
    if (!session) return null;

    const user = await db.user.findUnique({
      where: { id: session.userId },
      // `kind` drives office display naming — see lib/org/display.ts.
      include: { primaryEntity: { select: { name: true, tag: true, path: true, kind: true } } },
    });
    if (!user) return null;
    if (user.status === "ERASED" || user.status === "SUSPENDED") return null;

    after(() => touchSession(session.sessionId, session.userId));
    return user;
  }
);
