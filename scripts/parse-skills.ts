import fs from "node:fs";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import type { Skill } from "../src/lib/types";
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

type XmlNode = Record<string, unknown>;

function toArray(node: unknown): XmlNode[] {
  if (Array.isArray(node)) return node;
  if (node && typeof node === "object") return [node as XmlNode];
  return [];
}

function getStr(node: XmlNode, attr: string): string | null {
  const v = node[attr];
  if (v == null || v === "") return null;
  return String(v);
}

function getNum(node: XmlNode, attr: string): number | null {
  const v = node[attr];
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getBool(node: XmlNode, attr: string): boolean | null {
  const v = node[attr];
  if (v == null) return null;
  if (v === true || v === "true") return true;
  if (v === false || v === "false") return false;
  return null;
}

/**
 * Parse `<table>` entries into a map of name → number[].
 * Table values are space-separated inside the text content.
 */
function parseTables(skillNode: XmlNode): Map<string, number[]> {
  const tables = new Map<string, number[]>();
  for (const t of toArray(skillNode.table)) {
    const name = getStr(t, "@_name");
    const text = t["#text"];
    if (!name || text == null) continue;
    const values = String(text)
      .trim()
      .split(/\s+/)
      .map(Number)
      .filter(Number.isFinite);
    tables.set(name, values);
  }
  return tables;
}

/**
 * Resolve a `<set>` val that might reference a table (`#tableName`)
 * or be a literal value. For table refs, returns the value at the
 * given level index (0-based). Returns null if unresolvable.
 */
function resolveVal(
  raw: unknown,
  level: number,
  tables: Map<string, number[]>
): string | null {
  if (raw == null) return null;
  const s = String(raw);
  if (s.startsWith("#")) {
    const arr = tables.get(s);
    if (!arr || level >= arr.length) return null;
    return String(arr[level]);
  }
  return s;
}

/**
 * Build a map of set-name → raw val from all `<set>` children.
 */
function parseSets(skillNode: XmlNode): Map<string, unknown> {
  const sets = new Map<string, unknown>();
  for (const s of toArray(skillNode.set)) {
    const name = getStr(s, "@_name");
    const val = s["@_val"];
    if (name != null && val != null) sets.set(name, val);
  }
  return sets;
}

function parseSkillFile(absPath: string): Skill[] {
  const raw = fs.readFileSync(absPath, "utf-8");
  const parsed = parser.parse(raw);
  const nodes = toArray(parsed.list?.skill);
  const skills: Skill[] = [];

  for (const node of nodes) {
    const id = getNum(node, "@_id");
    const levels = getNum(node, "@_levels") ?? 1;
    const name = getStr(node, "@_name");
    if (id == null || name == null) continue;

    const tables = parseTables(node);
    const sets = parseSets(node);

    for (let lvl = 0; lvl < levels; lvl++) {
      const resolve = (key: string) => resolveVal(sets.get(key), lvl, tables);
      const resolveNum = (key: string): number | null => {
        const v = resolve(key);
        if (v == null) return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };

      skills.push({
        id,
        level: lvl + 1,
        name,
        operateType: resolve("operateType") ?? null,
        magicLevel: resolveNum("magicLvl"),
        mpConsume: resolveNum("mpConsume"),
        castRange: resolveNum("castRange"),
        hitTime: resolveNum("hitTime"),
        reuseDelay: resolveNum("reuseDelay"),
        isMagic: (() => {
          const v = resolve("isMagic");
          if (v === "true") return true;
          if (v === "false") return false;
          return null;
        })(),
        target: resolve("target") ?? null,
      });
    }
  }

  return skills;
}

export async function parseSkills(
  chronicle: Chronicle = "interlude"
): Promise<Skill[]> {
  const dataConfig = getChronicleDataConfig(chronicle);
  const sources = getChronicleSources(chronicle);

  const dir = sources.skillsXmlDir;
  if (!fs.existsSync(dir)) {
    console.error(`[parse-skills] Directory not found: ${dir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".xml"))
    .sort();

  const allSkills: Skill[] = [];
  for (const file of files) {
    const skills = parseSkillFile(path.join(dir, file));
    allSkills.push(...skills);
  }

  const distinctIds = new Set(allSkills.map((s) => s.id));

  fs.mkdirSync(dataConfig.generatedDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataConfig.generatedDir, "skills.json"),
    JSON.stringify(allSkills, null, 2)
  );

  console.log(`[parse-skills] Done. (chronicle=${chronicle})`);
  console.log(`  Files processed: ${files.length}`);
  console.log(`  Skills parsed:   ${allSkills.length} (id×level entries)`);
  console.log(`  Distinct IDs:    ${distinctIds.size}`);

  return allSkills;
}

if (require.main === module) {
  parseSkills().catch(console.error);
}
