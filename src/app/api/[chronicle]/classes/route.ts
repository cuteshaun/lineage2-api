import { getAllClasses } from "@/lib/data/indexes";
import { toClassListDto } from "@/lib/api/dto/class";
import { jsonList, parseChronicleParam } from "@/lib/api/responses";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chronicle: string }> }
) {
  const parsed = parseChronicleParam(await params);
  if (!parsed.ok) return parsed.response;

  const list = getAllClasses(parsed.chronicle).map(toClassListDto);

  return jsonList(list, {
    total: list.length,
    limit: list.length,
    offset: 0,
  });
}
