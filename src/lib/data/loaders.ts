import fs from "node:fs";
import path from "node:path";
import { getChronicleDataConfig } from "../chronicle-config";
import type { Chronicle } from "../chronicles";
import type { Item, Npc, NpcDrops, Spawn } from "../types";

interface ChronicleDataset {
  items: Item[];
  npcs: Npc[];
  drops: NpcDrops[];
  spawns: Spawn[];
}

const datasetCache = new Map<Chronicle, ChronicleDataset>();

function readJson<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Generated data file missing: ${filePath}. Run \`pnpm build:data\` first.`
    );
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

export function loadChronicleDataset(chronicle: Chronicle): ChronicleDataset {
  const cached = datasetCache.get(chronicle);
  if (cached) return cached;

  const config = getChronicleDataConfig(chronicle);
  // `npcs.json` on disk is raw and does not carry merge metadata. Decorate
  // every raw NPC with `mergedIds=[id]` / `mergedCount=1` so the `Npc` shape
  // is uniform across raw and cleaned layers (the cleaned layer in
  // `cleaned-npcs.ts` will overwrite both fields on its own records).
  const rawNpcs = readJson<Npc[]>(path.join(config.generatedDir, "npcs.json"));
  for (const n of rawNpcs) {
    n.mergedIds = [n.id];
    n.mergedCount = 1;
  }
  const dataset: ChronicleDataset = {
    items: readJson<Item[]>(path.join(config.generatedDir, "items.json")),
    npcs: rawNpcs,
    drops: readJson<NpcDrops[]>(path.join(config.generatedDir, "drops.json")),
    spawns: readJson<Spawn[]>(path.join(config.generatedDir, "spawns.json")),
  };

  datasetCache.set(chronicle, dataset);
  return dataset;
}

export function loadItems(chronicle: Chronicle): Item[] {
  return loadChronicleDataset(chronicle).items;
}

export function loadNpcs(chronicle: Chronicle): Npc[] {
  return loadChronicleDataset(chronicle).npcs;
}

export function loadDrops(chronicle: Chronicle): NpcDrops[] {
  return loadChronicleDataset(chronicle).drops;
}

export function loadSpawns(chronicle: Chronicle): Spawn[] {
  return loadChronicleDataset(chronicle).spawns;
}
