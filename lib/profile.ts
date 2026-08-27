import "server-only";

import { FollowTarget } from "@/app/generated/prisma/enums";
import { db } from "@/lib/db";
import { entityDisplayName } from "@/lib/org/display";
import { requireSession } from "@/lib/rbac/guards";

export type AuthorProfile = {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  /** The member's own standfirst, when they have written one. */
  bio: string | null;
  onPulseSince: Date;
  /** The entity the member is currently placed at, if any.  is already
   *  the reader-facing brand lockup — see lib/org/display.ts. */
  primaryEntity: { id: string; name: string } | null;
  /** The current AIESEC position title (e.g. "MCVP"), if the grant is active. */
  positionTitle: string | null;
  followerCount: number;
  viewerFollowState: "none" | "following" | "muted";
};

// `User.bio` is the one narrative field on a profile, and it exists because a
// member writes it — see M21. The quote and the "recognition" list from UI ref
// 4a still have nothing behind them and are still dropped rather than invented:
// this profile carries what a real query can answer, plus what its subject
// chose to say.
export async function getAuthorProfile(userId: string): Promise<AuthorProfile | null> {
  const viewer = await requireSession();
  const now = new Date();

  const [user, activeGrant, followerCount, viewerFollow] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
        status: true,
        primaryEntity: { select: { id: true, name: true, kind: true } },
      },
    }),
    db.roleGrant.findFirst({
      where: {
        userId,
        revokedAt: null,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      orderBy: { startsAt: "desc" },
      select: { role: { select: { name: true } } },
    }),
    db.follow.count({ where: { targetType: FollowTarget.USER, targetId: userId, muted: false } }),
    db.follow.findUnique({
      where: {
        userId_targetType_targetId: {
          userId: viewer.id,
          targetType: FollowTarget.USER,
          targetId: userId,
        },
      },
      select: { muted: true },
    }),
  ]);

  if (!user || user.status !== "ACTIVE") return null;

  return {
    id: user.id,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    onPulseSince: user.createdAt,
    primaryEntity: user.primaryEntity
      ? {
          id: user.primaryEntity.id,
          name:
            entityDisplayName(user.primaryEntity.name, user.primaryEntity.kind) ??
            user.primaryEntity.name,
        }
      : null,
    positionTitle: activeGrant?.role.name ?? null,
    followerCount,
    viewerFollowState: viewerFollow ? (viewerFollow.muted ? "muted" : "following") : "none",
  };
}

export type EntityProfile = {
  id: string;
  name: string;
  tag: string | null;
  kind: "GLOBAL" | "REGION" | "MC" | "LC";
  countryCode: string | null;
  memberCount: number;
  children: Array<{ id: string; name: string; memberCount: number }>;
  followerCount: number;
  viewerFollowState: "none" | "following" | "muted";
};

// Same rule as the author profile: name, kind, member counts and real posts
// only. UI ref 4b's overview paragraph and MC-president pull-quote have no
// backing field on Entity and are dropped rather than invented.
export async function getEntityProfile(entityId: string): Promise<EntityProfile | null> {
  const viewer = await requireSession();

  const [entity, children, followerCount, viewerFollow] = await Promise.all([
    db.entity.findUnique({
      where: { id: entityId },
      select: {
        id: true,
        name: true,
        tag: true,
        kind: true,
        countryCode: true,
        isActive: true,
        _count: { select: { members: true } },
      },
    }),
    db.entity.findMany({
      where: { parentId: entityId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, kind: true, _count: { select: { members: true } } },
    }),
    db.follow.count({
      where: { targetType: FollowTarget.ENTITY, targetId: entityId, muted: false },
    }),
    db.follow.findUnique({
      where: {
        userId_targetType_targetId: {
          userId: viewer.id,
          targetType: FollowTarget.ENTITY,
          targetId: entityId,
        },
      },
      select: { muted: true },
    }),
  ]);

  if (!entity || !entity.isActive) return null;

  return {
    id: entity.id,
    name: entityDisplayName(entity.name, entity.kind) ?? entity.name,
    tag: entity.tag,
    kind: entity.kind,
    countryCode: entity.countryCode,
    memberCount: entity._count.members,
    children: children.map((c) => ({
      id: c.id,
      name: entityDisplayName(c.name, c.kind) ?? c.name,
      memberCount: c._count.members,
    })),
    followerCount,
    viewerFollowState: viewerFollow ? (viewerFollow.muted ? "muted" : "following") : "none",
  };
}
