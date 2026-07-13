/**
 * Server-side fetch helper for calling our own API from server components.
 *
 * The explorer UI intentionally fetches through the real HTTP API (rather
 * than importing the data layer directly) so that every page exercises the
 * public endpoint contract end-to-end.
 *
 * The base URL is derived from environment variables — NOT from the
 * incoming request's `host` header. Reading request headers (via
 * `next/headers`) would opt every page out of static rendering, forcing
 * per-request SSR with `Cache-Control: no-store` — the CDN could never
 * cache a single page. Env-based resolution keeps pages statically
 * renderable (on-demand ISR).
 *
 * IMPORTANT: never populate `generateStaticParams` with real params on
 * pages that fetch through this client. At build time the production URL
 * still serves the *previous* deployment (stale data), and local builds
 * have no server at all. On-demand ISR (empty `generateStaticParams`)
 * generates pages at request time against the current deployment.
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

/**
 * Human-readable message from a failed `apiFetch` result. 404 results
 * carry no message (`ApiNotFound`), so callers supply a fallback.
 * (`status` can't act as a TS discriminant here — `ApiError.status` is
 * a plain `number` — hence the `in` narrowing.)
 */
export function apiErrorMessage(
  result: ApiNotFound | ApiError,
  fallback: string
): string {
  return "error" in result ? result.error : fallback;
}

/**
 * Optional per-fetch cache configuration.
 *
 * - Omitted: plain fetch. On ISR/static pages it runs once at page
 *   generation; on dynamic pages it runs per request, uncached. Use for
 *   unbounded key spaces (e.g. `?q=` searches) and for all fetches on
 *   ISR pages.
 * - `{ revalidate: N }`: response is stored in the Vercel Data Cache for
 *   N seconds (persists across deployments — keep TTLs bounded). Use on
 *   dynamic pages for fetches with a bounded URL key space.
 */
export interface ApiFetchOptions {
  revalidate?: number;
}

function resolveBaseUrl(): string {
  // Explicit override — escape hatch for previews behind Vercel
  // Authentication (loop-back fetches would otherwise 401) or local
  // setups on a non-default port.
  if (process.env.EXPLORER_API_BASE_URL) {
    return process.env.EXPLORER_API_BASE_URL;
  }
  // Production: the stable production domain, not the deployment-unique
  // URL (which can sit behind deployment protection).
  if (
    process.env.VERCEL_ENV === "production" &&
    process.env.VERCEL_PROJECT_PRODUCTION_URL
  ) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  // Previews: branch alias when available, else the deployment URL.
  const vercelUrl = process.env.VERCEL_BRANCH_URL ?? process.env.VERCEL_URL;
  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

function toFetchInit(opts?: ApiFetchOptions): RequestInit | undefined {
  return opts?.revalidate != null
    ? { next: { revalidate: opts.revalidate } }
    : undefined;
}

/**
 * Fetch an API endpoint. Returns a tagged result so callers can cleanly
 * branch on 404 / other errors without throwing.
 */
export async function apiFetch<T>(
  path: string,
  opts?: ApiFetchOptions
): Promise<ApiResult<T>> {
  const url = `${resolveBaseUrl()}${path}`;

  let res: Response;
  try {
    res = await fetch(url, toFetchInit(opts));
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
  path: string,
  opts?: ApiFetchOptions
): Promise<
  | { ok: true; data: T[]; meta: ListResponse<T>["meta"] }
  | { ok: false; status: number; error: string }
> {
  const url = `${resolveBaseUrl()}${path}`;

  let res: Response;
  try {
    res = await fetch(url, toFetchInit(opts));
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
