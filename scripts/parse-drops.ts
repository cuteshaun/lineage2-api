import fs from "node:fs";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import type { DropEntry, NpcDropCategory, NpcDrops } from "../src/lib/types";
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

function attrNumber(node: XmlNode, key: string): number | null {
  const val = node[key];
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

// --- Parse drops for a single NPC ---
function parseNpcDrops(
  raw: XmlNode,
  sourceFile: string
): NpcDrops | null {
  const npcId = Number(raw["@_id"]);
  const npcName = raw["@_name"];

  if (!Number.isFinite(npcId) || npcId <= 0) return null;
  if (typeof npcName !== "string" || npcName.trim() === "") return null;

  const dropsNode = raw["drops"];
  if (!dropsNode || typeof dropsNode !== "object") return null;

  const categories: NpcDropCategory[] = [];

  for (const rawCat of toArray((dropsNode as XmlNode)["category"])) {
    const categoryId = attrNumber(rawCat, "@_id");

    const drops: DropEntry[] = [];
    for (const rawDrop of toArray(rawCat["drop"])) {
      const itemId = attrNumber(rawDrop, "@_itemid");
      if (itemId === null || itemId <= 0) continue;

      drops.push({
        itemId,
        min: attrNumber(rawDrop, "@_min"),
        max: attrNumber(rawDrop, "@_max"),
        chance: attrNumber(rawDrop, "@_chance"),
      });
    }

    if (drops.length > 0) {
      categories.push({ categoryId, drops });
    }
  }

  if (categories.length === 0) return null;

  return {
    npcId,
    npcName,
    categories,
    source: {
      project: "acis",
      chronicle: "interlude",
      file: path.basename(sourceFile),
    },
  };
}

// --- File discovery ---
function findXmlFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    console.error(`[parse-drops] NPC data directory not found: ${dir}`);
    console.error(`[parse-drops] Expected XML files at: ${dir}`);
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
    console.error(`[parse-drops] No XML files found in: ${dir}`);
    process.exit(1);
  }

  return files.sort();
}

// --- Optional reference validation ---
function validateReferences(
  allDrops: NpcDrops[],
  generatedDir: string
): void {
  const itemsPath = path.join(generatedDir, "items.json");
  const npcsPath = path.join(generatedDir, "npcs.json");

  let itemIds: Set<number> | null = null;
  if (fs.existsSync(itemsPath)) {
    try {
      const items = JSON.parse(fs.readFileSync(itemsPath, "utf-8")) as {
        id: number;
      }[];
      itemIds = new Set(items.map((i) => i.id));
    } catch {
      /* skip */
    }
  }

  let npcIds: Set<number> | null = null;
  if (fs.existsSync(npcsPath)) {
    try {
      const npcs = JSON.parse(fs.readFileSync(npcsPath, "utf-8")) as {
        id: number;
      }[];
      npcIds = new Set(npcs.map((n) => n.id));
    } catch {
      /* skip */
    }
  }

  if (!itemIds && !npcIds) return;

  let missingItems = 0;
  let missingNpcs = 0;
  const missingItemSet = new Set<number>();

  for (const npcDrop of allDrops) {
    if (npcIds && !npcIds.has(npcDrop.npcId)) {
      missingNpcs++;
    }
    if (itemIds) {
      for (const cat of npcDrop.categories) {
        for (const drop of cat.drops) {
          if (!itemIds.has(drop.itemId)) {
            missingItems++;
            missingItemSet.add(drop.itemId);
          }
        }
      }
    }
  }

  console.log(`  Reference check:`);
  if (npcIds) {
    console.log(`    NPC IDs not in npcs.json:       ${missingNpcs}`);
  } else {
    console.log(`    npcs.json not found, skipping NPC reference check`);
  }
  if (itemIds) {
    console.log(
      `    Drop itemIds not in items.json: ${missingItems} (${missingItemSet.size} unique)`
    );
  } else {
    console.log(`    items.json not found, skipping item reference check`);
  }
}

// --- Main ---
export async function parseDrops(
  chronicle: Chronicle = "interlude"
): Promise<NpcDrops[]> {
  const dataConfig = getChronicleDataConfig(chronicle);
  const sources = getChronicleSources(chronicle);
  const dropMap = new Map<number, NpcDrops>();
  let warnings = 0;
  let duplicates = 0;
  let filesProcessed = 0;
  let totalCategories = 0;
  let totalDropEntries = 0;

  const xmlFiles = findXmlFiles(sources.npcsXmlDir);

  for (const filePath of xmlFiles) {
    filesProcessed++;
    const xml = fs.readFileSync(filePath, "utf-8");
    const parsed = parser.parse(xml);

    const listNode = parsed?.list;
    if (!listNode || !listNode.npc) {
      console.warn(
        `[parse-drops] No <list><npc> structure in: ${filePath}`
      );
      warnings++;
      continue;
    }

    const rawNpcs: XmlNode[] = Array.isArray(listNode.npc)
      ? listNode.npc
      : [listNode.npc];

    for (const raw of rawNpcs) {
      const npcDrops = parseNpcDrops(raw, filePath);
      if (!npcDrops) continue;

      if (dropMap.has(npcDrops.npcId)) {
        console.warn(
          `[parse-drops] Duplicate npc id=${npcDrops.npcId}, overwriting`
        );
        duplicates++;
      }

      dropMap.set(npcDrops.npcId, npcDrops);
      totalCategories += npcDrops.categories.length;
      for (const cat of npcDrops.categories) {
        totalDropEntries += cat.drops.length;
      }
    }
  }

  const allDrops = Array.from(dropMap.values()).sort(
    (a, b) => a.npcId - b.npcId
  );

  fs.mkdirSync(dataConfig.generatedDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataConfig.generatedDir, "drops.json"),
    JSON.stringify(allDrops, null, 2)
  );

  console.log(`[parse-drops] Done. (chronicle=${chronicle})`);
  console.log(`  Files processed:    ${filesProcessed}`);
  console.log(`  NPCs with drops:    ${allDrops.length}`);
  console.log(`  Total categories:   ${totalCategories}`);
  console.log(`  Total drop entries: ${totalDropEntries}`);
  console.log(`  Warnings:           ${warnings}`);
  console.log(`  Duplicates:         ${duplicates}`);

  validateReferences(allDrops, dataConfig.generatedDir);

  return allDrops;
}

// Run directly
if (require.main === module) {
  parseDrops().catch(console.error);
}
