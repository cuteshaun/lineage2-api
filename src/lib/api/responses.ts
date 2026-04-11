import { isChronicle, type Chronicle } from "../chronicles";

export type ParsedRouteParams =
  | { ok: true; chronicle: Chronicle; id: number }
  | { ok: false; response: Response };

export type ParsedChronicleParam =
  | { ok: true; chronicle: Chronicle }
  | { ok: false; response: Response };

export interface ListMeta {
  total: number;
  limit: number;
  offset: number;
}

const baseHeaders: HeadersInit = {
  "Cache-Control": "public, max-age=86400",
};

export function jsonOk<T>(data: T, status = 200): Response {
  return Response.json({ data }, { status, headers: baseHeaders });
}

export function jsonList<T>(
  data: T[],
  meta: ListMeta,
  status = 200
): Response {
  return Response.json({ data, meta }, { status, headers: baseHeaders });
}

export function jsonError(error: string, status: number): Response {
  return Response.json(
    { error, status },
    { status, headers: baseHeaders }
  );
}

/**
 * Validate the `chronicle` and `id` route params for entity endpoints.
 * Returns either parsed values or an early error response.
 */
export function parseEntityParams(params: {
  chronicle: string;
  id: string;
}): ParsedRouteParams {
  if (!isChronicle(params.chronicle)) {
    return {
      ok: false,
      response: jsonError(`Unknown chronicle: ${params.chronicle}`, 404),
    };
  }

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return {
      ok: false,
      response: jsonError(`Invalid id: ${params.id}`, 400),
    };
  }

  return { ok: true, chronicle: params.chronicle, id };
}

/** Validate the `chronicle` route param for list endpoints (no id). */
export function parseChronicleParam(params: {
  chronicle: string;
}): ParsedChronicleParam {
  if (!isChronicle(params.chronicle)) {
    return {
      ok: false,
      response: jsonError(`Unknown chronicle: ${params.chronicle}`, 404),
    };
  }
  return { ok: true, chronicle: params.chronicle };
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export interface PaginationOpts {
  limit: number;
  offset: number;
}

/**
 * Parse a single non-negative integer query param. Returns the parsed value,
 * `null` if absent, or an error string if malformed.
 */
function parseIntParam(
  raw: string | null,
  name: string
): number | null | string {
  if (raw === null || raw === "") return null;
  const num = Number(raw);
  if (!Number.isInteger(num)) {
    return `Invalid ${name}: must be an integer`;
  }
  return num;
}

/**
 * Parse `limit` and `offset` from URL search params.
 * - limit defaults to 50, clamped to [1, MAX_LIMIT]
 * - offset defaults to 0, must be >= 0
 */
export function parsePagination(
  search: URLSearchParams
):
  | { ok: true; pagination: PaginationOpts }
  | { ok: false; response: Response } {
  const rawLimit = parseIntParam(search.get("limit"), "limit");
  if (typeof rawLimit === "string") {
    return { ok: false, response: jsonError(rawLimit, 400) };
  }
  const rawOffset = parseIntParam(search.get("offset"), "offset");
  if (typeof rawOffset === "string") {
    return { ok: false, response: jsonError(rawOffset, 400) };
  }

  let limit = rawLimit ?? DEFAULT_LIMIT;
  if (limit < 1) {
    return { ok: false, response: jsonError("Invalid limit: must be >= 1", 400) };
  }
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  const offset = rawOffset ?? 0;
  if (offset < 0) {
    return {
      ok: false,
      response: jsonError("Invalid offset: must be >= 0", 400),
    };
  }

  return { ok: true, pagination: { limit, offset } };
}

/**
 * Parse an optional integer search param. Returns the value, `null` if
 * absent, or an error response if malformed.
 */
export function parseOptionalInt(
  search: URLSearchParams,
  name: string
): { ok: true; value: number | null } | { ok: false; response: Response } {
  const result = parseIntParam(search.get(name), name);
  if (typeof result === "string") {
    return { ok: false, response: jsonError(result, 400) };
  }
  return { ok: true, value: result };
}

/**
 * Validate an optional enum search param case-insensitively against a
 * `lowercase → canonical` map. Returns the canonical form, `null` if absent,
 * or a 400 error response listing the allowed values.
 */
export function parseEnumParam(
  search: URLSearchParams,
  name: string,
  allowedMap: Map<string, string>
): { ok: true; value: string | null } | { ok: false; response: Response } {
  const raw = search.get(name);
  if (raw === null || raw === "") return { ok: true, value: null };
  const canonical = allowedMap.get(raw.toLowerCase());
  if (!canonical) {
    const allowed = [...allowedMap.values()].sort().join(", ");
    return {
      ok: false,
      response: jsonError(
        `Invalid ${name}: "${raw}". Allowed: ${allowed}`,
        400
      ),
    };
  }
  return { ok: true, value: canonical };
}

export type SortDirection = "asc" | "desc";
export interface ParsedSort<F extends string> {
  field: F;
  direction: SortDirection;
}

/**
 * Parse a `sort=<field>` or `sort=-<field>` query param against an allow-list.
 * Returns the parsed `{ field, direction }`, `null` if absent, or a 400 error
 * listing the allowed values (in both ascending and descending forms).
 */
export function parseSortParam<F extends string>(
  search: URLSearchParams,
  allowedFields: readonly F[]
):
  | { ok: true; value: ParsedSort<F> | null }
  | { ok: false; response: Response } {
  const raw = search.get("sort");
  if (raw === null || raw === "") return { ok: true, value: null };

  const direction: SortDirection = raw.startsWith("-") ? "desc" : "asc";
  const field = direction === "desc" ? raw.slice(1) : raw;

  if (!(allowedFields as readonly string[]).includes(field)) {
    const allowed = allowedFields
      .flatMap((f) => [f, `-${f}`])
      .sort()
      .join(", ");
    return {
      ok: false,
      response: jsonError(
        `Invalid sort: "${raw}". Allowed: ${allowed}`,
        400
      ),
    };
  }

  return { ok: true, value: { field: field as F, direction } };
}
