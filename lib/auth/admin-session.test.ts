import { vi, describe, it, expect } from "vitest";
import { SignJWT } from "jose";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

import { signAdminSession, verifyAdminSession } from "./admin-session";

const TEST_SECRET = process.env.ADMIN_SESSION_SECRET!;

describe("signAdminSession / verifyAdminSession", () => {
  it("roundtrip: verified payload matches signed sub and kind", async () => {
    const token = await signAdminSession({
      sub: "admin-42",
      kind: "admin",
      iat: 0,
      exp: 0,
    });
    const payload = await verifyAdminSession(token);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe("admin-42");
    expect(payload!.kind).toBe("admin");
    expect(typeof payload!.iat).toBe("number");
    expect(typeof payload!.exp).toBe("number");
    expect(payload!.exp).toBeGreaterThan(Date.now() / 1000);
  });

  it("tampered signature returns null", async () => {
    const token = await signAdminSession({
      sub: "admin-42",
      kind: "admin",
      iat: 0,
      exp: 0,
    });
    const parts = token.split(".");
    parts[2] = parts[2].slice(0, -4) + "XXXX";
    expect(await verifyAdminSession(parts.join("."))).toBeNull();
  });

  it("tampered payload returns null", async () => {
    const token = await signAdminSession({
      sub: "admin-42",
      kind: "admin",
      iat: 0,
      exp: 0,
    });
    const forged = Buffer.from(
      JSON.stringify({ sub: "evil", kind: "admin", iat: 0, exp: 9_999_999_999 }),
    ).toString("base64url");
    const parts = token.split(".");
    parts[1] = forged;
    expect(await verifyAdminSession(parts.join("."))).toBeNull();
  });

  it("expired token returns null", async () => {
    const secret = new TextEncoder().encode(TEST_SECRET);
    const expired = await new SignJWT({ kind: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("admin-42")
      .setIssuedAt(new Date(Date.now() - 48 * 3_600_000))
      .setExpirationTime(new Date(Date.now() - 1000))
      .sign(secret);
    expect(await verifyAdminSession(expired)).toBeNull();
  });

  it("token with wrong kind returns null", async () => {
    const secret = new TextEncoder().encode(TEST_SECRET);
    const wrong = await new SignJWT({ kind: "user" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("admin-42")
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(secret);
    expect(await verifyAdminSession(wrong)).toBeNull();
  });
});
