import "server-only";

import { z } from "zod";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

// Zod-validated, not cast: a schema drift fails typed, not silently. Every
// call is timeout-bounded so GIS latency can't become our latency.

const GIS_TIMEOUT_MS = 8_000;

const officeSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string(),
  tag: z.string().nullish(),
  parent: z.object({ id: z.union([z.string(), z.number()]).transform(String) }).nullish(),
  country: z.string().nullish(),
});

const positionSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String).nullish(),
  office: officeSchema.nullish(),
  role: z
    .object({
      id: z.union([z.string(), z.number()]).transform(String).nullish(),
      name: z.string().nullish(),
    })
    .nullish(),
  start_date: z.string().nullish(),
  end_date: z.string().nullish(),
});

const currentPersonSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  full_name: z.string(),
  email: z.string().nullish(),
  profile_photo: z.string().nullish(),
  current_positions: z.array(positionSchema).default([]),
});

export type GisPosition = z.infer<typeof positionSchema>;
export type GisOffice = z.infer<typeof officeSchema>;
export type GisPerson = z.infer<typeof currentPersonSchema>;

/**
 * Exported for the contract test only: e2e fixtures are parsed through
 * this schema so a drifted fixture fails CI instead of passing silently.
 */
export const __testing = { currentPersonSchema };

const officesPageSchema = z.object({
  data: z.array(officeSchema).default([]),
  paging: z
    .object({
      total_pages: z.number().nullish(),
      current_page: z.number().nullish(),
    })
    .nullish(),
});

export class GisUnavailableError extends Error {
  constructor(
    message: string,
    // eslint-disable-next-line unused-imports/no-unused-vars -- parameter property, assigns this.cause
    readonly cause?: unknown
  ) {
    super(message);
    this.name = "GisUnavailableError";
  }
}

export class GisResponseError extends Error {
  constructor(
    message: string,
    // eslint-disable-next-line unused-imports/no-unused-vars -- parameter property, assigns this.cause
    readonly cause?: unknown
  ) {
    super(message);
    this.name = "GisResponseError";
  }
}

async function gisQuery<T>(
  accessToken: string,
  query: string,
  variables: Record<string, unknown> | undefined,
  schema: z.ZodType<T>,
  pick: (_data: unknown) => unknown
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GIS_TIMEOUT_MS);

  let payload: unknown;
  try {
    const response = await fetch(env.GIS_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: accessToken,
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
      // Per-user responses must never enter a shared cache.
      cache: "no-store",
    });

    if (!response.ok) {
      throw new GisUnavailableError(`GIS responded ${response.status}`);
    }
    payload = await response.json();
  } catch (error) {
    if (error instanceof GisUnavailableError) throw error;
    throw new GisUnavailableError("GIS request failed", error);
  } finally {
    clearTimeout(timer);
  }

  const envelope = payload as { data?: unknown; errors?: Array<{ message?: string }> };
  if (envelope?.errors?.length) {
    throw new GisResponseError(
      `GIS returned GraphQL errors: ${envelope.errors.map((e) => e.message ?? "unknown").join("; ")}`
    );
  }

  const parsed = schema.safeParse(pick(envelope?.data));
  if (!parsed.success) {
    throw new GisResponseError(
      `GIS response did not match the expected shape: ${parsed.error.message}`
    );
  }
  return parsed.data;
}

const CURRENT_PERSON_QUERY = `
{
  currentPerson {
    id
    full_name
    email
    profile_photo
    current_positions {
      id
      start_date
      end_date
      office { id name tag country parent { id } }
      role { id name }
    }
  }
}`;

// Throws GisUnavailableError on transport failure — treated as a refusal,
// not a degradation: no cached-identity grace window.
export async function fetchCurrentPerson(accessToken: string): Promise<GisPerson> {
  return gisQuery(
    accessToken,
    CURRENT_PERSON_QUERY,
    undefined,
    currentPersonSchema,
    (data) => (data as { currentPerson?: unknown })?.currentPerson
  );
}

const OFFICES_QUERY = `
query Offices($page: Int!, $perPage: Int!) {
  offices(page: $page, per_page: $perPage) {
    data { id name tag country parent { id } }
    paging { total_pages current_page }
  }
}`;

export async function fetchOfficePage(
  accessToken: string,
  page: number,
  perPage = 100
): Promise<{ offices: GisOffice[]; totalPages: number | null }> {
  const result = await gisQuery(
    accessToken,
    OFFICES_QUERY,
    { page, perPage },
    officesPageSchema,
    (data) => (data as { offices?: unknown })?.offices
  );
  return { offices: result.data, totalPages: result.paging?.total_pages ?? null };
}

const ALLOWED_OFFICE_IDS: readonly string[] = [];
const ALLOWED_ROLE_NAMES: readonly string[] = [];

export function isPersonAllowed(person: GisPerson): boolean {
  if (ALLOWED_OFFICE_IDS.length === 0 && ALLOWED_ROLE_NAMES.length === 0) return true;

  return person.current_positions.some((position) => {
    const officeOk =
      ALLOWED_OFFICE_IDS.length === 0 ||
      (position.office?.id != null && ALLOWED_OFFICE_IDS.includes(position.office.id));
    const roleOk =
      ALLOWED_ROLE_NAMES.length === 0 ||
      (position.role?.name != null && ALLOWED_ROLE_NAMES.includes(position.role.name));
    return officeOk && roleOk;
  });
}

/** Logged, not thrown: no positions is a real GIS state, not an error. */
export function warnIfPositionless(person: GisPerson): void {
  if (person.current_positions.length === 0) {
    logger.warn("GIS returned a person with no current positions", {
      aiesecPersonId: person.id,
      consequence: "Sign-in is refused: there is no position to derive a role from.",
    });
  }
}
