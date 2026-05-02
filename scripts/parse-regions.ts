/**
 * Parses `data/xml/mapRegions.xml` from the upstream aCis datapack
 * into a compact `regions.json` artifact for runtime consumption.
 *
 * Two pieces are extracted:
 *
 *   1. **Names**: the 19 regions are listed in a leading XML comment
 *      block (`0 = Talking Island Village`, …, `18 = Primeval Isle`).
 *      We parse them with a single regex; this is the canonical name
 *      list since the `<map>` rows themselves only carry numeric ids.
 *
 *   2. **Grid**: each `<map geoY="…" geoX_16="…" geoX_17="…" …/>`
 *      row binds a (geoX, geoY) tile to a region id. The XML attribute
 *      labels (`geoX_16` … `geoX_26`, `geoY=10` … `geoY=25`) are just
 *      labels — the engine's
 *      [MapRegionData.java](../aCis_382_LATEST_STABLE/aCis_gameserver/java/net/sf/l2j/gameserver/data/xml/MapRegionData.java)
 *      stores them at internal indices `rX = label - 16` and
 *      `rY = label - 10`, then looks up via:
 *
 *        rX = (worldX >> 15) + 4
 *        rY = (worldY >> 15) + 8
 *
 *      We mirror the same internal-index convention so the runtime
 *      lookup is a single array index — no per-call subtraction. The
 *      `originX`/`originY` constants are stored alongside the grid
 *      so the runtime code stays chronicle-agnostic; if a future
 *      chronicle ships a different geodata layout, only the artifact
 *      changes.
 *
 * Behavior gating mirrors `parse-questname.ts`:
 *   - `mapRegionsXmlFile` configured + present → emit `regions.json`.
 *   - configured + missing/unreadable → `process.exit(1)` with a
 *     descriptive error.
 *   - not configured → return `null`; caller (`build-data.ts`) skips.
 */

import fs from "node:fs";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import type { Chronicle } from "../src/lib/chronicles";
import { getChronicleDataConfig } from "../src/lib/chronicle-config";
import { getChronicleSources } from "./chronicle-sources";
import type { Region, RegionGrid, RegionsArtifact } from "../src/lib/types";

/**
 * Internal-index origin matching `MapRegionData.java`. Stored in
 * the artifact so the runtime helper doesn't hard-code the values.
 */
const ORIGIN_X = 4;
const ORIGIN_Y = 8;
/**
 * Where the `<map>` row's `geoX_NN` attribute label starts. The
 * engine subtracts this to convert the label to an array index.
 */
const GEOX_LABEL_OFFSET = 16;
const GEOY_LABEL_OFFSET = 10;

/** Tolerant attribute reader for fast-xml-parser raw attribute objects. */
type XmlAttrs = Record<string, string | number>;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: false, // we want raw strings — easier to validate
  trimValues: true,
});

function parseNamesFromComment(xml: string): Region[] {
  // The leading comment block starts with "Here are the following
  // values of region" and lists `<id> = <name>` per line. Extract
  // every such line until the closing `-->`.
  const commentMatch = xml.match(
    /<!--\s*Here are the following values of region([\s\S]*?)-->/
  );
  if (!commentMatch) {
    throw new Error(
      "[parse-regions] could not locate the leading region-name comment block"
    );
  }
  const body = commentMatch[1];
  const regions: Region[] = [];
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/^\s*(\d+)\s*=\s*(.+?)\s*$/);
    if (!m) continue;
    const id = Number(m[1]);
    const name = m[2].trim();
    if (!Number.isInteger(id) || id < 0 || name.length === 0) continue;
    regions.push({ id, name });
  }
  if (regions.length === 0) {
    throw new Error(
      "[parse-regions] comment block parsed but no region names extracted"
    );
  }
  // Sort + dedupe defensively. Source is well-formed but cheap to verify.
  regions.sort((a, b) => a.id - b.id);
  for (let i = 1; i < regions.length; i++) {
    if (regions[i].id === regions[i - 1].id) {
      throw new Error(
        `[parse-regions] duplicate region id ${regions[i].id} in comment block`
      );
    }
  }
  return regions;
}

function parseGrid(xml: string): RegionGrid {
  const doc = xmlParser.parse(xml);
  const list = doc?.list;
  if (!list || !list.map) {
    throw new Error(
      "[parse-regions] expected <list><map>…</map></list> root structure"
    );
  }
  const mapRows: XmlAttrs[] = Array.isArray(list.map)
    ? (list.map as XmlAttrs[])
    : [list.map as XmlAttrs];

  // First pass: collect (rX, rY) -> regionId from every row.
  const cellById = new Map<string, number>();
  let minRx = Number.POSITIVE_INFINITY;
  let maxRx = Number.NEGATIVE_INFINITY;
  let minRy = Number.POSITIVE_INFINITY;
  let maxRy = Number.NEGATIVE_INFINITY;

  for (const row of mapRows) {
    const geoYStr = row["@_geoY"];
    if (geoYStr === undefined) {
      throw new Error("[parse-regions] <map> row missing geoY attribute");
    }
    const geoY = Number(geoYStr);
    if (!Number.isInteger(geoY)) {
      throw new Error(`[parse-regions] non-integer geoY: ${String(geoYStr)}`);
    }
    const rY = geoY - GEOY_LABEL_OFFSET;
    if (rY < 0) {
      throw new Error(
        `[parse-regions] geoY=${geoY} maps to negative rY (label offset is ${GEOY_LABEL_OFFSET})`
      );
    }
    for (const [key, raw] of Object.entries(row)) {
      const m = key.match(/^@_geoX_(\d+)$/);
      if (!m) continue;
      const geoX = Number(m[1]);
      if (!Number.isInteger(geoX)) continue;
      const rX = geoX - GEOX_LABEL_OFFSET;
      if (rX < 0) {
        throw new Error(
          `[parse-regions] geoX=${geoX} maps to negative rX (label offset is ${GEOX_LABEL_OFFSET})`
        );
      }
      const id = Number(raw);
      if (!Number.isInteger(id)) {
        throw new Error(
          `[parse-regions] non-integer cell value at (rX=${rX}, rY=${rY}): ${String(raw)}`
        );
      }
      cellById.set(`${rX},${rY}`, id);
      if (rX < minRx) minRx = rX;
      if (rX > maxRx) maxRx = rX;
      if (rY < minRy) minRy = rY;
      if (rY > maxRy) maxRy = rY;
    }
  }

  if (cellById.size === 0) {
    throw new Error("[parse-regions] no grid cells parsed");
  }

  // Build a dense grid that always starts at (rX=0, rY=0). This
  // matches how the engine indexes _regions[rX][rY] directly without
  // any per-lookup subtraction. Cells the XML doesn't list become -1.
  const width = maxRx + 1;
  const height = maxRy + 1;
  const cells: number[] = new Array(width * height).fill(-1);
  for (const [key, id] of cellById) {
    const [rxStr, ryStr] = key.split(",");
    const rX = Number(rxStr);
    const rY = Number(ryStr);
    cells[rY * width + rX] = id;
  }

  return { originX: ORIGIN_X, originY: ORIGIN_Y, width, height, cells };
}

function validateConsistency(regions: Region[], grid: RegionGrid): void {
  // Every regionId that appears in the grid must have a name.
  const knownIds = new Set(regions.map((r) => r.id));
  for (const id of grid.cells) {
    if (id < 0) continue;
    if (!knownIds.has(id)) {
      throw new Error(
        `[parse-regions] grid references region id ${id} which is not declared in the comment block`
      );
    }
  }
}

/**
 * Build-time entry point. Decodes `mapRegions.xml`, walks the grid,
 * and emits `data/generated/<chronicle>/regions.json`.
 *
 * Returns the artifact (so `build-data.ts` can echo a summary line)
 * or `null` when the chronicle didn't configure the source.
 */
export async function parseRegions(
  chronicle: Chronicle
): Promise<RegionsArtifact | null> {
  const sources = getChronicleSources(chronicle);
  const dataConfig = getChronicleDataConfig(chronicle);

  if (!sources.mapRegionsXmlFile) {
    // Unconfigured chronicle — caller should skip; defensive return.
    return null;
  }

  if (!fs.existsSync(sources.mapRegionsXmlFile)) {
    console.error(
      `[parse-regions] mapRegionsXmlFile is configured but missing: ${sources.mapRegionsXmlFile}`
    );
    process.exit(1);
  }

  const xml = fs.readFileSync(sources.mapRegionsXmlFile, "utf-8");
  const regions = parseNamesFromComment(xml);
  const grid = parseGrid(xml);
  validateConsistency(regions, grid);

  const artifact: RegionsArtifact = { regions, grid };

  fs.mkdirSync(dataConfig.generatedDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataConfig.generatedDir, "regions.json"),
    JSON.stringify(artifact, null, 2)
  );

  let mapped = 0;
  for (const c of grid.cells) if (c >= 0) mapped++;

  console.log(`[parse-regions] Done. (chronicle=${chronicle})`);
  console.log(`  Regions:           ${regions.length}`);
  console.log(
    `  Grid:              ${grid.width} × ${grid.height} (origin rX=${grid.originX}, rY=${grid.originY})`
  );
  console.log(
    `  Mapped cells:      ${mapped}/${grid.cells.length} (${grid.cells.length - mapped} unmapped → null at runtime)`
  );

  return artifact;
}

if (require.main === module) {
  parseRegions("interlude").catch((err) => {
    console.error("[parse-regions] fatal:", err);
    process.exit(1);
  });
}
