import { handleNpcDropsRequest } from "@/lib/api/drops";
import { handleCorsOptions } from "@/lib/api/responses";

// Alias of `/api/[chronicle]/npcs/[id]/drops` — identical response.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chronicle: string; id: string }> }
) {
  return handleNpcDropsRequest(params);
}

export async function OPTIONS(): Promise<Response> {
  return handleCorsOptions();
}
