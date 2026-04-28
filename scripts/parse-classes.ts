import fs from "node:fs";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import type {
  ClassRecord,
  ClassSkillLearn,
  Spellbook,
} from "../src/lib/types";
import { getChronicleDataConfig } from "../src/lib/chronicle-config";
import type { Chronicle } from "../src/lib/chronicles";
import { getChronicleSources } from "./chronicle-sources";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: true,
  parseTagValue: true,
  trimValues: true,
});

/**
 * Map the raw enum values to display strings the public API uses. Race
 * is title-cased ("Dark Elf", not "DARK_ELF"). Type is title-cased too
 * but not collapsed — Priest is a real third value alongside Fighter
 * and Mystic in the Interlude class tree.
 */
const RACE_LABELS: Record<string, string> = {
  HUMAN: "Human",
  ELF: "Elf",
  DARK_ELF: "Dark Elf",
  ORC: "Orc",
  DWARF: "Dwarf",
};

const TYPE_LABELS: Record<string, string> = {
  FIGHTER: "Fighter",
  MYSTIC: "Mystic",
  PRIEST: "Priest",
};

interface ParsedEnumEntry {
  id: number;
  symbol: string;
  name: string;
  race: string;
  type: string;
  professionLevel: number;
  parentSymbol: string | null;
}

/**
 * Parse the canonical `ClassId.java` enum into a list of class entries.
 * Skips DUMMY_* placeholders (the source uses them to align ordinal ids
 * with the client-side class numbering, but they're not real classes —
 * `level=-1` and `race=null`). Parent links are resolved in a second
 * pass by symbol -> id lookup so we don't depend on declaration order.
 */
function parseClassIdEnum(filePath: string): Map<number, ParsedEnumEntry> {
  const raw = fs.readFileSync(filePath, "utf-8");
  // Match enum constructor lines like:
  //   HUMAN_FIGHTER(ClassRace.HUMAN, ClassType.FIGHTER, 0, "Human Fighter", null),
  //   GLADIATOR(ClassRace.HUMAN, ClassType.FIGHTER, 2, "Gladiator", WARRIOR),
  // Comma at the end is optional (last entry uses ';').
  const re =
    /^\s*([A-Z_][A-Z0-9_]*)\(\s*(?:ClassRace\.([A-Z_]+)|null)\s*,\s*(?:ClassType\.([A-Z_]+)|null)\s*,\s*(-?\d+)\s*,\s*"([^"]+)"\s*,\s*([A-Z_][A-Z0-9_]*|null)\s*\)\s*[,;]/gm;

  // Java enum ordinal = declaration order across ALL entries (including dummies).
  // We track that ordinal so dummies still consume an id slot, matching the
  // upstream numbering exactly. Dummies are then filtered out at the end.
  const ordinalBySymbol = new Map<string, number>();
  const entriesBySymbol = new Map<string, ParsedEnumEntry>();
  let ordinal = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(raw)) !== null) {
    const symbol = m[1];
    const raceSym = m[2] ?? null;
    const typeSym = m[3] ?? null;
    const level = Number(m[4]);
    const name = m[5];
    const parentSym = m[6] === "null" ? null : m[6];

    ordinalBySymbol.set(symbol, ordinal);

    if (raceSym !== null && typeSym !== null && level >= 0) {
      // Real class — keep.
      entriesBySymbol.set(symbol, {
        id: ordinal,
        symbol,
        name,
        race: RACE_LABELS[raceSym] ?? raceSym,
        type: TYPE_LABELS[typeSym] ?? typeSym,
        professionLevel: level,
        parentSymbol: parentSym,
      });
    }
    ordinal++;
  }

  // Resolve parent symbols to numeric ids using the ordinal table.
  const byId = new Map<number, ParsedEnumEntry>();
  for (const entry of entriesBySymbol.values()) {
    byId.set(entry.id, entry);
  }
  if (byId.size === 0) {
    throw new Error(
      `[parse-classes] No class entries parsed from ${filePath} — enum format may have changed`
    );
  }
  return byId;
}

interface XmlSkillEntry {
  skillId: number;
  skillLevel: number;
  minPlayerLevel: number;
  spCost: number;
}

interface XmlClassBlock {
  id: number;
  skills: XmlSkillEntry[];
}

function arrayify<T>(maybe: T | T[] | undefined): T[] {
  if (maybe === undefined || maybe === null) return [];
  return Array.isArray(maybe) ? maybe : [maybe];
}

/**
 * Parse one `data/xml/classes/<race><Type>.xml` file. Each file holds
 * multiple `<class>` blocks; the class id is the `id` attribute on the
 * first `<set>` child of each. We collect skill-learn entries; stat
 * tables, starting items, etc. are intentionally skipped — they're out
 * of scope for the M1 public API surface.
 */
function parseClassXmlFile(filePath: string): XmlClassBlock[] {
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = xmlParser.parse(raw) as {
    list?: { class?: unknown };
  };
  const classNodes = arrayify(parsed.list?.class) as Record<string, unknown>[];
  const blocks: XmlClassBlock[] = [];

  for (const node of classNodes) {
    const sets = arrayify(node.set as unknown) as Record<string, unknown>[];
    // The id attribute lives on the first `<set>` that carries it (the
    // canonical "id+baseLvl+fists" line).
    let classId: number | undefined;
    for (const s of sets) {
      const idAttr = s["@_id"];
      if (idAttr !== undefined) {
        classId = Number(idAttr);
        break;
      }
    }
    if (classId === undefined || !Number.isFinite(classId)) continue;

    const skillsContainer = node.skills as
      | { skill?: unknown }
      | undefined;
    const skillNodes = arrayify(skillsContainer?.skill) as Record<
      string,
      unknown
    >[];

    const skills: XmlSkillEntry[] = [];
    for (const sk of skillNodes) {
      const skillId = Number(sk["@_id"]);
      const skillLevel = Number(sk["@_lvl"]);
      const minPlayerLevel = Number(sk["@_minLvl"]);
      const spCost = Number(sk["@_cost"]);
      if (
        !Number.isFinite(skillId) ||
        !Number.isFinite(skillLevel) ||
        !Number.isFinite(minPlayerLevel) ||
        !Number.isFinite(spCost)
      ) {
        continue;
      }
      skills.push({ skillId, skillLevel, minPlayerLevel, spCost });
    }

    blocks.push({ id: classId, skills });
  }

  return blocks;
}

function parseSpellbooks(filePath: string): Spellbook[] {
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = xmlParser.parse(raw) as {
    list?: { book?: unknown };
  };
  const bookNodes = arrayify(parsed.list?.book) as Record<string, unknown>[];
  const out: Spellbook[] = [];
  for (const b of bookNodes) {
    const skillId = Number(b["@_skillId"]);
    const itemId = Number(b["@_itemId"]);
    if (
      !Number.isFinite(skillId) ||
      skillId <= 0 ||
      !Number.isFinite(itemId) ||
      itemId <= 0
    ) {
      continue;
    }
    out.push({ skillId, itemId });
  }
  // Sort for deterministic output.
  out.sort((a, b) => a.skillId - b.skillId || a.itemId - b.itemId);
  return out;
}

export async function parseClasses(
  chronicle: Chronicle = "interlude"
): Promise<{ classes: ClassRecord[]; spellbooks: Spellbook[] }> {
  const dataConfig = getChronicleDataConfig(chronicle);
  const sources = getChronicleSources(chronicle);

  if (!fs.existsSync(sources.classIdEnumFile)) {
    console.error(`[parse-classes] ClassId.java not found: ${sources.classIdEnumFile}`);
    process.exit(1);
  }
  if (!fs.existsSync(sources.classesXmlDir)) {
    console.error(`[parse-classes] Classes XML dir not found: ${sources.classesXmlDir}`);
    process.exit(1);
  }
  if (!fs.existsSync(sources.spellbooksXmlFile)) {
    console.error(`[parse-classes] spellbooks.xml not found: ${sources.spellbooksXmlFile}`);
    process.exit(1);
  }

  // 1) Canonical class metadata from the Java enum.
  const enumByid = parseClassIdEnum(sources.classIdEnumFile);

  // 2) Skill-learn entries from each class XML file.
  const xmlFiles = fs
    .readdirSync(sources.classesXmlDir)
    .filter((f) => f.endsWith(".xml"))
    .sort();

  const skillsByClassId = new Map<number, XmlSkillEntry[]>();
  for (const fileName of xmlFiles) {
    const blocks = parseClassXmlFile(
      path.join(sources.classesXmlDir, fileName)
    );
    for (const block of blocks) {
      // Merge if (somehow) the same id appears across files; in practice
      // each id is unique to one file.
      const existing = skillsByClassId.get(block.id);
      if (existing) {
        existing.push(...block.skills);
      } else {
        skillsByClassId.set(block.id, block.skills);
      }
    }
  }

  // 3) Spellbooks (skill-id -> item-id).
  const spellbooks = parseSpellbooks(sources.spellbooksXmlFile);

  // 4) Resolve parent symbols -> numeric ids and merge skill-learn.
  const symbolToId = new Map<string, number>();
  for (const e of enumByid.values()) symbolToId.set(e.symbol, e.id);

  const classes: ClassRecord[] = [];
  let missingSkillSets = 0;
  for (const e of [...enumByid.values()].sort((a, b) => a.id - b.id)) {
    const skills = skillsByClassId.get(e.id);
    if (!skills) missingSkillSets++;
    const sortedSkills: ClassSkillLearn[] = (skills ?? [])
      .map((s) => ({
        skillId: s.skillId,
        skillLevel: s.skillLevel,
        minPlayerLevel: s.minPlayerLevel,
        spCost: s.spCost,
      }))
      .sort(
        (a, b) =>
          a.skillId - b.skillId ||
          a.skillLevel - b.skillLevel ||
          a.minPlayerLevel - b.minPlayerLevel
      );

    const parentClassId =
      e.parentSymbol !== null ? (symbolToId.get(e.parentSymbol) ?? null) : null;

    classes.push({
      id: e.id,
      name: e.name,
      race: e.race,
      type: e.type,
      professionLevel: e.professionLevel,
      parentClassId,
      skills: sortedSkills,
    });
  }

  fs.mkdirSync(dataConfig.generatedDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataConfig.generatedDir, "classes.json"),
    JSON.stringify(classes, null, 2)
  );
  fs.writeFileSync(
    path.join(dataConfig.generatedDir, "spellbooks.json"),
    JSON.stringify(spellbooks, null, 2)
  );

  const totalSkillRows = classes.reduce((n, c) => n + c.skills.length, 0);
  console.log(`[parse-classes] Done. (chronicle=${chronicle})`);
  console.log(`  Classes:        ${classes.length}`);
  console.log(`  Skill-learn rows: ${totalSkillRows}`);
  console.log(`  Spellbook entries: ${spellbooks.length}`);
  if (missingSkillSets > 0) {
    console.log(
      `  Classes with no XML skill block: ${missingSkillSets} (likely 3rd-prof; expected to inherit progression from parent in-game)`
    );
  }

  return { classes, spellbooks };
}

if (require.main === module) {
  parseClasses().catch(console.error);
}
