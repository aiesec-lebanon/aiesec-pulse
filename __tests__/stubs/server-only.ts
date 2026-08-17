/**
 * `server-only` throws on import outside a React Server Component, which is
 * exactly its job — and exactly what makes it unimportable from Vitest.
 * Aliased here so pure logic in `server-only` modules can still be unit tested;
 * the real guard remains in place for every build.
 */
export {};
