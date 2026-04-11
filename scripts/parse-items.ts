import fs from "node:fs";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import type { Item, ManualFixes } from "../src/lib/types";
import { getChronicleDataConfig } from "../src/lib/chronicle-config";
import type { Chronicle } from "../src/lib/chronicles";
import { getChronicleSources } from "./chronicle-sources";

// --- XML Parser ---
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: true,
  parseTagValue: true,
  trimValues: true,
});

// --- Helpers ---

type XmlNode = Record<string, unknown>;

/** Normalize a parsed XML node that may be a single object, an array, or missing. */
function toArray(node: unknown): XmlNode[] {
  if (Array.isArray(node)) return node;
  if (node && typeof node === "object") return [node as XmlNode];
  return [];
}

/** Find a <set name="..."> and return its val as a number, or null if missing. */
function getSetNumber(sets: unknown, name: string): number | null {
  for (const s of toArray(sets)) {
    if (s["@_name"] === name) {
      const num = Number(s["@_val"]);
      return Number.isFinite(num) ? num : null;
    }
  }
  return null;
}

/** Find a <set name="..."> and return its val as a string, or null if missing. */
function getSetString(sets: unknown, name: string): string | null {
  for (const s of toArray(sets)) {
    if (s["@_name"] === name) {
      const val = s["@_val"];
      return val != null ? String(val) : null;
    }
  }
  return null;
}

/** Find a <set name="..."> and return its val as a boolean, or null if missing. */
function getSetBool(sets: unknown, name: string): boolean | null {
  const val = getSetString(sets, name);
  if (val === "true") return true;
  if (val === "false") return false;
  return null;
}

/**
 * Collect all stat entries from a <for> node.
 * Children can be <set>, <add>, <sub>, <enchant> — all with stat="..." val="...".
 * Returns a flat array of { stat, val } entries.
 */
function collectForEntries(
  forNode: unknown
): { stat: string; val: number }[] {
  if (!forNode || typeof forNode !== "object") return [];

  const results: { stat: string; val: number }[] = [];
  for (const children of Object.values(forNode as XmlNode)) {
    for (const entry of toArray(children)) {
      const stat = entry["@_stat"];
      if (typeof stat !== "string") continue;
      const num = Number(entry["@_val"]);
      if (Number.isFinite(num)) {
        results.push({ stat, val: num });
      }
    }
  }
  return results;
}

/** Get the first matching stat value from a <for> node, or null. */
function getForStat(forNode: unknown, statName: string): number | null {
  for (const e of collectForEntries(forNode)) {
    if (e.stat === statName) return e.val;
  }
  return null;
}

// Known set names that map to dedicated Item fields (not stored in properties)
const KNOWN_SET_NAMES = new Set([
  "weight",
  "price",
  "material",
  "bodypart",
  "weapon_type",
  "armor_type",
  "etcitem_type",
  "default_action",
  "is_stackable",
  "is_tradable",
  "is_dropable",
  "is_sellable",
  "soulshots",
  "spiritshots",
  "mp_consume",
  "reuse_delay",
  "item_skill",
  "is_magical",
  "crystal_count",
  "handler",
  "crystal_type",
]);

// Known stat names that map to dedicated Item fields (not stored in stats)
const KNOWN_STAT_NAMES = new Set([
  "pAtk",
  "mAtk",
  "pDef",
  "mDef",
  "rCrit",
  "pAtkSpd",
  "rShld",
  "sDef",
  "accCombat",
  "rEvas",
]);

// --- Manual Fixes ---
function loadManualFixes(manualFixesPath: string): ManualFixes {
  if (!fs.existsSync(manualFixesPath)) {
    console.error(
      `[parse-items] Manual fixes file not found: ${manualFixesPath}`
    );
    process.exit(1);
  }
  try {
    const raw = fs.readFileSync(manualFixesPath, "utf-8");
    return JSON.parse(raw) as ManualFixes;
  } catch (e) {
    console.error(`[parse-items] Failed to parse manual fixes file: ${e}`);
    process.exit(1);
  }
}

// --- Transform ---
function transformItem(
  raw: XmlNode,
  sourceFile: string
): Item | null {
  const id = Number(raw["@_id"]);
  const name = raw["@_name"];
  const type = raw["@_type"];

  if (typeof name !== "string" || name.trim() === "") return null;
  if (typeof type !== "string") return null;

  const sets = raw["set"];
  const forNode = raw["for"];

  // Grade from crystal_type, defaulting to "none"
  const crystalType = getSetString(sets, "crystal_type");
  const grade = crystalType ? crystalType.toLowerCase() : "none";

  // Build extra properties from uncommon <set> values
  const properties: Record<string, string | number | boolean> = {};
  for (const s of toArray(sets)) {
    const setName = s["@_name"];
    if (typeof setName !== "string" || KNOWN_SET_NAMES.has(setName)) continue;
    const val = s["@_val"];
    if (val === "true") properties[setName] = true;
    else if (val === "false") properties[setName] = false;
    else if (typeof val === "number") properties[setName] = val;
    else if (val != null) properties[setName] = String(val);
  }

  // Build extra stats from uncommon <for> stat entries
  const extraStats: Record<string, number> = {};
  for (const e of collectForEntries(forNode)) {
    if (!KNOWN_STAT_NAMES.has(e.stat) && !(e.stat in extraStats)) {
      extraStats[e.stat] = e.val;
    }
  }

  return {
    id,
    name,
    type: type.toLowerCase(),
    grade,
    weight: getSetNumber(sets, "weight"),
    price: getSetNumber(sets, "price"),
    material: getSetString(sets, "material"),
    bodypart: getSetString(sets, "bodypart"),
    weaponType: getSetString(sets, "weapon_type"),
    armorType: getSetString(sets, "armor_type"),
    etcItemType: getSetString(sets, "etcitem_type"),
    defaultAction: getSetString(sets, "default_action"),
    isStackable: getSetBool(sets, "is_stackable"),
    isTradable: getSetBool(sets, "is_tradable"),
    isDropable: getSetBool(sets, "is_dropable"),
    isSellable: getSetBool(sets, "is_sellable"),
    soulshots: getSetNumber(sets, "soulshots"),
    spiritshots: getSetNumber(sets, "spiritshots"),
    mpConsume: getSetNumber(sets, "mp_consume"),
    reuseDelay: getSetNumber(sets, "reuse_delay"),
    itemSkill: getSetString(sets, "item_skill"),
    isMagical: getSetBool(sets, "is_magical"),
    crystalCount: getSetNumber(sets, "crystal_count"),
    handler: getSetString(sets, "handler"),
    pAtk: getForStat(forNode, "pAtk"),
    mAtk: getForStat(forNode, "mAtk"),
    pDef: getForStat(forNode, "pDef"),
    mDef: getForStat(forNode, "mDef"),
    rCrit: getForStat(forNode, "rCrit"),
    pAtkSpd: getForStat(forNode, "pAtkSpd"),
    rShld: getForStat(forNode, "rShld"),
    sDef: getForStat(forNode, "sDef"),
    accCombat: getForStat(forNode, "accCombat"),
    rEvas: getForStat(forNode, "rEvas"),
    source: {
      project: "acis",
      chronicle: "interlude",
      file: path.basename(sourceFile),
    },
    ...(Object.keys(properties).length > 0 ? { properties } : {}),
    ...(Object.keys(extraStats).length > 0 ? { stats: extraStats } : {}),
  };
}

// --- Validation ---
function isValidItem(item: Item): boolean {
  if (typeof item.id !== "number" || !Number.isFinite(item.id) || item.id <= 0)
    return false;
  if (typeof item.name !== "string" || item.name.trim() === "") return false;
  return true;
}

// --- Apply Manual Fixes ---
function applyFixes(item: Item, fixes: ManualFixes): Item {
  const fix = fixes.items[String(item.id)];
  if (!fix) return item;
  return { ...item, ...fix };
}

// --- File discovery ---
function findXmlFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    console.error(`[parse-items] Item data directory not found: ${dir}`);
    console.error(`[parse-items] Expected XML files at: ${dir}`);
    process.exit(1);
  }

  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, {
    withFileTypes: true,
    recursive: true,
  })) {
    if (entry.isFile() && entry.name.endsWith(".xml")) {
      files.push(path.join(entry.parentPath ?? entry.path, entry.name));
    }
  }

  if (files.length === 0) {
    console.error(`[parse-items] No XML files found in: ${dir}`);
    process.exit(1);
  }

  return files.sort();
}

// --- Main ---
export async function parseItems(
  chronicle: Chronicle = "interlude"
): Promise<Item[]> {
  const dataConfig = getChronicleDataConfig(chronicle);
  const sources = getChronicleSources(chronicle);
  const fixes = loadManualFixes(dataConfig.manualFixesPath);
  const itemMap = new Map<number, Item>();
  let skipped = 0;
  let warnings = 0;
  let duplicates = 0;
  let filesProcessed = 0;

  const xmlFiles = findXmlFiles(sources.itemsXmlDir);

  for (const filePath of xmlFiles) {
    filesProcessed++;
    const xml = fs.readFileSync(filePath, "utf-8");
    const parsed = parser.parse(xml);

    const listNode = parsed?.list;
    if (!listNode || !listNode.item) {
      console.warn(
        `[parse-items] No <list><item> structure in: ${filePath}`
      );
      warnings++;
      continue;
    }

    const rawItems: XmlNode[] = Array.isArray(listNode.item)
      ? listNode.item
      : [listNode.item];

    for (const raw of rawItems) {
      const item = transformItem(raw, filePath);
      if (!item) {
        skipped++;
        continue;
      }

      if (!isValidItem(item)) {
        console.warn(
          `[parse-items] Skipping invalid item (id=${item.id}, name="${item.name}")`
        );
        skipped++;
        continue;
      }

      if (itemMap.has(item.id)) {
        console.warn(
          `[parse-items] Duplicate item id=${item.id}, overwriting with latest`
        );
        duplicates++;
      }

      itemMap.set(item.id, applyFixes(item, fixes));
    }
  }

  const items = Array.from(itemMap.values()).sort((a, b) => a.id - b.id);

  fs.mkdirSync(dataConfig.generatedDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataConfig.generatedDir, "items.json"),
    JSON.stringify(items, null, 2)
  );

  console.log(`[parse-items] Done. (chronicle=${chronicle})`);
  console.log(`  Files processed: ${filesProcessed}`);
  console.log(`  Items parsed:    ${items.length}`);
  console.log(`  Skipped:         ${skipped}`);
  console.log(`  Warnings:        ${warnings}`);
  console.log(`  Duplicates:      ${duplicates}`);

  return items;
}

// Run directly
if (require.main === module) {
  parseItems().catch(console.error);
}
