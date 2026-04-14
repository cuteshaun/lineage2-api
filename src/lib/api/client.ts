import { headers } from "next/headers";

/**
 * Server-side fetch helper for calling our own API from server components.
 *
 * The explorer UI intentionally fetches through the real HTTP API (rather
 * than importing the data layer directly) so that every page exercises the
 * public endpoint contract end-to-end.
 *
 * In Next.js App Router, fetch to the same origin requires an absolute URL
 * in server components, so we reconstruct the base URL from the incoming
 * request's `host` / `x-forwarded-proto` headers.
 */
export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiNotFound {
  ok: false;
  status: 404;
}

export interface ApiError {
  ok: false;
  status: number;
  error: string;
}

export type ApiResult<T> = ApiSuccess<T> | ApiNotFound | ApiError;

async function resolveBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Fetch an API endpoint. Returns a tagged result so callers can cleanly
 * branch on 404 / other errors without throwing.
 */
export async function apiFetch<T>(path: string): Promise<ApiResult<T>> {
  const base = await resolveBaseUrl();
  const url = `${base}${path}`;

  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch (e) {
    return {
      ok: false,
      status: 0,
      error: `Fetch failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  if (res.status === 404) return { ok: false, status: 404 };

  if (!res.ok) {
    let errorText = `API ${path} returned ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) errorText = body.error;
    } catch {
      /* non-JSON body */
    }
    return { ok: false, status: res.status, error: errorText };
  }

  const body = (await res.json()) as { data: T };
  return { ok: true, data: body.data };
}

/**
 * Fetch a list endpoint. These return `{ data, meta }` rather than
 * `{ data }`, so we have a small variant that preserves the meta block.
 */
export interface ListResponse<T> {
  data: T[];
  meta: { total: number; limit: number; offset: number };
}

export async function apiFetchList<T>(
  path: string
): Promise<
  | { ok: true; data: T[]; meta: ListResponse<T>["meta"] }
  | { ok: false; status: number; error: string }
> {
  const base = await resolveBaseUrl();
  const url = `${base}${path}`;

  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch (e) {
    return {
      ok: false,
      status: 0,
      error: `Fetch failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  if (!res.ok) {
    let errorText = `API ${path} returned ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) errorText = body.error;
    } catch {
      /* non-JSON body */
    }
    return { ok: false, status: res.status, error: errorText };
  }

  const body = (await res.json()) as ListResponse<T>;
  return { ok: true, data: body.data, meta: body.meta };
}
