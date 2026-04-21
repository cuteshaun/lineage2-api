import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
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
        iconFile: null, // resolved after parsing, per skill id
        description: null, // merged from skillname-e.dat after parsing
      });
    }
  }

  return skills;
}

function buildSkillIconIndex(iconsDir: string): Set<string> {
  const index = new Set<string>();
  if (!fs.existsSync(iconsDir)) return index;
  for (const entry of fs.readdirSync(iconsDir)) {
    if (entry.startsWith("skill") && entry.endsWith(".png")) {
      index.add(entry);
    }
  }
  return index;
}

function resolveSkillIcon(id: number, iconIndex: Set<string>): string | null {
  const candidate = `skill${String(id).padStart(4, "0")}.png`;
  return iconIndex.has(candidate) ? candidate : null;
}

// --- skillname-e.dat parser (client-side English names + descriptions) ---

const MOD_ORIGINAL_B64 =
  "l985hHLd9zfvCgzRfo0XLw/vFmGjiorh1ugpvBxuTDz8GSkt2p75AXXkbnOUoYhQtkF9A75u6idNPtHd5bXXvecswKC3HQNghlVjOIF5OgLJpn2e8rRet8CNS+MpCDzkUOaPeGe2dJMU1AUR0JvFdEVRuqhqidw4Ej3BZo/XLYM=";
const RSA_BLOCK = 128;

function bytesToBigInt(buf: Buffer): bigint {
  let n = 0n;
  for (const b of buf) n = (n << 8n) | BigInt(b);
  return n;
}
function bigIntToBytes(n: bigint, len: number): Buffer {
  const out = Buffer.alloc(len);
  for (let i = len - 1; i >= 0 && n > 0n; i--) {
    out[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return out;
}
function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let r = 1n;
  base %= mod;
  while (exp > 0n) {
    if (exp & 1n) r = (r * base) % mod;
    exp >>= 1n;
    base = (base * base) % mod;
  }
  return r;
}

async function decodeVer413(datPath: string): Promise<Buffer> {
  const buf = fs.readFileSync(datPath);
  const cipher = buf.subarray(28); // skip Lineage2Ver413 header
  const mod = bytesToBigInt(Buffer.from(MOD_ORIGINAL_B64, "base64"));
  const usable = cipher.length - (cipher.length % RSA_BLOCK);
  const chunks: Buffer[] = [];
  for (let off = 0; off < usable; off += RSA_BLOCK) {
    const plain = bigIntToBytes(
      modPow(bytesToBigInt(cipher.subarray(off, off + RSA_BLOCK)), 0x35n, mod),
      RSA_BLOCK
    );
    const size = plain.readUInt32BE(0);
    if (size > RSA_BLOCK - 4) throw new Error("RSA decode failed");
    chunks.push(plain.subarray(4, 4 + size));
  }
  const concat = Buffer.concat(chunks);
  return new Promise((resolve) => {
    const z = zlib.createInflate();
    const parts: Buffer[] = [];
    z.on("data", (c: Buffer) => parts.push(c));
    z.on("error", () => {});
    z.on("close", () => resolve(Buffer.concat(parts)));
    z.end(concat.subarray(4));
  });
}

function readCompactIndex(
  buf: Buffer,
  pos: number
): { val: number; pos: number } {
  let val = 0;
  let b = buf[pos++];
  const neg = b & 0x80;
  val = b & 0x3f;
  if (b & 0x40) {
    b = buf[pos++];
    val |= (b & 0x7f) << 6;
    if (b & 0x80) {
      b = buf[pos++];
      val |= (b & 0x7f) << 13;
      if (b & 0x80) {
        b = buf[pos++];
        val |= (b & 0x7f) << 20;
      }
    }
  }
  return { val: neg ? -val : val, pos };
}

function readCompactString(
  buf: Buffer,
  pos: number
): { str: string; pos: number } {
  const r = readCompactIndex(buf, pos);
  if (r.val <= 0) return { str: "", pos: r.pos };
  const str = buf
    .subarray(r.pos, r.pos + r.val)
    .toString("latin1")
    .replace(/\0+$/, "");
  return { str, pos: r.pos + r.val };
}

/**
 * Parse `skillname-e.dat` into a description lookup keyed by `"id-level"`.
 * Record format: int32 id, int32 level, compactStr name, compactStr desc,
 * then variable trailing strings (usually "none").
 */
async function parseSkillDescriptions(
  datPath: string
): Promise<Map<string, string>> {
  const decoded = await decodeVer413(datPath);
  const count = decoded.readUInt32LE(0);
  const descriptions = new Map<string, string>();
  let cursor = 4;

  for (let r = 0; r < count && cursor + 8 < decoded.length; r++) {
    const id = decoded.readInt32LE(cursor);
    const level = decoded.readInt32LE(cursor + 4);
    cursor += 8;

    if (id < 1 || id > 50000 || level < 0 || level > 500) {
      // Desync — scan forward for next valid record header
      let found = false;
      for (
        let scan = cursor;
        scan + 8 < decoded.length && scan < cursor + 3000;
        scan++
      ) {
        const tryId = decoded.readInt32LE(scan);
        const tryLv = decoded.readInt32LE(scan + 4);
        if (tryId >= 1 && tryId <= 50000 && tryLv >= 1 && tryLv <= 200) {
          const test = readCompactIndex(decoded, scan + 8);
          if (test.val > 0 && test.val < 200) {
            cursor = scan;
            found = true;
            break;
          }
        }
      }
      if (!found) break;
      continue;
    }

    const nameR = readCompactString(decoded, cursor);
    cursor = nameR.pos;
    const descR = readCompactString(decoded, cursor);
    cursor = descR.pos;

    // Skip trailing strings (extras like "none") until next record header
    while (cursor + 8 < decoded.length) {
      const nextId = decoded.readInt32LE(cursor);
      const nextLv = decoded.readInt32LE(cursor + 4);
      if (nextId >= 1 && nextId <= 50000 && nextLv >= 1 && nextLv <= 500) break;
      const exCI = readCompactIndex(decoded, cursor);
      if (exCI.val < 0 || exCI.val > 2000) break;
      cursor = exCI.pos + exCI.val;
    }

    if (descR.str) {
      descriptions.set(`${id}-${level}`, descR.str);
    }
  }

  return descriptions;
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

  const iconIndex = buildSkillIconIndex(
    path.join(process.cwd(), "public", "icons")
  );

  const allSkills: Skill[] = [];
  for (const file of files) {
    const skills = parseSkillFile(path.join(dir, file));
    allSkills.push(...skills);
  }

  // Resolve icon per skill (shared across levels of the same skill id)
  for (const skill of allSkills) {
    skill.iconFile = resolveSkillIcon(skill.id, iconIndex);
  }

  // Merge descriptions from skillname-e.dat (client-side English descriptions)
  const skillnameDat = path.join(
    process.cwd(),
    "data",
    "datapack",
    "interlude",
    "skillname-e.dat"
  );
  let descCount = 0;
  if (fs.existsSync(skillnameDat)) {
    const descriptions = await parseSkillDescriptions(skillnameDat);
    for (const skill of allSkills) {
      const desc = descriptions.get(`${skill.id}-${skill.level}`);
      if (desc) {
        skill.description = desc;
        descCount++;
      }
    }
  } else {
    console.warn(`[parse-skills] skillname-e.dat not found, skipping descriptions`);
  }

  const distinctIds = new Set(allSkills.map((s) => s.id));
  const withIcon = new Set(
    allSkills.filter((s) => s.iconFile).map((s) => s.id)
  );

  fs.mkdirSync(dataConfig.generatedDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataConfig.generatedDir, "skills.json"),
    JSON.stringify(allSkills, null, 2)
  );

  console.log(`[parse-skills] Done. (chronicle=${chronicle})`);
  console.log(`  Files processed: ${files.length}`);
  console.log(`  Skills parsed:   ${allSkills.length} (id×level entries)`);
  console.log(`  Distinct IDs:    ${distinctIds.size}`);
  console.log(`  With icon:       ${withIcon.size} distinct IDs`);
  console.log(`  With description: ${descCount}`);

  return allSkills;
}

if (require.main === module) {
  parseSkills().catch(console.error);
}
