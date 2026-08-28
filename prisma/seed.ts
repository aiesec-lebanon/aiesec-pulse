import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../app/generated/prisma/client";
import type { PostLevel } from "../app/generated/prisma/enums";
import {
  PERMISSION_KEYS,
  PERMISSION_NAMES,
  type PermissionKey,
  ROLE_DESCRIPTIONS,
  ROLE_KEYS,
  ROLE_NAMES,
  type RoleKey,
  rolePermissionPairs,
} from "../lib/rbac/catalogue";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL (or DIRECT_URL) is not set");

const db = new PrismaClient({ adapter: new PrismaPg(connectionString) });

// Deterministic ids, matching the migration so the two never fork.
const roleId = (key: RoleKey) => `role_${key}`;
const permissionId = (key: PermissionKey) => `perm_${key.replace(/\./g, "_")}`;

async function seedRbac() {
  for (const key of ROLE_KEYS) {
    await db.role.upsert({
      where: { key },
      update: { name: ROLE_NAMES[key], description: ROLE_DESCRIPTIONS[key] },
      create: { id: roleId(key), key, name: ROLE_NAMES[key], description: ROLE_DESCRIPTIONS[key] },
    });
  }

  for (const key of PERMISSION_KEYS) {
    await db.permission.upsert({
      where: { key },
      update: { name: PERMISSION_NAMES[key] },
      create: { id: permissionId(key), key, name: PERMISSION_NAMES[key] },
    });
  }

  const roles = new Map((await db.role.findMany()).map((r) => [r.key, r.id]));
  const permissions = new Map((await db.permission.findMany()).map((p) => [p.key, p.id]));

  for (const pair of rolePermissionPairs()) {
    const rid = roles.get(pair.role);
    const pid = permissions.get(pair.permission);
    if (!rid || !pid) continue;
    await db.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: rid, permissionId: pid } },
      update: {},
      create: { roleId: rid, permissionId: pid },
    });
  }

  console.log(`  roles: ${ROLE_KEYS.length}, permissions: ${PERMISSION_KEYS.length}`);
}

async function seedRootEntity() {
  await db.entity.upsert({
    where: { gisOfficeId: "1" },
    update: {},
    create: {
      id: "ent_root_ai",
      gisOfficeId: "1",
      name: "AIESEC International",
      tag: "AI",
      kind: "GLOBAL",
      path: "/ai",
    },
  });
  console.log("  root entity: /ai");
}

const TOPICS: Array<{ slug: string; name: string; kind: "FUNCTION" | "PROGRAMME" | "GENERAL" }> = [
  { slug: "igv", name: "Incoming Global Volunteer", kind: "PROGRAMME" },
  { slug: "ogv", name: "Outgoing Global Volunteer", kind: "PROGRAMME" },
  { slug: "igt", name: "Incoming Global Talent", kind: "PROGRAMME" },
  { slug: "ogt", name: "Outgoing Global Talent", kind: "PROGRAMME" },
  { slug: "bd", name: "Business Development", kind: "FUNCTION" },
  { slug: "fnl", name: "Finance & Legal", kind: "FUNCTION" },
  { slug: "mkt", name: "Marketing", kind: "FUNCTION" },
  { slug: "tm", name: "Talent Management", kind: "FUNCTION" },
  { slug: "im", name: "Information Management", kind: "FUNCTION" },
  { slug: "pr", name: "Public Relations", kind: "FUNCTION" },
  { slug: "ewa", name: "External & World Affairs", kind: "FUNCTION" },
  { slug: "governance", name: "Governance", kind: "GENERAL" },
  { slug: "congress", name: "Congresses & Conferences", kind: "GENERAL" },
];

async function seedTopics() {
  for (const topic of TOPICS) {
    await db.topic.upsert({
      where: { slug: topic.slug },
      update: { name: topic.name, kind: topic.kind },
      create: topic,
    });
  }
  console.log(`  topics: ${TOPICS.length}`);
}

// Two budgets by post level: LOCAL is the per-author publishing allowance.
// NETWORK is the promotion allowance, counted per MC (not per officer),
// seeded only for roles holding `post.promote`.
const QUOTAS: Array<{
  id: string;
  roleKey: RoleKey;
  postLevel: PostLevel;
  maxPosts: number;
}> = [
  { id: "quota_default_lc_vp", roleKey: "lc_vp", postLevel: "LOCAL", maxPosts: 2 },
  { id: "quota_default_lc_president", roleKey: "lc_president", postLevel: "LOCAL", maxPosts: 2 },
  { id: "quota_default_mc_vp", roleKey: "mc_vp", postLevel: "LOCAL", maxPosts: 2 },
  { id: "quota_default_mc_president", roleKey: "mc_president", postLevel: "LOCAL", maxPosts: 2 },
  { id: "quota_default_ai_manager", roleKey: "ai_manager", postLevel: "LOCAL", maxPosts: 20 },
  { id: "quota_default_ai_vp", roleKey: "ai_vp", postLevel: "LOCAL", maxPosts: 100 },
  { id: "quota_default_pai", roleKey: "pai", postLevel: "LOCAL", maxPosts: 100 },

  // One promotion/week by default — starts tight; an admin widens it per
  // MC rather than starting wide.
  { id: "quota_network_mc_president", roleKey: "mc_president", postLevel: "NETWORK", maxPosts: 1 },
  { id: "quota_network_ai_manager", roleKey: "ai_manager", postLevel: "NETWORK", maxPosts: 20 },
  { id: "quota_network_ai_vp", roleKey: "ai_vp", postLevel: "NETWORK", maxPosts: 100 },
  { id: "quota_network_pai", roleKey: "pai", postLevel: "NETWORK", maxPosts: 100 },
];

async function seedQuotas() {
  // entityId is NULL for network-wide defaults, and Postgres treats NULLs
  // as distinct in a unique index — upsert would duplicate on every run,
  // so this finds-then-writes instead.
  for (const quota of QUOTAS) {
    const existing = await db.quotaPolicy.findFirst({
      where: {
        scopeType: "GLOBAL",
        entityId: null,
        roleKey: quota.roleKey,
        postLevel: quota.postLevel,
        period: "ISO_WEEK",
      },
      select: { id: true },
    });

    if (existing) {
      await db.quotaPolicy.update({
        where: { id: existing.id },
        data: { maxPosts: quota.maxPosts, isActive: true },
      });
    } else {
      await db.quotaPolicy.create({
        data: {
          id: quota.id,
          scopeType: "GLOBAL",
          entityId: null,
          roleKey: quota.roleKey,
          postLevel: quota.postLevel,
          period: "ISO_WEEK",
          maxPosts: quota.maxPosts,
        },
      });
    }
  }
  console.log(`  quota policies: ${QUOTAS.length}`);
}

const RANKING_WEIGHTS: Array<{ key: string; weight: number }> = [
  { key: "recency", weight: 1.0 },
  { key: "proximity", weight: 0.6 },
  { key: "affinity", weight: 0.4 },
  { key: "signal", weight: 0.3 },
  { key: "priority", weight: 0.8 },
  { key: "seen", weight: 0.5 },
  { key: "halfLifeHours", weight: 36 },
  { key: "normaliser", weight: 50 },
];

async function seedRankingWeights() {
  for (const weight of RANKING_WEIGHTS) {
    await db.rankingWeight.upsert({
      where: { key: weight.key },
      update: {},
      create: weight,
    });
  }
  console.log(`  ranking weights: ${RANKING_WEIGHTS.length}`);
}

const FLAGS = [
  "feed.ranked",
  "posts.drafts",
  "posts.scheduling",
  "posts.rich_text",
  "posts.targeting",
  "search.enabled",
  "notifications.centre",
  "notifications.digest",
  "notifications.push",
  "moderation.reports",
  "analytics.post_insights",
];

async function seedFlags() {
  for (const key of FLAGS) {
    await db.featureFlag.upsert({ where: { key }, update: {}, create: { key, enabled: false } });
  }
  console.log(`  feature flags: ${FLAGS.length} (all off)`);
}

async function main() {
  console.log("Seeding AIESEC Pulse configuration…");
  await seedRootEntity();
  await seedRbac();
  await seedTopics();
  await seedQuotas();
  await seedRankingWeights();
  await seedFlags();
  console.log("Done.");
  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
