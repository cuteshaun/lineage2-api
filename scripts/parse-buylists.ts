import fs from "node:fs";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import type { BuyList, BuyListProduct } from "../src/lib/types";
import { getChronicleDataConfig } from "../src/lib/chronicle-config";
import type { Chronicle } from "../src/lib/chronicles";
import { getChronicleSources } from "./chronicle-sources";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: true,
  parseTagValue: true,
  trimValues: true,
});

function arrayify<T>(maybe: T | T[] | undefined): T[] {
  if (maybe === undefined || maybe === null) return [];
  return Array.isArray(maybe) ? maybe : [maybe];
}

export async function parseBuyLists(
  chronicle: Chronicle = "interlude"
): Promise<BuyList[]> {
  const dataConfig = getChronicleDataConfig(chronicle);
  const sources = getChronicleSources(chronicle);

  if (!fs.existsSync(sources.buyListsXmlFile)) {
    console.error(`[parse-buylists] buyLists.xml not found: ${sources.buyListsXmlFile}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(sources.buyListsXmlFile, "utf-8");
  const parsed = parser.parse(raw) as {
    list?: { buyList?: unknown };
  };

  const nodes = arrayify(parsed.list?.buyList) as Record<string, unknown>[];
  const buyLists: BuyList[] = [];
  let skipped = 0;

  for (const node of nodes) {
    const id = Number(node["@_id"]);
    const npcId = Number(node["@_npcId"]);
    // `npcId="-1"` is an aCis sentinel for admin/debug/internal lists
    // not bound to any merchant. Production data has 212 such entries
    // on Interlude; they would never surface to a player so we skip
    // them silently.
    if (!Number.isInteger(id) || !Number.isInteger(npcId) || npcId <= 0) {
      skipped++;
      continue;
    }

    const productNodes = arrayify(node.product as unknown) as Record<
      string,
      unknown
    >[];

    const products: BuyListProduct[] = [];
    for (const p of productNodes) {
      const itemId = Number(p["@_id"]);
      const price = Number(p["@_price"]);
      if (
        !Number.isInteger(itemId) ||
        itemId <= 0 ||
        !Number.isFinite(price) ||
        price < 0
      ) {
        continue;
      }
      products.push({ itemId, price });
    }

    buyLists.push({ id, npcId, products });
  }

  // Stable order: by id ascending.
  buyLists.sort((a, b) => a.id - b.id);

  fs.mkdirSync(dataConfig.generatedDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataConfig.generatedDir, "buylists.json"),
    JSON.stringify(buyLists, null, 2)
  );

  const totalProducts = buyLists.reduce((n, b) => n + b.products.length, 0);
  const distinctNpcs = new Set(buyLists.map((b) => b.npcId)).size;
  console.log(`[parse-buylists] Done. (chronicle=${chronicle})`);
  console.log(`  BuyLists:        ${buyLists.length}`);
  console.log(`  Distinct NPCs:   ${distinctNpcs}`);
  console.log(`  Total products:  ${totalProducts}`);
  if (skipped > 0) {
    console.log(`  Skipped:         ${skipped} (npcId="-1" sentinel / admin-internal entries)`);
  }

  return buyLists;
}

if (require.main === module) {
  parseBuyLists().catch(console.error);
}
