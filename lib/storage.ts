import { randomUUID } from "node:crypto";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";

export const MEDIA_BUCKET = "post-media";
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

// Browser uploads land here and are only ever read back by finalizeUpload.
export const INCOMING_PREFIX = "incoming/";
const INCOMING_KEY = /^incoming\/[0-9a-f-]{36}$/;
// Decompression-bomb guard: ~50 MP is far beyond any phone photo.
const MAX_INPUT_PIXELS = 50_000_000;

const UPLOAD_URL_TTL_SECONDS = 300;
export const VIEW_URL_TTL_SECONDS = 600;

/** A refusal whose message is safe to show the uploader. */
export class UploadError extends Error {}

type ImageFormat = "jpeg" | "png" | "webp";
const MIME: Record<ImageFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
const EXTENSION: Record<ImageFormat, string> = { jpeg: "jpg", png: "png", webp: "webp" };

let cachedClient: S3Client | null = null;

function s3(): S3Client {
  if (cachedClient) return cachedClient;
  const endpoint = process.env.SUPABASE_URL;
  const accessKeyId = process.env.SUPABASE_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.SUPABASE_S3_SECRET_ACCESS_KEY;
  const region = process.env.SUPABASE_S3_REGION || "ap-northeast-2";

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Storage is not configured (missing SUPABASE_URL, SUPABASE_S3_ACCESS_KEY_ID, or SUPABASE_S3_SECRET_ACCESS_KEY)."
    );
  }

  cachedClient = new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return cachedClient;
}

/**
 * Keys the media route may serve: no traversal, nothing still in `incoming/`.
 * Older uploads kept the original filename, so any other character is allowed.
 */
export function isServableKey(key: string): boolean {
  return (
    key.length > 0 &&
    key.length <= 1024 &&
    !key.startsWith("/") &&
    !key.startsWith(INCOMING_PREFIX) &&
    !key.split("/").includes("..") &&
    !/[\u0000-\u001f\\]/.test(key)
  );
}

/** The type the bytes actually are, whatever the client declared. */
export function detectImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b)) return "png";
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  return null;
}

/**
 * Re-encodes so nothing from the original file survives but pixels: EXIF
 * (including GPS), XMP, comments. Orientation is applied to the pixels first,
 * since dropping the EXIF orientation tag would otherwise turn photos sideways.
 */
export async function stripImageMetadata(
  input: Uint8Array,
  format: ImageFormat
): Promise<{ data: Buffer; width: number; height: number }> {
  const pipeline = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).rotate();
  const encoded =
    format === "jpeg"
      ? pipeline.jpeg({ quality: 90, mozjpeg: true })
      : format === "png"
        ? pipeline.png({ compressionLevel: 9 })
        : pipeline.webp({ quality: 90 });
  const { data, info } = await encoded.toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

export async function getSignedUploadUrl(
  contentType: string,
  sizeBytes: number
): Promise<{ uploadUrl: string; uploadKey: string }> {
  if (!ALLOWED_MIME.has(contentType)) {
    throw new UploadError("Only JPEG, PNG, and WEBP images are allowed.");
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_UPLOAD_BYTES) {
    throw new UploadError("Image must be 5 MB or smaller.");
  }

  const uploadKey = `${INCOMING_PREFIX}${randomUUID()}`;
  const command = new PutObjectCommand({
    Bucket: MEDIA_BUCKET,
    Key: uploadKey,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(s3(), command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
  return { uploadUrl, uploadKey };
}

async function readObject(key: string): Promise<Uint8Array> {
  const object = await s3().send(new GetObjectCommand({ Bucket: MEDIA_BUCKET, Key: key }));
  if (!object.Body) throw new Error(`Empty object: ${key}`);
  return object.Body.transformToByteArray();
}

export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: MEDIA_BUCKET, Key: key }));
}

/**
 * Turns a browser upload into a stored image: real size and type checked on
 * the bytes (the client's word is not trusted), metadata stripped, and saved
 * under a random name so no original filename reaches the bucket.
 */
export async function finalizeUpload(
  uploadKey: string
): Promise<{ path: string; mimeType: string; bytes: number; width: number; height: number }> {
  if (!INCOMING_KEY.test(uploadKey)) throw new UploadError("That upload could not be found.");

  let size: number | undefined;
  try {
    const head = await s3().send(new HeadObjectCommand({ Bucket: MEDIA_BUCKET, Key: uploadKey }));
    size = head.ContentLength;
  } catch {
    throw new UploadError("That upload could not be found.");
  }

  try {
    if (!size || size > MAX_UPLOAD_BYTES) throw new UploadError("Image must be 5 MB or smaller.");

    const original = await readObject(uploadKey);
    const format = detectImageFormat(original);
    if (!format) throw new UploadError("Only JPEG, PNG, and WEBP images are allowed.");

    let stripped: Awaited<ReturnType<typeof stripImageMetadata>>;
    try {
      stripped = await stripImageMetadata(original, format);
    } catch {
      throw new UploadError("That image could not be read. Try a different file.");
    }

    const path = `${randomUUID()}.${EXTENSION[format]}`;
    await s3().send(
      new PutObjectCommand({
        Bucket: MEDIA_BUCKET,
        Key: path,
        Body: stripped.data,
        ContentType: MIME[format],
      })
    );

    return {
      path,
      mimeType: MIME[format],
      bytes: stripped.data.length,
      width: stripped.width,
      height: stripped.height,
    };
  } finally {
    await deleteObject(uploadKey).catch(() => {});
  }
}

/** Short-lived read link, handed out only after the media route checks the session. */
export async function signedViewUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: MEDIA_BUCKET, Key: key });
  return getSignedUrl(s3(), command, { expiresIn: VIEW_URL_TTL_SECONDS });
}

export type StoredObject = { key: string; lastModified: Date | null };

export async function listObjectsPage(
  continuationToken?: string
): Promise<{ objects: StoredObject[]; next?: string }> {
  const page = await s3().send(
    new ListObjectsV2Command({
      Bucket: MEDIA_BUCKET,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    })
  );
  return {
    objects: (page.Contents ?? [])
      .filter((o): o is typeof o & { Key: string } => typeof o.Key === "string")
      .map((o) => ({ key: o.Key, lastModified: o.LastModified ?? null })),
    next: page.IsTruncated ? page.NextContinuationToken : undefined,
  };
}

/** For the one-off legacy migration: re-encode an existing object under a new random key. */
export async function rewriteObjectWithoutMetadata(
  key: string
): Promise<{ newKey: string } | { skipped: string }> {
  const original = await readObject(key);
  const format = detectImageFormat(original);
  if (!format) return { skipped: "not a JPEG, PNG or WEBP image" };
  const stripped = await stripImageMetadata(original, format);
  const newKey = `${randomUUID()}.${EXTENSION[format]}`;
  await s3().send(
    new PutObjectCommand({
      Bucket: MEDIA_BUCKET,
      Key: newKey,
      Body: stripped.data,
      ContentType: MIME[format],
    })
  );
  return { newKey };
}
