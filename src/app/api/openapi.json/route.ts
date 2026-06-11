import {
  CORS_HEADERS,
  SUCCESS_CACHE_CONTROL,
  handleCorsOptions,
} from "@/lib/api/responses";
import openApiDocument from "../../../../docs/openapi.json";

/**
 * Public OpenAPI document.
 *
 * Serves the committed artifact at `docs/openapi.json` (regenerated
 * by `pnpm openapi`), which covers every public route with its
 * parameters and response envelopes. The document is imported
 * statically so Next.js's NFT trace bundles the file
 * deterministically — no `process.cwd()` lookup, no per-request
 * filesystem read. It is checked into git so consumers see contract
 * changes in PR diffs; this route just makes the same artifact
 * reachable from a chronicle-agnostic URL alongside the rest of the
 * API.
 *
 * Chronicle-agnostic on purpose: the document describes the full
 * `/api/{chronicle}` surface as a parameterised path — every data
 * path carries an explicit `{chronicle}` path parameter against the
 * `/api` server root.
 *
 * No envelope. OpenAPI consumers expect the raw spec object as the
 * response body, not `{ data: { …spec… } }`.
 */

const headers: HeadersInit = {
  "Content-Type": "application/json",
  "Cache-Control": SUCCESS_CACHE_CONTROL,
  ...CORS_HEADERS,
};

const body = JSON.stringify(openApiDocument);

export async function GET(): Promise<Response> {
  return new Response(body, { status: 200, headers });
}

export async function OPTIONS(): Promise<Response> {
  return handleCorsOptions();
}
