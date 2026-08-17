import { describe, expect, it } from "vitest";

import {
  decryptFromBytes,
  encryptToBytes,
  hashIp,
  pkceChallenge,
  pseudonymise,
  randomToken,
  safeEqual,
} from "@/lib/crypto";
import { __testing as loggerTesting } from "@/lib/logger";

describe("AES-256-GCM token encryption", () => {
  it("round-trips", () => {
    const plaintext = "a-very-secret-aiesec-access-token";
    expect(decryptFromBytes(encryptToBytes(plaintext))).toBe(plaintext);
  });

  it("round-trips unicode and empty values", () => {
    expect(decryptFromBytes(encryptToBytes("токен-🔐"))).toBe("токен-🔐");
    expect(decryptFromBytes(encryptToBytes(""))).toBe("");
  });

  it("produces a different ciphertext each time", () => {
    // A fresh IV per encryption. Without it, identical tokens produce identical
    // ciphertext and the column leaks equality across rows.
    const a = encryptToBytes("same");
    const b = encryptToBytes("same");
    expect(Buffer.compare(a, b)).not.toBe(0);
  });

  it("never contains the plaintext", () => {
    const ciphertext = encryptToBytes("recognisable-token-value");
    expect(ciphertext.toString("utf8")).not.toContain("recognisable-token-value");
  });

  it("rejects a tampered ciphertext rather than returning garbage", () => {
    // GCM is authenticated: this is what makes the column tamper-evident.
    const ciphertext = encryptToBytes("token");
    ciphertext[ciphertext.length - 1] ^= 0xff;
    expect(() => decryptFromBytes(ciphertext)).toThrow();
  });

  it("rejects a tampered auth tag", () => {
    const ciphertext = encryptToBytes("token");
    ciphertext[14] ^= 0xff; // inside the 16-byte tag
    expect(() => decryptFromBytes(ciphertext)).toThrow();
  });

  it("rejects an unknown version byte", () => {
    const ciphertext = encryptToBytes("token");
    ciphertext[0] = 9;
    expect(() => decryptFromBytes(ciphertext)).toThrow(/version/i);
  });

  it("rejects a truncated payload", () => {
    expect(() => decryptFromBytes(Buffer.from([1, 2, 3]))).toThrow(/too short/i);
  });
});

describe("hashIp", () => {
  it("is deterministic and non-reversible", () => {
    const hash = hashIp("203.0.113.7");
    expect(hash).toBe(hashIp("203.0.113.7"));
    expect(hash).not.toContain("203.0.113.7");
  });

  it("distinguishes different addresses", () => {
    expect(hashIp("203.0.113.7")).not.toBe(hashIp("203.0.113.8"));
  });

  it("passes null through, so an absent address is not hashed into a constant", () => {
    expect(hashIp(null)).toBeNull();
    expect(hashIp(undefined)).toBeNull();
    expect(hashIp("")).toBeNull();
  });
});

describe("pseudonymise", () => {
  it("is stable for the same subject so a repeat request resolves alike", () => {
    expect(pseudonymise("9001")).toBe(pseudonymise("9001"));
  });

  it("does not contain the original identifier", () => {
    expect(pseudonymise("9001")).not.toContain("9001");
    expect(pseudonymise("9001").startsWith("erased_")).toBe(true);
  });
});

describe("safeEqual", () => {
  it("compares equal and unequal values correctly", () => {
    expect(safeEqual("abc123", "abc123")).toBe(true);
    expect(safeEqual("abc123", "abc124")).toBe(false);
  });

  it("returns false on a length mismatch without throwing", () => {
    // Node's timingSafeEqual throws on mismatched lengths; a thrown error in the
    // OAuth callback would be an oracle of its own.
    expect(safeEqual("short", "considerably-longer")).toBe(false);
  });
});

describe("PKCE", () => {
  it("derives a stable base64url S256 challenge", () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const challenge = pkceChallenge(verifier);
    expect(challenge).toBe(pkceChallenge(verifier));
    expect(challenge).not.toMatch(/[+/=]/); // base64url, not base64
  });

  it("generates high-entropy, URL-safe tokens", () => {
    const token = randomToken(32);
    expect(token).not.toMatch(/[+/=]/);
    expect(token.length).toBeGreaterThanOrEqual(43);
    expect(randomToken(32)).not.toBe(token);
  });
});

describe("log redaction", () => {
  const redact = loggerTesting.redact;

  it("removes token material at the top level", () => {
    const redacted = redact({
      access_token: "live-token",
      refresh_token: "live-refresh",
      code: "auth-code",
      expires_in: 7200,
    }) as Record<string, unknown>;

    expect(redacted.access_token).toBe("[redacted]");
    expect(redacted.refresh_token).toBe("[redacted]");
    expect(redacted.code).toBe("[redacted]");
    // Non-secret context survives, or the redaction would make logs useless.
    expect(redacted.expires_in).toBe(7200);
  });

  it("removes token material nested inside an object", () => {
    const redacted = redact({
      response: { data: { tokenData: { access_token: "live-token" } } },
    }) as Record<string, Record<string, Record<string, Record<string, unknown>>>>;

    expect(redacted.response.data.tokenData.access_token).toBe("[redacted]");
  });

  it("removes token material inside an array", () => {
    const redacted = redact({ attempts: [{ code: "one" }, { code: "two" }] }) as {
      attempts: Array<{ code: string }>;
    };
    expect(redacted.attempts.map((a) => a.code)).toEqual(["[redacted]", "[redacted]"]);
  });

  it("is case-insensitive on key names", () => {
    const redacted = redact({ Authorization: "Bearer x", ACCESS_TOKEN: "y" }) as Record<
      string,
      unknown
    >;
    expect(redacted.Authorization).toBe("[redacted]");
    expect(redacted.ACCESS_TOKEN).toBe("[redacted]");
  });

  it("redacts cookies, passwords and TOTP secrets", () => {
    const redacted = redact({
      cookie: "pulse_session=…",
      password: "hunter2",
      totpSecret: "JBSWY3DP",
      client_secret: "s3cr3t",
    }) as Record<string, unknown>;
    expect(Object.values(redacted)).toEqual([
      "[redacted]",
      "[redacted]",
      "[redacted]",
      "[redacted]",
    ]);
  });

  it("serialises Errors instead of dropping them to {}", () => {
    const redacted = redact(new Error("boom")) as { name: string; message: string };
    expect(redacted.message).toBe("boom");
  });

  it("truncates deep structures rather than recursing without bound", () => {
    let deep: Record<string, unknown> = { value: 1 };
    for (let i = 0; i < 20; i++) deep = { nested: deep };
    expect(JSON.stringify(redact(deep))).toContain("[truncated]");
  });
});
