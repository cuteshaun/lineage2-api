import fs from "node:fs";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import type {
  ManualFixes,
  Npc,
  NpcSkill,
  PetData,
  PetDataStat,
} from "../src/lib/types";
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

function toArray(node: unknown): XmlNode[] {
  if (Array.isArray(node)) return node;
  if (node && typeof node === "object") return [node as XmlNode];
  return [];
}

function getSetNumber(sets: unknown, name: string): number | null {
  for (const s of toArray(sets)) {
    if (s["@_name"] === name) {
      const num = Number(s["@_val"]);
      return Number.isFinite(num) ? num : null;
    }
  }
  return null;
}

function getSetString(sets: unknown, name: string): string | null {
  for (const s of toArray(sets)) {
    if (s["@_name"] === name) {
      const val = s["@_val"];
      return val != null ? String(val) : null;
    }
  }
  return null;
}

function attrNumber(node: XmlNode, key: string): number | null {
  const val = node[key];
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

function attrBool(node: XmlNode, key: string): boolean | null {
  const val = node[key];
  if (val === true || val === "true") return true;
  if (val === false || val === "false") return false;
  return null;
}

// Known <set name="..."> keys promoted into first-class Npc fields
const KNOWN_SET_NAMES = new Set([
  "level",
  "type",
  "radius",
  "height",
  "rHand",
  "lHand",
  "exp",
  "sp",
  "hp",
  "mp",
  "hpRegen",
  "mpRegen",
  "pAtk",
  "pDef",
  "mAtk",
  "mDef",
  "crit",
  "atkSpd",
  "str",
  "int",
  "dex",
  "wit",
  "con",
  "men",
  "corpseTime",
  "walkSpd",
  "runSpd",
  "dropHerbGroup",
]);

// --- Manual Fixes ---
function loadManualFixes(manualFixesPath: string): ManualFixes {
  if (!fs.existsSync(manualFixesPath)) {
    console.error(
      `[parse-npcs] Manual fixes file not found: ${manualFixesPath}`
    );
    process.exit(1);
  }
  try {
    const raw = fs.readFileSync(manualFixesPath, "utf-8");
    return JSON.parse(raw) as ManualFixes;
  } catch (e) {
    console.error(`[parse-npcs] Failed to parse manual fixes file: ${e}`);
    process.exit(1);
  }
}

// --- Parse <skills> ---
function parseSkills(raw: XmlNode): NpcSkill[] {
  const skillsNode = raw["skills"];
  if (!skillsNode || typeof skillsNode !== "object") return [];

  const results: NpcSkill[] = [];
  for (const entry of toArray((skillsNode as XmlNode)["skill"])) {
    const id = Number(entry["@_id"]);
    const level = Number(entry["@_level"]);
    if (Number.isFinite(id) && id > 0 && Number.isFinite(level)) {
      results.push({ id, level });
    }
  }
  return results;
}

// --- Parse <petdata> ---
function parsePetData(raw: XmlNode): PetData | null {
  const pd = raw["petdata"];
  if (!pd || typeof pd !== "object") return null;

  const node = pd as XmlNode;
  const stats: PetDataStat[] = [];

  for (const s of toArray(node["stat"])) {
    const level = Number(s["@_level"]);
    if (!Number.isFinite(level)) continue;

    stats.push({
      level,
      maxMeal: attrNumber(s, "@_maxMeal"),
      exp: attrNumber(s, "@_exp"),
      expType: attrNumber(s, "@_expType"),
      mealInBattle: attrNumber(s, "@_mealInBattle"),
      mealInNormal: attrNumber(s, "@_mealInNormal"),
      pAtk: attrNumber(s, "@_pAtk"),
      pDef: attrNumber(s, "@_pDef"),
      mAtk: attrNumber(s, "@_mAtk"),
      mDef: attrNumber(s, "@_mDef"),
      hp: attrNumber(s, "@_hp"),
      mp: attrNumber(s, "@_mp"),
      hpRegen: attrNumber(s, "@_hpRegen"),
      mpRegen: attrNumber(s, "@_mpRegen"),
      ssCount: attrNumber(s, "@_ssCount"),
      spsCount: attrNumber(s, "@_spsCount"),
    });
  }

  return {
    food1: attrNumber(node, "@_food1"),
    food2: attrNumber(node, "@_food2"),
    autoFeedLimit: attrNumber(node, "@_autoFeedLimit"),
    hungryLimit: attrNumber(node, "@_hungryLimit"),
    unsummonLimit: attrNumber(node, "@_unsummonLimit"),
    stats,
  };
}

// --- Parse <ai> ---
function parseAi(raw: XmlNode): Pick<
  Npc,
  | "aiType"
  | "aiAggro"
  | "aiCanMove"
  | "aiSeedable"
  | "aiSsCount"
  | "aiSsRate"
  | "aiSpsCount"
  | "aiSpsRate"
  | "aiClan"
  | "aiClanRange"
> {
  const ai = raw["ai"];
  if (!ai || typeof ai !== "object") {
    return {
      aiType: null,
      aiAggro: null,
      aiCanMove: null,
      aiSeedable: null,
      aiSsCount: null,
      aiSsRate: null,
      aiSpsCount: null,
      aiSpsRate: null,
      aiClan: null,
      aiClanRange: null,
    };
  }

  const node = ai as XmlNode;
  return {
    aiType: node["@_type"] != null ? String(node["@_type"]) : null,
    aiAggro: attrNumber(node, "@_aggro"),
    aiCanMove: attrBool(node, "@_canMove"),
    aiSeedable: attrBool(node, "@_seedable"),
    aiSsCount: attrNumber(node, "@_ssCount"),
    aiSsRate: attrNumber(node, "@_ssRate"),
    aiSpsCount: attrNumber(node, "@_spsCount"),
    aiSpsRate: attrNumber(node, "@_spsRate"),
    aiClan: node["@_clan"] != null ? String(node["@_clan"]) : null,
    aiClanRange: attrNumber(node, "@_clanRange"),
  };
}

// --- Transform ---
function transformNpc(raw: XmlNode, sourceFile: string): Npc | null {
  const id = Number(raw["@_id"]);
  const name = raw["@_name"];

  if (typeof name !== "string" || name.trim() === "") return null;

  const rawTitle = raw["@_title"];
  const title =
    typeof rawTitle === "string" && rawTitle.trim() !== ""
      ? rawTitle
      : null;

  const sets = raw["set"];

  // Build overflow properties from uncommon <set> values
  const properties: Record<string, string | number | boolean> = {};
  for (const s of toArray(sets)) {
    const setName = s["@_name"];
    if (typeof setName !== "string" || KNOWN_SET_NAMES.has(setName)) continue;
    const val = s["@_val"];
    if (val === true || val === "true") properties[setName] = true;
    else if (val === false || val === "false") properties[setName] = false;
    else if (typeof val === "number") properties[setName] = val;
    else if (val != null) properties[setName] = String(val);
  }

  return {
    id,
    // Every raw NPC is a single-record "merge" of itself. The cleaned layer
    // in `src/lib/data/cleaned-npcs.ts` overwrites these fields on records
    // that absorb same-name siblings; raw records always see [id] / 1.
    mergedIds: [id],
    mergedCount: 1,
    name,
    title,

    level: getSetNumber(sets, "level"),
    npcType: getSetString(sets, "type"),

    radius: getSetNumber(sets, "radius"),
    height: getSetNumber(sets, "height"),
    rHand: getSetNumber(sets, "rHand"),
    lHand: getSetNumber(sets, "lHand"),

    exp: getSetNumber(sets, "exp"),
    sp: getSetNumber(sets, "sp"),

    hp: getSetNumber(sets, "hp"),
    mp: getSetNumber(sets, "mp"),
    hpRegen: getSetNumber(sets, "hpRegen"),
    mpRegen: getSetNumber(sets, "mpRegen"),

    pAtk: getSetNumber(sets, "pAtk"),
    pDef: getSetNumber(sets, "pDef"),
    mAtk: getSetNumber(sets, "mAtk"),
    mDef: getSetNumber(sets, "mDef"),
    crit: getSetNumber(sets, "crit"),
    atkSpd: getSetNumber(sets, "atkSpd"),

    str: getSetNumber(sets, "str"),
    int: getSetNumber(sets, "int"),
    dex: getSetNumber(sets, "dex"),
    wit: getSetNumber(sets, "wit"),
    con: getSetNumber(sets, "con"),
    men: getSetNumber(sets, "men"),

    corpseTime: getSetNumber(sets, "corpseTime"),
    walkSpd: getSetNumber(sets, "walkSpd"),
    runSpd: getSetNumber(sets, "runSpd"),
    dropHerbGroup: getSetNumber(sets, "dropHerbGroup"),

    ...parseAi(raw),

    skills: parseSkills(raw),
    petData: parsePetData(raw),

    source: {
      project: "acis",
      chronicle: "interlude",
      file: path.basename(sourceFile),
    },

    ...(Object.keys(properties).length > 0 ? { properties } : {}),
  };
}

// --- Validation ---
function isValidNpc(npc: Npc): boolean {
  if (typeof npc.id !== "number" || !Number.isFinite(npc.id) || npc.id <= 0)
    return false;
  if (typeof npc.name !== "string" || npc.name.trim() === "") return false;
  return true;
}

// --- Apply Manual Fixes ---
function applyFixes(npc: Npc, fixes: ManualFixes): Npc {
  const fix = fixes.npcs[String(npc.id)];
  if (!fix) return npc;
  return { ...npc, ...fix };
}

// --- File discovery ---
function findXmlFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    console.error(`[parse-npcs] NPC data directory not found: ${dir}`);
    console.error(`[parse-npcs] Expected XML files at: ${dir}`);
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
    console.error(`[parse-npcs] No XML files found in: ${dir}`);
    process.exit(1);
  }

  return files.sort();
}

// --- Main ---
export async function parseNpcs(
  chronicle: Chronicle = "interlude"
): Promise<Npc[]> {
  const dataConfig = getChronicleDataConfig(chronicle);
  const sources = getChronicleSources(chronicle);
  const fixes = loadManualFixes(dataConfig.manualFixesPath);
  const npcMap = new Map<number, Npc>();
  let skipped = 0;
  let warnings = 0;
  let duplicates = 0;
  let filesProcessed = 0;

  const xmlFiles = findXmlFiles(sources.npcsXmlDir);

  for (const filePath of xmlFiles) {
    filesProcessed++;
    const xml = fs.readFileSync(filePath, "utf-8");
    const parsed = parser.parse(xml);

    const listNode = parsed?.list;
    if (!listNode || !listNode.npc) {
      console.warn(
        `[parse-npcs] No <list><npc> structure in: ${filePath}`
      );
      warnings++;
      continue;
    }

    const rawNpcs: XmlNode[] = Array.isArray(listNode.npc)
      ? listNode.npc
      : [listNode.npc];

    for (const raw of rawNpcs) {
      const npc = transformNpc(raw, filePath);
      if (!npc) {
        skipped++;
        continue;
      }

      if (!isValidNpc(npc)) {
        console.warn(
          `[parse-npcs] Skipping invalid npc (id=${npc.id}, name="${npc.name}")`
        );
        skipped++;
        continue;
      }

      if (npcMap.has(npc.id)) {
        console.warn(
          `[parse-npcs] Duplicate npc id=${npc.id}, overwriting with latest`
        );
        duplicates++;
      }

      npcMap.set(npc.id, applyFixes(npc, fixes));
    }
  }

  const npcs = Array.from(npcMap.values()).sort((a, b) => a.id - b.id);

  fs.mkdirSync(dataConfig.generatedDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataConfig.generatedDir, "npcs.json"),
    JSON.stringify(npcs, null, 2)
  );

  console.log(`[parse-npcs] Done. (chronicle=${chronicle})`);
  console.log(`  Files processed: ${filesProcessed}`);
  console.log(`  NPCs parsed:     ${npcs.length}`);
  console.log(`  Skipped:         ${skipped}`);
  console.log(`  Warnings:        ${warnings}`);
  console.log(`  Duplicates:      ${duplicates}`);

  return npcs;
}

// Run directly
if (require.main === module) {
  parseNpcs().catch(console.error);
}
