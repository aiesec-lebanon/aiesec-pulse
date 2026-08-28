import { afterEach, describe, expect, it } from "vitest";

import { mediaUrl, publicStorageBase } from "@/lib/feed";

/**
 * SUPABASE_URL is the S3 upload endpoint, not the public object origin —
 * concatenating them 404s every cover image. Worth pinning in a unit test.
 */
const ORIGINAL = { url: process.env.SUPABASE_URL, publicUrl: process.env.SUPABASE_PUBLIC_URL };

afterEach(() => {
  process.env.SUPABASE_URL = ORIGINAL.url;
  process.env.SUPABASE_PUBLIC_URL = ORIGINAL.publicUrl;
});

function configure(supabaseUrl?: string, publicUrl?: string) {
  if (supabaseUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = supabaseUrl;
  if (publicUrl === undefined) delete process.env.SUPABASE_PUBLIC_URL;
  else process.env.SUPABASE_PUBLIC_URL = publicUrl;
}

describe("publicStorageBase", () => {
  it("derives the public origin from the S3 storage endpoint", () => {
    configure("https://abcdef.storage.supabase.co/storage/v1/s3");
    expect(publicStorageBase()).toBe("https://abcdef.supabase.co/storage/v1/object/public");
  });

  it("accepts a plain project URL", () => {
    configure("https://abcdef.supabase.co");
    expect(publicStorageBase()).toBe("https://abcdef.supabase.co/storage/v1/object/public");
  });

  it("tolerates a trailing slash", () => {
    configure("https://abcdef.storage.supabase.co/storage/v1/s3/");
    expect(publicStorageBase()).toBe("https://abcdef.supabase.co/storage/v1/object/public");
  });

  it("lets an explicit override win, for a custom domain or self-hosting", () => {
    configure("https://abcdef.storage.supabase.co/storage/v1/s3", "https://media.aiesec.org");
    expect(publicStorageBase()).toBe("https://media.aiesec.org/storage/v1/object/public");
  });

  it("returns null when storage is unconfigured, rather than a broken URL", () => {
    configure(undefined);
    expect(publicStorageBase()).toBeNull();
  });
});

describe("mediaUrl", () => {
  it("builds a public object URL from a bucket and key", () => {
    configure("https://abcdef.storage.supabase.co/storage/v1/s3");
    expect(mediaUrl({ bucket: "post-media", path: "abc/photo.png" })).toBe(
      "https://abcdef.supabase.co/storage/v1/object/public/post-media/abc/photo.png"
    );
  });

  it("never doubles the storage path segment", () => {
    configure("https://abcdef.storage.supabase.co/storage/v1/s3");
    const url = mediaUrl({ bucket: "post-media", path: "a.png" })!;
    expect(url.match(/storage\/v1/g)).toHaveLength(1);
  });

  it("passes through a row that still holds a full URL", () => {
    configure("https://abcdef.storage.supabase.co/storage/v1/s3");
    const absolute = "https://cdn.example.org/legacy.jpg";
    expect(mediaUrl({ bucket: "post-media", path: absolute })).toBe(absolute);
  });

  it("returns null for a post with no cover", () => {
    expect(mediaUrl(null)).toBeNull();
  });
});
