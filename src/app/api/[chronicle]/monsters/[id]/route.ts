import { getCanonicalMonsterByAnyId } from "@/lib/data/indexes";
import { toCanonicalMonsterView } from "@/lib/api/monsters";
import { jsonError, jsonOk, parseEntityParams } from "@/lib/api/responses";

// Public canonical monster detail.
//
// The `[id]` in the path may be either:
//   - a canonical id (= lowest raw id in a template group), or
//   - any raw monster id belonging to a template group
// Both resolve to the same canonical. Callers who need the raw source-faithful
// entry for a specific raw id should use `/api/[chronicle]/raw/monsters/[id]`.
//
// The response flattens the shared template onto the top level and exposes:
//   - `sameTemplateEntries`: all raw ids sharing this template
//   - `otherVariants`: canonical ids of same-name different-template monsters
// Fields that are raw-only and therefore NOT guaranteed shared across the
// group (the raw `id`, `source.file`, `properties`, `petData`) are
// deliberately omitted from the canonical view — see `lib/api/monsters.ts`
// for the full rationale.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chronicle: string; id: string }> }
) {
  const parsed = parseEntityParams(await params);
  if (!parsed.ok) return parsed.response;

  const canonical = getCanonicalMonsterByAnyId(parsed.chronicle, parsed.id);
  if (!canonical) {
    return jsonError(`Monster ${parsed.id} not found`, 404);
  }

  return jsonOk(toCanonicalMonsterView(canonical));
}
