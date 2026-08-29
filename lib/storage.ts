import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;
const BUCKET = "post-media";

export type SignedUpload = {
  uploadUrl: string;
  publicUrl: string;
};

function makeS3Client() {
  const endpoint = process.env.SUPABASE_URL;
  const accessKeyId = process.env.SUPABASE_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.SUPABASE_S3_SECRET_ACCESS_KEY;
  const region = process.env.SUPABASE_S3_REGION ?? "ap-northeast-2";

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Storage is not configured (missing SUPABASE_URL, SUPABASE_S3_ACCESS_KEY_ID, or SUPABASE_S3_SECRET_ACCESS_KEY)."
    );
  }

  return new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

// endpoint: https://<ref>.storage.supabase.co/storage/v1/s3
// public:   https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
function getPublicUrl(path: string): string {
  const endpoint = process.env.SUPABASE_URL ?? "";
  const ref = new URL(endpoint).hostname.split(".")[0];
  return `https://${ref}.supabase.co/storage/v1/object/public/${BUCKET}/${path}`;
}

function sanitizeFilename(raw: string): string {
  const base = raw.replace(/.*[/\\]/, "");
  return base.replace(/\s+/g, "-");
}

export async function getSignedUploadUrl(
  filename: string,
  contentType: string,
  sizeBytes: number
): Promise<SignedUpload> {
  if (!ALLOWED_MIME.has(contentType)) {
    throw new Error("Only JPEG, PNG, and WEBP images are allowed.");
  }
  if (sizeBytes > MAX_BYTES) {
    throw new Error("Image must be 5 MB or smaller.");
  }

  const client = makeS3Client();
  const path = `${crypto.randomUUID()}-${sanitizeFilename(filename)}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: path,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });
  const publicUrl = getPublicUrl(path);

  return { uploadUrl, publicUrl };
}
