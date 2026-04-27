import fs from "node:fs";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import type { Multisell, MultisellEntry } from "../src/lib/types";
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

/**
 * Mammon Blacksmith multisell files. Scope is deliberately narrow —
 * only the Seven Signs unseal / reseal flows. Any other multisell
 * (regular shops, dye merchants, generic vendors) is intentionally
 * out of scope.
 *
 * File-id semantics from aCis comments:
 *   311262504 — Unseal S-Grade Armor
 *   311262505 — Unseal S-Grade Accessories
 *   311262506 — Unseal A-Grade Armor
 *   311262507 — Unseal A-Grade Accessories
 *   311262508 — Reseal A-Grade Armor
 */
const MAMMON_MULTISELL_IDS = [
  311262504, 311262505, 311262506, 311262507, 311262508,
] as const;

function arrayify<T>(maybe: T | T[] | undefined): T[] {
  if (maybe === undefined || maybe === null) return [];
  return Array.isArray(maybe) ? maybe : [maybe];
}

function readEntry(node: Record<string, unknown>): MultisellEntry | null {
  const productionRaw = arrayify(node.production as unknown);
  const ingredientRaw = arrayify(node.ingredient as unknown);

  if (productionRaw.length !== 1) {
    // Strict 1-product contract — Mammon files all comply (verified at
    // 102/102). Any future drift surfaces here.
    return null;
  }

  const prod = productionRaw[0] as Record<string, unknown>;
  const prodId = Number(prod["@_id"]);
  const prodCount = Number(prod["@_count"]);
  if (!Number.isFinite(prodId) || prodId <= 0 || !Number.isFinite(prodCount)) {
    return null;
  }

  const ingredients: MultisellEntry["ingredients"] = [];
  for (const ing of ingredientRaw) {
    const ingNode = ing as Record<string, unknown>;
    const itemId = Number(ingNode["@_id"]);
    const count = Number(ingNode["@_count"]);
    if (!Number.isFinite(itemId) || itemId <= 0 || !Number.isFinite(count)) {
      continue;
    }
    ingredients.push({ itemId, count });
  }

  if (ingredients.length === 0) return null;

  return {
    ingredients,
    production: { itemId: prodId, count: prodCount },
  };
}

function parseFile(filePath: string, id: number): Multisell {
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = parser.parse(raw) as {
    list?: {
      "@_maintainEnchantment"?: boolean | string;
      npcs?: { npc?: number | number[] };
      item?: Record<string, unknown> | Record<string, unknown>[];
    };
  };

  const list = parsed.list;
  if (!list) {
    throw new Error(`[parse-multisell] ${id}: <list> root missing`);
  }

  const maintainEnchantment =
    list["@_maintainEnchantment"] === true ||
    list["@_maintainEnchantment"] === "true";

  const npcIds = arrayify(list.npcs?.npc).map((v) => Number(v));
  if (npcIds.length === 0 || npcIds.some((n) => !Number.isFinite(n))) {
    throw new Error(
      `[parse-multisell] ${id}: missing or malformed <npcs><npc>...</npc></npcs> block — npc→multisell join would be ambiguous`
    );
  }

  const itemNodes = arrayify(list.item) as Record<string, unknown>[];
  const entries: MultisellEntry[] = [];
  let skipped = 0;
  for (const node of itemNodes) {
    const entry = readEntry(node);
    if (entry) entries.push(entry);
    else skipped++;
  }

  if (skipped > 0) {
    console.warn(
      `[parse-multisell] ${id}: skipped ${skipped} entry/entries (multi-production or malformed)`
    );
  }

  return {
    id,
    npcIds,
    maintainEnchantment,
    entries,
  };
}

export async function parseMultisells(
  chronicle: Chronicle = "interlude"
): Promise<Multisell[]> {
  const dataConfig = getChronicleDataConfig(chronicle);
  const sources = getChronicleSources(chronicle);

  const dir = sources.multisellXmlDir;
  if (!fs.existsSync(dir)) {
    console.error(`[parse-multisell] Multisell directory not found: ${dir}`);
    process.exit(1);
  }

  const multisells: Multisell[] = [];
  for (const id of MAMMON_MULTISELL_IDS) {
    const filePath = path.join(dir, `${id}.xml`);
    if (!fs.existsSync(filePath)) {
      console.error(`[parse-multisell] Expected file missing: ${filePath}`);
      process.exit(1);
    }
    multisells.push(parseFile(filePath, id));
  }

  fs.mkdirSync(dataConfig.generatedDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataConfig.generatedDir, "multisells.json"),
    JSON.stringify(multisells, null, 2)
  );

  const totalEntries = multisells.reduce((n, m) => n + m.entries.length, 0);
  console.log(`[parse-multisell] Done. (chronicle=${chronicle})`);
  console.log(`  Files parsed:   ${multisells.length}`);
  console.log(`  Total entries:  ${totalEntries}`);
  for (const m of multisells) {
    console.log(`  ${m.id}: ${m.entries.length} entries (npcs=${m.npcIds.join(",")})`);
  }

  return multisells;
}

if (require.main === module) {
  parseMultisells().catch(console.error);
}
