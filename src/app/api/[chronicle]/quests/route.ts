import { getAllQuests } from "@/lib/data/indexes";
import { toQuestListDto } from "@/lib/api/dto/quest";
import { jsonList, parseChronicleParam } from "@/lib/api/responses";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chronicle: string }> }
) {
  const parsed = parseChronicleParam(await params);
  if (!parsed.ok) return parsed.response;

  const dtos = getAllQuests(parsed.chronicle).map((q) =>
    toQuestListDto(q, parsed.chronicle)
  );

  return jsonList(dtos, {
    total: dtos.length,
    limit: dtos.length,
    offset: 0,
  });
}
