import { handleNpcDropsRequest } from "@/lib/api/drops";
import { handleCorsOptions } from "@/lib/api/responses";

// Monster drops — same response shape as `/api/[chronicle]/npcs/[id]/drops`,
// but the id must resolve to a monster (`MONSTER_NPC_TYPES`). Non-monster
// NPC ids return 404, mirroring `/api/[chronicle]/monsters/[id]`.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chronicle: string; id: string }> }
) {
  return handleNpcDropsRequest(params, { requireMonster: true });
}

export async function OPTIONS(): Promise<Response> {
  return handleCorsOptions();
}
