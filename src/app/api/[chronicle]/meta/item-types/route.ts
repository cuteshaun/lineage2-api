import { getItemTypeSummary } from "@/lib/data/indexes";
import {
  handleCorsOptions,
  jsonOk, parseChronicleParam
} from "@/lib/api/responses";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chronicle: string }> }
) {
  const parsed = parseChronicleParam(await params);
  if (!parsed.ok) return parsed.response;

  return jsonOk(getItemTypeSummary(parsed.chronicle));
}
export async function OPTIONS(): Promise<Response> {
  return handleCorsOptions();
}
