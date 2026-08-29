import "server-only";

import { randomBytes } from "node:crypto";

import { db } from "@/lib/db";
import { slugBase } from "@/lib/slug";

// Assigned once at first publication, never regenerated — so a published
// URL stays valid. Titles collide constantly; the id tail disambiguates.

const MAX_BASE_LENGTH = 60;

export function slugifyTitle(title: string): string {
  return slugBase(title, MAX_BASE_LENGTH) || "post";
}

// The loop exists because "vanishingly unlikely" is not "impossible", and a
// duplicate-key error on publish is a poor way to find out.
export async function uniqueSlug(title: string): Promise<string> {
  const base = slugifyTitle(title);

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${base}-${randomBytes(4).toString("hex")}`;
    const clash = await db.post.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!clash) return candidate;
  }

  // Five collisions means the random source is broken; use something that
  // cannot collide.
  return `${base}-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
}
