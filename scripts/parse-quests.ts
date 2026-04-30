import fs from "node:fs";
import path from "node:path";
import type { Quest, QuestRewards, ClassRecord } from "../src/lib/types";
import { getChronicleDataConfig } from "../src/lib/chronicle-config";
import type { Chronicle } from "../src/lib/chronicles";
import { getChronicleSources } from "./chronicle-sources";

/**
 * Adena item id — surfaced separately as `rewards.adena` rather than
 * mixed into `rewards.items[]` for player-facing clarity.
 */
const ADENA_ITEM_ID = 57;

/**
 * Lexical-proximity window for reward extraction. A `giveItems` /
 * `rewardItems` / `rewardExpAndSp` call counts as a final reward iff
 * it appears within this many lines of an `exitQuest(...)` call in
 * the same file. Tunable; 20-back/5-forward fits the typical aCis
 * quest's terminal block where the closing dialogue gives items right
 * before exiting.
 */
const PROXIMITY_BACK = 20;
const PROXIMITY_FORWARD = 5;

interface ParseContext {
  /** Numeric value table keyed by the Java symbol name (`DARIN` → 30048). */
  constants: Map<string, number>;
  /** ClassId enum symbol → numeric class id (loaded from classes.json). */
  classIds: Map<string, number>;
}

/** Resolve a token: numeric literal or a Java constant symbol from the file. */
function resolveSymbol(token: string, ctx: ParseContext): number | null {
  const t = token.trim();
  if (/^-?\d+$/.test(t)) return Number(t);
  if (ctx.constants.has(t)) return ctx.constants.get(t)!;
  return null;
}

/**
 * Split a Java argument list (the inside of `addTalkId(...)`) into
 * tokens, ignoring comments. Args separated by commas at the top
 * level — there are no nested parens in the registration calls we
 * care about, so a flat split suffices.
 */
function splitArgs(args: string): string[] {
  return args
    .replace(/\/\*.*?\*\//g, "")
    .split(",")
    .map((s) => s.replace(/\/\/.*$/, "").trim())
    .filter((s) => s.length > 0);
}

function resolveAll(args: string, ctx: ParseContext): number[] {
  const out: number[] = [];
  for (const tok of splitArgs(args)) {
    const v = resolveSymbol(tok, ctx);
    if (v !== null && v > 0) out.push(v);
  }
  return out;
}

function dedupe(xs: number[]): number[] {
  return [...new Set(xs)].sort((a, b) => a - b);
}

/** Build a numeric-line index (1-based) for each char offset in the source. */
function buildLineMap(src: string): number[] {
  const offsets: number[] = [0];
  for (let i = 0; i < src.length; i++) {
    if (src.charCodeAt(i) === 10 /* \n */) offsets.push(i + 1);
  }
  return offsets;
}

function offsetToLine(offsets: number[], pos: number): number {
  // Binary search for the largest entry <= pos.
  let lo = 0;
  let hi = offsets.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (offsets[mid] <= pos) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

interface RawCall {
  pos: number;
  line: number;
  args: string;
}

function findAllCalls(
  src: string,
  lineMap: number[],
  re: RegExp
): RawCall[] {
  const out: RawCall[] = [];
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  while ((m = re.exec(src)) !== null) {
    out.push({
      pos: m.index,
      line: offsetToLine(lineMap, m.index),
      args: m[1] ?? "",
    });
  }
  return out;
}

function parseQuestFile(
  filePath: string,
  ctx: { classIds: Map<string, number> }
): Quest | null {
  const src = fs.readFileSync(filePath, "utf-8");
  const lineMap = buildLineMap(src);

  // Quest header — `super(id, "name")`. First match wins (constructor).
  const header = src.match(/super\(\s*(\d+)\s*,\s*"([^"]+)"\s*\)/);
  if (!header) return null;
  const id = Number(header[1]);
  const name = header[2];

  // Constants table for symbol resolution within this file.
  const constants = new Map<string, number>();
  const constRe = /private\s+static\s+final\s+int\s+(\w+)\s*=\s*(-?\d+)\s*;/g;
  for (let m: RegExpExecArray | null; (m = constRe.exec(src)) !== null; ) {
    constants.set(m[1], Number(m[2]));
  }

  const fileCtx: ParseContext = { constants, classIds: ctx.classIds };

  // setItemsIds(...) at the top of the constructor — quest-tracked items.
  const setItemsMatch = src.match(/setItemsIds\(\s*([^)]*)\)/);
  const questItemIds = setItemsMatch ? dedupe(resolveAll(setItemsMatch[1], fileCtx)) : [];

  // addStartNpc / addTalkId / addKillId — multi-arg, multi-line possible.
  const startNpcIds = dedupe(
    findAllCalls(src, lineMap, /addStartNpc\(\s*([\s\S]*?)\)/g).flatMap((c) =>
      resolveAll(c.args, fileCtx)
    )
  );
  const talkNpcIds = dedupe(
    findAllCalls(src, lineMap, /addTalkId\(\s*([\s\S]*?)\)/g).flatMap((c) =>
      resolveAll(c.args, fileCtx)
    )
  );
  const killNpcIds = dedupe(
    findAllCalls(src, lineMap, /addKillId\(\s*([\s\S]*?)\)/g).flatMap((c) =>
      resolveAll(c.args, fileCtx)
    )
  );

  // exitQuest(true|false) — repeatable flag. First match wins.
  const exitMatch = src.match(/exitQuest\(\s*(true|false)\s*\)/);
  const repeatable = exitMatch ? exitMatch[1] === "true" : null;

  // Min level — smallest N seen in `getLevel() < N`.
  let levelMin: number | null = null;
  const lvlRe = /\.getLevel\(\)\s*<\s*(\d+)/g;
  for (let m: RegExpExecArray | null; (m = lvlRe.exec(src)) !== null; ) {
    const v = Number(m[1]);
    if (levelMin === null || v < levelMin) levelMin = v;
  }

  // Race restrictions — `getRace() ==/!= ClassRace.X`.
  const raceRestrictions: string[] = [];
  const raceRe = /\.getRace\(\)\s*(==|!=)\s*ClassRace\.([A-Z_]+)/g;
  const raceSeen = new Set<string>();
  for (let m: RegExpExecArray | null; (m = raceRe.exec(src)) !== null; ) {
    // We surface only positive race gates ("must be X"). Negative
    // gates ("must not be X") are common across many classes and
    // would clutter the public DTO. If a quest is `!=` only, we
    // leave the field empty rather than guess.
    if (m[1] === "==" && !raceSeen.has(m[2])) {
      raceSeen.add(m[2]);
      raceRestrictions.push(m[2]);
    }
  }

  // Class restrictions — `(getClassId|player.getClassId)() ==/!=/equalsOrChildOf ClassId.X`.
  const classRestrictions: number[] = [];
  const classRe =
    /getClassId\(\)\s*(?:==|equalsOrChildOf\s*\(\s*)\s*ClassId\.([A-Z_]+)/g;
  const classSymbolsSeen = new Set<string>();
  for (let m: RegExpExecArray | null; (m = classRe.exec(src)) !== null; ) {
    const sym = m[1];
    if (classSymbolsSeen.has(sym)) continue;
    const id = ctx.classIds.get(sym);
    if (id !== undefined) {
      classSymbolsSeen.add(sym);
      classRestrictions.push(id);
    }
  }
  classRestrictions.sort((a, b) => a - b);

  // Reward extraction via lexical-proximity to exitQuest. Items
  // registered via `setItemsIds` are quest-tracked transients, not
  // final rewards — the engine wipes them on `exitQuest`. Subtract
  // them from the reward list so the public DTO shows only items
  // the player actually keeps.
  const rawRewards = extractRewards(src, lineMap, fileCtx);
  const questItemSet = new Set(questItemIds);
  const rewards: QuestRewards = {
    items: rawRewards.items.filter((it) => !questItemSet.has(it.itemId)),
    adena: rawRewards.adena,
    exp: rawRewards.exp,
    sp: rawRewards.sp,
  };

  return {
    id,
    name,
    scriptFile: path.basename(filePath),
    levelMin,
    repeatable,
    raceRestrictions,
    classRestrictions,
    startNpcIds,
    talkNpcIds,
    killNpcIds,
    questItemIds,
    rewards,
  };
}

function extractRewards(
  src: string,
  lineMap: number[],
  ctx: ParseContext
): QuestRewards {
  const exitCalls = findAllCalls(src, lineMap, /exitQuest\(/g);
  if (exitCalls.length === 0) {
    return { items: [], adena: null, exp: null, sp: null };
  }

  const giveCalls = findAllCalls(
    src,
    lineMap,
    /\.(?:giveItems|rewardItems)\(\s*([^,)]+)\s*,\s*([^)]+?)\s*\)/g
  );
  const expSpCalls = findAllCalls(
    src,
    lineMap,
    /\.rewardExpAndSp\(\s*(\d+)\s*,\s*(\d+)\s*\)/g
  );

  const inWindow = (line: number): boolean =>
    exitCalls.some(
      (e) => line >= e.line - PROXIMITY_BACK && line <= e.line + PROXIMITY_FORWARD
    );

  const itemCounts = new Map<number, number>();
  let adenaTotal = 0;
  let adenaSeen = false;

  for (const c of giveCalls) {
    if (!inWindow(c.line)) continue;
    // c.args contains "ITEM_ID, COUNT" — but findAllCalls captured
    // only group 1; we need the full args string. Re-match locally.
    const m = src
      .slice(c.pos)
      .match(/\.(?:giveItems|rewardItems)\(\s*([^,)]+)\s*,\s*([^)]+?)\s*\)/);
    if (!m) continue;
    const itemId = resolveSymbol(m[1], ctx);
    const count = resolveSymbol(m[2], ctx);
    if (itemId === null || count === null || count <= 0) continue;
    if (itemId === ADENA_ITEM_ID) {
      adenaTotal += count;
      adenaSeen = true;
    } else {
      itemCounts.set(itemId, (itemCounts.get(itemId) ?? 0) + count);
    }
  }

  let exp: number | null = null;
  let sp: number | null = null;
  for (const c of expSpCalls) {
    if (!inWindow(c.line)) continue;
    const m = src
      .slice(c.pos)
      .match(/\.rewardExpAndSp\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
    if (!m) continue;
    exp = (exp ?? 0) + Number(m[1]);
    sp = (sp ?? 0) + Number(m[2]);
  }

  const items = [...itemCounts.entries()]
    .map(([itemId, count]) => ({ itemId, count }))
    .sort((a, b) => a.itemId - b.itemId);

  return {
    items,
    adena: adenaSeen ? adenaTotal : null,
    exp,
    sp,
  };
}

export async function parseQuests(
  chronicle: Chronicle = "interlude"
): Promise<Quest[]> {
  const dataConfig = getChronicleDataConfig(chronicle);
  const sources = getChronicleSources(chronicle);

  if (!fs.existsSync(sources.questsScriptsDir)) {
    console.error(
      `[parse-quests] Quest scripts directory not found: ${sources.questsScriptsDir}`
    );
    process.exit(1);
  }

  // Load classes.json for ClassId.X → numeric resolution. The classes
  // parser must run before us in build-data.ts.
  const classesJsonPath = path.join(dataConfig.generatedDir, "classes.json");
  if (!fs.existsSync(classesJsonPath)) {
    console.error(
      `[parse-quests] classes.json not found at ${classesJsonPath} — run parse-classes before parse-quests`
    );
    process.exit(1);
  }
  const classes = JSON.parse(fs.readFileSync(classesJsonPath, "utf-8")) as ClassRecord[];
  // Class symbol mapping — use upper-case underscore form derived from
  // the canonical name. The aCis ClassId.java enum uses "WARRIOR" /
  // "HUMAN_FIGHTER" etc., which matches `name.toUpperCase().replace(/[ ']/g, "_")`.
  // Special case: "Human Knight" enum is named `KNIGHT`, etc. — see
  // ClassId.java for the canonical names. We build the map by reading
  // the same file.
  const classIds = await loadClassIdSymbolMap(sources.classIdEnumFile, classes);

  const fileCtx = { classIds };

  const fileNames = fs
    .readdirSync(sources.questsScriptsDir)
    .filter((f) => /^Q\d+_[A-Za-z0-9_]+\.java$/.test(f))
    .sort();

  const quests: Quest[] = [];
  let skipped = 0;
  for (const fileName of fileNames) {
    const q = parseQuestFile(
      path.join(sources.questsScriptsDir, fileName),
      fileCtx
    );
    if (q) quests.push(q);
    else skipped++;
  }
  quests.sort((a, b) => a.id - b.id);

  fs.mkdirSync(dataConfig.generatedDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataConfig.generatedDir, "quests.json"),
    JSON.stringify(quests, null, 2)
  );

  const withRewards = quests.filter(
    (q) =>
      q.rewards.items.length > 0 ||
      q.rewards.adena !== null ||
      q.rewards.exp !== null ||
      q.rewards.sp !== null
  ).length;
  const withClassGate = quests.filter((q) => q.classRestrictions.length > 0).length;
  const withRaceGate = quests.filter((q) => q.raceRestrictions.length > 0).length;
  const withMinLvl = quests.filter((q) => q.levelMin !== null).length;

  console.log(`[parse-quests] Done. (chronicle=${chronicle})`);
  console.log(`  Quests parsed:    ${quests.length} (${skipped} files skipped — no quest header)`);
  console.log(`  with min level:   ${withMinLvl}`);
  console.log(`  with race gate:   ${withRaceGate}`);
  console.log(`  with class gate:  ${withClassGate}`);
  console.log(`  with any reward:  ${withRewards}`);

  return quests;
}

/**
 * Build the ClassId-symbol → numeric-class-id map by parsing
 * `ClassId.java` (we already do this in parse-classes.ts; here we
 * load a tiny subset for the regex resolver). The map associates
 * the Java enum constant name (e.g. `"HUMAN_FIGHTER"`, `"DUELIST"`)
 * with its `ordinal()` value (which is the canonical class id).
 */
async function loadClassIdSymbolMap(
  classIdEnumFile: string,
  _classes: ClassRecord[]
): Promise<Map<string, number>> {
  const src = fs.readFileSync(classIdEnumFile, "utf-8");
  const re =
    /^\s*([A-Z_][A-Z0-9_]*)\(\s*(?:ClassRace\.[A-Z_]+|null)\s*,\s*(?:ClassType\.[A-Z_]+|null)\s*,\s*-?\d+\s*,\s*"[^"]+"\s*,\s*(?:[A-Z_][A-Z0-9_]*|null)\s*\)\s*[,;]/gm;
  const map = new Map<string, number>();
  let ordinal = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    map.set(m[1], ordinal);
    ordinal++;
  }
  return map;
}

if (require.main === module) {
  parseQuests().catch(console.error);
}
