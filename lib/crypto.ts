import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { env } from "@/lib/env";

// AES-256-GCM wire format, stored in one Bytes column:
//   [ 1 byte version ][ 12 byte IV ][ 16 byte auth tag ][ ciphertext ]
// The version byte lets a rotation that changes algorithm still read old rows.

const VERSION = 1;
const IV_BYTES = 12; // GCM standard nonce length
const TAG_BYTES = 16;

let cachedKey: Buffer | null = null;

// Accepts base64 (32 raw bytes) or a passphrase, stretched with SHA-256.
function key(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = env.TOKEN_ENCRYPTION_KEY;

  const asBase64 = Buffer.from(raw, "base64");
  cachedKey = asBase64.length === 32 ? asBase64 : createHash("sha256").update(raw, "utf8").digest();
  return cachedKey;
}

export function encryptToBytes(plaintext: string): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([Buffer.from([VERSION]), iv, cipher.getAuthTag(), ciphertext]);
}

export function decryptFromBytes(payload: Uint8Array): string {
  const buf = Buffer.from(payload);
  if (buf.length < 1 + IV_BYTES + TAG_BYTES) {
    throw new Error("Ciphertext is too short to be a valid AES-GCM payload");
  }
  const version = buf[0];
  if (version !== VERSION) {
    throw new Error(`Unsupported ciphertext version ${version}`);
  }

  const iv = buf.subarray(1, 1 + IV_BYTES);
  const tag = buf.subarray(1 + IV_BYTES, 1 + IV_BYTES + TAG_BYTES);
  const ciphertext = buf.subarray(1 + IV_BYTES + TAG_BYTES);

  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

// A raw IP would put a directly identifying value in an append-only table
// that erasure cannot delete from.
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHmac("sha256", env.SESSION_SECRET).update(ip).digest("base64url").slice(0, 32);
}

// Deterministic so a repeat request resolves to the same row, irreversible so
// the identity is gone.
export function pseudonymise(value: string): string {
  return `erased_${createHmac("sha256", env.SESSION_SECRET).update(value).digest("hex").slice(0, 32)}`;
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  // Throws on length mismatch, which would itself leak length.
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}
