import { getItemDroppedBy } from "@/lib/data/indexes";
import { jsonOk, parseEntityParams } from "@/lib/api/responses";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chronicle: string; id: string }> }
) {
  const parsed = parseEntityParams(await params);
  if (!parsed.ok) return parsed.response;

  const sources = getItemDroppedBy(parsed.chronicle, parsed.id);

  return jsonOk({
    sources,
    meta: { itemId: parsed.id, total: sources.length },
  });
}
