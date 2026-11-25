import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { mediaUrl } from "@/lib/feed";
import { mediaKey } from "@/lib/media";
import { detectImageFormat, isServableKey, stripImageMetadata } from "@/lib/storage";

// The bucket is private: every image must go through the members-only route,
// never straight to storage, or it stops loading once the bucket is closed.
describe("mediaUrl", () => {
  it("points at the members-only media route", () => {
    expect(mediaUrl({ bucket: "post-media", path: "abc/photo.png" })).toBe(
      "/api/media/post-media/abc/photo.png"
    );
  });

  it("rewrites a legacy public storage URL to the route", () => {
    const legacy =
      "https://abcdef.supabase.co/storage/v1/object/public/post-media/1b2c-My%20Photo.jpg";
    expect(mediaUrl({ bucket: "post-media", path: legacy })).toBe(
      "/api/media/post-media/1b2c-My%20Photo.jpg"
    );
  });

  it("encodes each key segment", () => {
    expect(mediaUrl({ bucket: "post-media", path: "a b/c#d.png" })).toBe(
      "/api/media/post-media/a%20b/c%23d.png"
    );
  });

  it("passes through a URL that points somewhere else entirely", () => {
    const absolute = "https://cdn.example.org/legacy.jpg";
    expect(mediaUrl({ bucket: "post-media", path: absolute })).toBe(absolute);
  });

  it("returns null for a post with no cover", () => {
    expect(mediaUrl(null)).toBeNull();
  });
});

describe("mediaKey", () => {
  it("reads the key out of a media-route URL", () => {
    expect(mediaKey("post-media", "https://pulse.example/api/media/post-media/x.jpg")).toBe(
      "x.jpg"
    );
  });
});

describe("isServableKey", () => {
  it("serves ordinary and legacy keys", () => {
    expect(isServableKey("0f8c.jpg")).toBe(true);
    expect(isServableKey("0f8c-Team photo (1) & co.jpg")).toBe(true);
  });

  it("refuses traversal, absolute paths and unfinished uploads", () => {
    expect(isServableKey("../secret")).toBe(false);
    expect(isServableKey("a/../../b")).toBe(false);
    expect(isServableKey("/etc/passwd")).toBe(false);
    expect(isServableKey("incoming/0f8c")).toBe(false);
    expect(isServableKey("")).toBe(false);
  });
});

describe("detectImageFormat", () => {
  it("trusts the bytes, not the declared type", async () => {
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "#0a7cd4" },
    })
      .png()
      .toBuffer();
    expect(detectImageFormat(png)).toBe("png");
    expect(detectImageFormat(new TextEncoder().encode("<svg></svg>"))).toBeNull();
  });
});

describe("stripImageMetadata", () => {
  it("removes EXIF (including GPS) and applies the orientation to the pixels", async () => {
    // 4x2 image tagged "rotate 90°" with a camera EXIF block.
    const tagged = await sharp({
      create: { width: 4, height: 2, channels: 3, background: "#ffffff" },
    })
      .jpeg()
      .withMetadata({
        orientation: 6,
        exif: { IFD0: { Artist: "Jane Doe", Copyright: "GPS 33.9N" } },
      })
      .toBuffer();
    expect((await sharp(tagged).metadata()).exif).toBeDefined();

    const { data, width, height } = await stripImageMetadata(tagged, "jpeg");
    const meta = await sharp(data).metadata();

    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
    expect(data.includes(Buffer.from("Jane Doe"))).toBe(false);
    expect([width, height]).toEqual([2, 4]);
  });
});
