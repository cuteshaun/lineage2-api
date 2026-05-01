/**
 * Extracts per-quest narrative metadata from the L2 client's
 * `questname-e.dat` file. The Phase 0 schema reverse-engineering
 * (see plan: M3B Phase 0) established:
 *
 *   File: [uint32 totalRecords] then `totalRecords` step records.
 *
 *   Each step record:
 *     [uint32 fa] [uint32 fb=1] [uint32 questId] [uint32 stepIdx]
 *     [FString name]
 *     [FString stepTitle]
 *     [FString stepDescription]      // walkthrough prose, NOT exposed
 *     [variable binary block]        // coords, NPC ids, count-prefixed
 *                                    //   sub-arrays. Schema varies per
 *                                    //   record (multi-objective steps
 *                                    //   carry extra arrays).
 *     [FString completionNpc?]       // present in most records, OMITTED
 *                                    //   in some multi-objective steps.
 *     [variable binary block]
 *     [FString restrictions]         // race/class label, e.g. "Elf, Human"
 *     [FString overview]             // the per-quest replicated flavor —
 *                                    //   surfaced as `description?`
 *     [FCompactIndex classCount]
 *     [classCount × uint32 classId]
 *     [13 bytes zero pad]
 *
 *   The variable inter-FString binary blocks make a strict struct walk
 *   fragile (multi-objective quests like Q004 have two count-prefixed
 *   sub-arrays). Instead, this parser uses the OUTER structural anchor
 *   that IS reliable:
 *
 *     1. Linearly scan every valid FString in the decoded body.
 *     2. A "record start" is an FString whose preceding 16 bytes match
 *        `[uint32 fa][uint32 fb=1][uint32 questId 1..65535][uint32 step 1..100]`.
 *        With `fb=1` as the discriminator, false anchors are essentially
 *        impossible inside the variable binary blocks.
 *     3. The `description` for a record is the LAST FString before the
 *        next record's anchor — a position-independent definition that
 *        works for 5-FString records (no completionNpc), 6-FString
 *        records (standard), and 7-FString records (multi-objective).
 *
 *   Each quest has multiple step records and the overview is replicated
 *   identically across every step of the same quest, so we take it from
 *   the first step.
 *
 *   Phase 0 also concluded:
 *     - `levelMax` cannot be reliably extracted (the leading `fa` field
 *       does not behave as levelMax — Q004 has fa=138, well above any
 *       plausible cap). Dropped from M3B scope.
 *     - `clientSteps` step descriptions are walkthrough prose (e.g.
 *       "Darin of Talking Island has fallen in love with Gatekeeper
 *       Roxxy. He is too shy..."), not the structured short titles the
 *       gate rule requires. Dropped from M3B scope.
 *
 *   Final M3B public surface added by this parser: `description?` only.
 *
 *   Quest id mapping vs Java: 308/329 Java quests match the DAT id
 *   directly. The remaining 21 are minor name typos (trailing space,
 *   period, "Dreadnought"/"Dreadnoughts" plural) — the DAT id matches
 *   the Java id in every case, so we join by id, never by name.
 *
 *   Behavior gating: for chronicles whose `chronicle-sources.ts` does
 *   NOT declare `questNameDatFile`, this parser is never invoked
 *   (`build-data.ts` skips the call). For chronicles that DO declare
 *   it (Interlude), missing/unreadable/undecodable file fails the
 *   build loud — silent degradation would mask data-loss bugs.
 */

import fs from "node:fs";
import path from "node:path";
import type { Chronicle } from "../src/lib/chronicles";
import { getChronicleDataConfig } from "../src/lib/chronicle-config";
import { getChronicleSources } from "./chronicle-sources";
import { decodeVer413 } from "./lib/ver413";
import type { QuestNameRecord } from "../src/lib/types";

/**
 * Read an Unreal Engine FCompactIndex (UE2 variable-length signed
 * int) from `buf` at `pos`. Used for FString length prefixes and
 * the trailer `classCount` field.
 *
 * Layout:
 *   byte 0: [sign:1] [continue:1] [low6:6]
 *   byte n: [continue:1]            [next7:7]
 *
 * Returns the decoded value and the new cursor position.
 */
function readCompactIndex(buf: Buffer, pos: number): { value: number; next: number } | null {
  if (pos >= buf.length) return null;
  const b0 = buf[pos];
  let next = pos + 1;
  const sign = (b0 & 0x80) !== 0;
  let cont = (b0 & 0x40) !== 0;
  let val = b0 & 0x3f;
  let shift = 6;
  while (cont) {
    if (next >= buf.length) return null;
    const b = buf[next];
    next += 1;
    cont = (b & 0x80) !== 0;
    val |= (b & 0x7f) << shift;
    shift += 7;
    // Guard against pathological inputs.
    if (shift > 35) return null;
  }
  return { value: sign ? -val : val, next };
}

interface FStringHit {
  /** Byte offset of the leading FCompactIndex prefix. */
  prefix: number;
  /** First byte after the body's terminating null. */
  end: number;
  /** Decoded string (trailing null stripped). */
  text: string;
}

/**
 * Try to read a length-prefixed printable-ASCII FString at `pos`.
 * Accepts only positive lengths (UTF-16-encoded `-N` lengths do not
 * appear in this file's body — every observed string is single-byte
 * ASCII). Returns `null` when `pos` doesn't start a valid string.
 *
 * The validator is strict: every body byte must be 0x20..0x7e except
 * the terminal null. Internal nulls and high-bit bytes both fail.
 * This is what keeps false positives out of the binary inter-FString
 * blocks.
 */
function tryReadFString(buf: Buffer, pos: number): FStringHit | null {
  if (pos + 2 > buf.length) return null;
  const ci = readCompactIndex(buf, pos);
  if (!ci) return null;
  const n = ci.value;
  if (n < 2 || n > 4096) return null;
  const bodyEnd = ci.next + n;
  if (bodyEnd > buf.length) return null;
  if (buf[bodyEnd - 1] !== 0) return null;
  for (let i = ci.next; i < bodyEnd - 1; i++) {
    const b = buf[i];
    if (b < 0x20 || b > 0x7e) return null;
  }
  return {
    prefix: pos,
    end: bodyEnd,
    text: buf.subarray(ci.next, bodyEnd - 1).toString("latin1"),
  };
}

/** Linear sliding scan over the buffer for every valid FString. */
function scanAllFStrings(buf: Buffer): FStringHit[] {
  const hits: FStringHit[] = [];
  let pos = 0;
  while (pos < buf.length - 1) {
    const hit = tryReadFString(buf, pos);
    if (hit) {
      hits.push(hit);
      pos = hit.end;
    } else {
      pos += 1;
    }
  }
  return hits;
}

interface RecordAnchor {
  fsIdx: number;
  questId: number;
  step: number;
  name: string;
}

/**
 * Filter `hits` down to those whose preceding 16 bytes form a valid
 * record header `[fa][fb=1][questId 1..65535][step 1..100]`. The
 * `fb=1` literal is the discriminator that keeps false anchors out
 * of the variable binary blocks (in-block uint32s are coords, NPC
 * ids, etc. — none consistently match 1).
 */
function findRecordAnchors(buf: Buffer, hits: FStringHit[]): RecordAnchor[] {
  const anchors: RecordAnchor[] = [];
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i];
    if (h.prefix < 16) continue;
    const fb = buf.readUInt32LE(h.prefix - 12);
    if (fb !== 1) continue;
    const qid = buf.readUInt32LE(h.prefix - 8);
    if (qid < 1 || qid > 65535) continue;
    const step = buf.readUInt32LE(h.prefix - 4);
    if (step < 1 || step > 100) continue;
    anchors.push({ fsIdx: i, questId: qid, step, name: h.text });
  }
  return anchors;
}

/**
 * The per-quest "overview" is the last FString before the next
 * record's anchor (or, for the final record, the last FString in
 * the file). This definition is independent of how many strings
 * actually appear in a record (5/6/7), so multi-objective quests
 * that omit `completionNpc` parse identically to standard ones.
 */
function buildQuestNameRecords(
  buf: Buffer,
  hits: FStringHit[],
  anchors: RecordAnchor[]
): Map<number, QuestNameRecord> {
  const overviewByQuest = new Map<number, string>();
  for (let i = 0; i < anchors.length; i++) {
    const cur = anchors[i];
    const nextIdx = i + 1 < anchors.length ? anchors[i + 1].fsIdx : hits.length;
    const inter = hits.slice(cur.fsIdx + 1, nextIdx);
    if (inter.length === 0) continue;
    const overview = inter[inter.length - 1].text.trim();
    if (overview.length === 0) continue;
    // First step wins. Subsequent steps repeat the same overview, so the
    // first non-empty value is canonical.
    if (!overviewByQuest.has(cur.questId)) {
      overviewByQuest.set(cur.questId, overview);
    }
  }
  const out = new Map<number, QuestNameRecord>();
  for (const [id, description] of overviewByQuest) {
    out.set(id, { id, description });
  }
  return out;
}

/**
 * Build-time entry point. Decodes `questname-e.dat`, walks the
 * structural anchors, and emits `data/generated/<chronicle>/questname.json`.
 *
 * Skipped entirely (no warning) when the chronicle's
 * `chronicle-sources.ts` doesn't declare `questNameDatFile`.
 *
 * Fails the build loud when `questNameDatFile` IS declared but the
 * file is missing, unreadable, fails RSA decryption, or the decoded
 * body parses to zero records.
 */
export async function parseQuestName(
  chronicle: Chronicle = "interlude"
): Promise<Map<number, QuestNameRecord>> {
  const sources = getChronicleSources(chronicle);
  const dataConfig = getChronicleDataConfig(chronicle);

  if (!sources.questNameDatFile) {
    // Unconfigured chronicle — never invoked from build-data.ts in
    // this case, but defensive in case a caller invokes the parser
    // directly. Emit nothing and return an empty map.
    return new Map();
  }

  if (!fs.existsSync(sources.questNameDatFile)) {
    console.error(
      `[parse-questname] questNameDatFile is configured but missing: ${sources.questNameDatFile}`
    );
    process.exit(1);
  }

  const decoded = await decodeVer413(
    sources.questNameDatFile,
    "[parse-questname]"
  );

  const fstrings = scanAllFStrings(decoded);
  const anchors = findRecordAnchors(decoded, fstrings);

  if (anchors.length === 0) {
    console.error(
      `[parse-questname] decoded ${decoded.length} bytes from ${sources.questNameDatFile} but no record anchors matched — file may be corrupt or use a different schema.`
    );
    process.exit(1);
  }

  const records = buildQuestNameRecords(decoded, fstrings, anchors);

  // Sort by id for stable output diffs.
  const sortedEntries = Array.from(records.entries()).sort(
    ([a], [b]) => a - b
  );
  const obj: Record<string, QuestNameRecord> = {};
  for (const [id, rec] of sortedEntries) {
    obj[String(id)] = rec;
  }

  fs.mkdirSync(dataConfig.generatedDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataConfig.generatedDir, "questname.json"),
    JSON.stringify(obj, null, 2)
  );

  console.log(`[parse-questname] Done. (chronicle=${chronicle})`);
  console.log(`  Step records found:    ${anchors.length}`);
  console.log(`  Distinct quests:       ${records.size}`);

  return records;
}

if (require.main === module) {
  parseQuestName("interlude").catch((err) => {
    console.error("[parse-questname] fatal:", err);
    process.exit(1);
  });
}
