// Kept dependency-free so proxy.ts can use it without pulling in the database
// or Redis clients.

// Spoofable behind an arbitrary proxy, which is why it is only ever used for
// throttling and a keyed hash — never as an identity.
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? headers.get("cf-connecting-ip") ?? null;
}

export function userAgent(headers: Headers): string | null {
  return headers.get("user-agent");
}

// Server Actions get origin validation from the framework; Route Handlers do
// not. A missing Origin is rejected rather than allowed.
export function isSameOrigin(headers: Headers, expectedOrigin: string): boolean {
  const origin = headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(expectedOrigin).origin;
  } catch {
    return false;
  }
}
