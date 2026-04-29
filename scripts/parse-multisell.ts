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
 * Multisell files we ingest. Curated allow-list — see roadmap M2 plan
 * for category boundaries. Anything not in this list (quest exchanges,
 * SA insertion, manor crop conversion, dyes, shadow weapons, etc.) is
 * deliberately out of scope.
 *
 * File-id semantics from aCis comments:
 *   311262504 — Mammon: Unseal S-Grade Armor      (Blacksmith of Mammon)
 *   311262505 — Mammon: Unseal S-Grade Accessories
 *   311262506 — Mammon: Unseal A-Grade Armor
 *   311262507 — Mammon: Unseal A-Grade Accessories
 *   311262508 — Mammon: Reseal A-Grade Armor
 *        1002 — B-Grade Unseal                    (14 town blacksmiths)
 *        1003 — B-Grade Reseal                    (14 town blacksmiths)
 *        1235 — Apella Trader                     (clan armor; 2 traders)
 *   300974001 — Luxury Shop weapons               (Trader Galladucci)
 *   300984001 — Luxury Shop armor                 (Trader Alexandria)
 *   300984002 — Luxury Shop misc                  (Trader Alexandria)
 */
const ALLOWED_MULTISELL_IDS = [
  // Mammon
  311262504, 311262505, 311262506, 311262507, 311262508,
  // B-grade seal/unseal
  1002, 1003,
  // Clan / luxury
  1235, 300974001, 300984001, 300984002,
] as const;

/** Adena item id — used to collapse `isTaxIngredient="true"` entries into the main Adena cost. */
const ADENA_ITEM_ID = 57;

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

  // First pass: collect (itemId, count) pairs.
  const rawPairs: Array<{ itemId: number; count: number }> = [];
  for (const ing of ingredientRaw) {
    const ingNode = ing as Record<string, unknown>;
    const itemId = Number(ingNode["@_id"]);
    const count = Number(ingNode["@_count"]);
    if (!Number.isFinite(itemId) || itemId <= 0 || !Number.isFinite(count)) {
      continue;
    }
    rawPairs.push({ itemId, count });
  }

  if (rawPairs.length === 0) return null;

  // Second pass: collapse Adena ingredients (including any
  // `isTaxIngredient="true"` rows) into one summed entry. Source XML
  // can split castle tax into a separate `<ingredient id="57" count="..."
  // isTaxIngredient="true"/>` row alongside the main Adena cost; from
  // the player's perspective the total is what matters. The flag
  // itself is dropped from the public record.
  const ingredients: MultisellEntry["ingredients"] = [];
  let adenaCount = 0;
  let adenaSeen = false;
  for (const p of rawPairs) {
    if (p.itemId === ADENA_ITEM_ID) {
      adenaCount += p.count;
      adenaSeen = true;
    } else {
      ingredients.push(p);
    }
  }
  if (adenaSeen) {
    ingredients.push({ itemId: ADENA_ITEM_ID, count: adenaCount });
  }

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
  for (const id of ALLOWED_MULTISELL_IDS) {
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
