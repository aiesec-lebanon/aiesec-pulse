import { db } from "@/lib/db";
import { has } from "@/lib/env";
import { logger } from "@/lib/logger";
import { mediaKey } from "@/lib/media";
import {
  deleteObject,
  INCOMING_PREFIX,
  listObjectsPage,
  MEDIA_BUCKET,
  rewriteObjectWithoutMetadata,
  type StoredObject,
} from "@/lib/storage";

const DAY_MS = 24 * 60 * 60 * 1000;
// An upload is attached to a draft within seconds (autosave); a day of grace
// means nothing still being written is ever swept.
const GRACE_MS = DAY_MS;
const MAX_PAGES = 10;

// JSON-escaped so a key matches as it appears inside jsonb text.
const asJsonText = (value: string) => JSON.stringify(value).slice(1, -1);

async function allObjects(): Promise<StoredObject[]> {
  const objects: StoredObject[] = [];
  let next: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await listObjectsPage(next);
    objects.push(...result.objects);
    next = result.next;
    if (!next) break;
  }
  return objects;
}

// Drafts keep inline images as URLs until they are submitted, so the post
// bodies are a reference source of their own.
async function isReferencedInContent(key: string): Promise<boolean> {
  const text = asJsonText(key);
  const rows = await db.$queryRaw<Array<{ found: number }>>`
    SELECT 1 AS found FROM "Post" WHERE strpos("bodyJson"::text, ${text}) > 0
    UNION ALL
    SELECT 1 AS found FROM "PostVersion" WHERE strpos("bodyJson"::text, ${text}) > 0
    LIMIT 1`;
  return rows.length > 0;
}

/**
 * Deletes images nothing uses any more: Media rows no post points at, then
 * stored files that no remaining row or post body references. Covers deleted
 * posts and drafts, erased accounts, and abandoned uploads.
 */
export async function sweepMedia(
  dryRun: boolean
): Promise<{ orphanRows: number; objectsDeleted: number }> {
  const cutoff = new Date(Date.now() - GRACE_MS);

  const orphans = await db.$queryRaw<Array<{ id: string }>>`
    SELECT m."id" FROM "Media" m
    WHERE m."createdAt" < ${cutoff}
      AND NOT EXISTS (SELECT 1 FROM "Post" p WHERE p."coverMediaId" = m."id")
      AND NOT EXISTS (SELECT 1 FROM "PostMedia" pm WHERE pm."mediaId" = m."id")
      AND NOT EXISTS (SELECT 1 FROM "Post" p WHERE strpos(p."bodyJson"::text, m."id") > 0)
      AND NOT EXISTS (SELECT 1 FROM "PostVersion" v WHERE strpos(v."bodyJson"::text, m."id") > 0)
    LIMIT 1000`;
  if (!dryRun && orphans.length > 0) {
    await db.media.deleteMany({ where: { id: { in: orphans.map((o) => o.id) } } });
  }

  if (!has.storage()) return { orphanRows: orphans.length, objectsDeleted: 0 };

  const orphanIds = new Set(orphans.map((o) => o.id));
  const referenced = new Set(
    (await db.media.findMany({ where: { bucket: MEDIA_BUCKET }, select: { id: true, path: true } }))
      .filter((m) => !orphanIds.has(m.id))
      .map((m) => mediaKey(MEDIA_BUCKET, m.path))
      .filter((key): key is string => key !== null)
  );

  let objectsDeleted = 0;
  for (const object of await allObjects()) {
    const old = object.lastModified !== null && object.lastModified < cutoff;
    if (!old) continue;
    if (!object.key.startsWith(INCOMING_PREFIX)) {
      if (referenced.has(object.key)) continue;
      if (await isReferencedInContent(object.key)) continue;
    }
    if (!dryRun) await deleteObject(object.key);
    objectsDeleted++;
  }

  return { orphanRows: orphans.length, objectsDeleted };
}

const NEW_STYLE_KEY = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

function publicObjectPrefix(): string | null {
  const explicit = process.env.SUPABASE_PUBLIC_URL?.replace(/\/+$/, "");
  const configured = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const origin =
    explicit ??
    configured
      ?.replace(/\/storage\/v1\/s3$/, "")
      .replace(/\.storage\.supabase\.co$/, ".supabase.co");
  return origin ? `${origin}/storage/v1/object/public/${MEDIA_BUCKET}/` : null;
}

/**
 * One-off, run by hand (`npm run job media-migrate`): uploads from before
 * this change kept their original filename and metadata. Each is re-encoded
 * without metadata under a random name, references are repointed, and only
 * then is the original deleted. Dry run unless `apply`.
 */
export async function runMediaMigration(apply: boolean) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "");
  const publicPrefix = publicObjectPrefix();
  if (!baseUrl || !publicPrefix)
    throw new Error("NEXT_PUBLIC_BASE_URL and SUPABASE_URL are required.");
  const routePrefix = `${baseUrl}/api/media/${MEDIA_BUCKET}/`;

  const candidates = (await allObjects()).filter(
    (o) => !o.key.startsWith(INCOMING_PREFIX) && !NEW_STYLE_KEY.test(o.key)
  );

  const summary = { apply, candidates: candidates.length, migrated: 0, skipped: 0, failed: 0 };
  if (!apply) return summary;

  for (const object of candidates) {
    try {
      const rewritten = await rewriteObjectWithoutMetadata(object.key);
      if ("skipped" in rewritten) {
        summary.skipped++;
        logger.warn("media-migrate skipped an object", {
          key: object.key,
          reason: rewritten.skipped,
        });
        continue;
      }
      const { newKey } = rewritten;
      const oldText = asJsonText(object.key);

      await db.$transaction(async (tx) => {
        await tx.media.updateMany({ where: { path: object.key }, data: { path: newKey } });
        await tx.$executeRaw`
          UPDATE "Media" SET "path" = ${newKey}
          WHERE "path" LIKE 'http%' AND strpos("path", ${`/${MEDIA_BUCKET}/${object.key}`}) > 0`;
        await tx.$executeRaw`
          UPDATE "Post"
          SET "bodyJson" = replace(replace("bodyJson"::text, ${publicPrefix}, ${routePrefix}), ${oldText}, ${newKey})::jsonb
          WHERE strpos("bodyJson"::text, ${oldText}) > 0`;
        await tx.$executeRaw`
          UPDATE "PostVersion"
          SET "bodyJson" = replace(replace("bodyJson"::text, ${publicPrefix}, ${routePrefix}), ${oldText}, ${newKey})::jsonb
          WHERE strpos("bodyJson"::text, ${oldText}) > 0`;
      });

      // Only once nothing points at it any more.
      await deleteObject(object.key);
      summary.migrated++;
    } catch (error) {
      summary.failed++;
      logger.error("media-migrate failed for an object", { key: object.key, error });
    }
  }

  // Any remaining direct storage links in drafts now go through the media route.
  await db.$executeRaw`
    UPDATE "Post" SET "bodyJson" = replace("bodyJson"::text, ${publicPrefix}, ${routePrefix})::jsonb
    WHERE strpos("bodyJson"::text, ${publicPrefix}) > 0`;
  await db.$executeRaw`
    UPDATE "PostVersion" SET "bodyJson" = replace("bodyJson"::text, ${publicPrefix}, ${routePrefix})::jsonb
    WHERE strpos("bodyJson"::text, ${publicPrefix}) > 0`;

  return summary;
}
