import fs from "node:fs";
import path from "node:path";
import { getChronicleDataConfig } from "../chronicle-config";
import type { Chronicle } from "../chronicles";
import type {
  ArmorSet,
  BuyList,
  ClassRecord,
  Henna,
  HuntingZone,
  Item,
  Multisell,
  Npc,
  NpcDrops,
  Quest,
  QuestNameRecord,
  Recipe,
  RegionsArtifact,
  Skill,
  Spawn,
  Spellbook,
} from "../types";

interface ChronicleDataset {
  items: Item[];
  npcs: Npc[];
  drops: NpcDrops[];
  spawns: Spawn[];
  recipes: Recipe[];
  armorSets: ArmorSet[];
  skills: Skill[];
  multisells: Multisell[];
  buyLists: BuyList[];
  classes: ClassRecord[];
  spellbooks: Spellbook[];
  quests: Quest[];
  /**
   * Per-quest narrative metadata from `questname-e.dat`. Empty
   * record when the chronicle doesn't ship a questname DAT — in
   * that case `QuestDetailDto.description` is simply absent.
   */
  questNames: Record<string, QuestNameRecord>;
  /**
   * Region table + tile grid from `mapRegions.xml`. `null` when
   * the chronicle doesn't ship a regions XML — in that case the
   * runtime accessors return empty list / null, and Stage 2's
   * `region` / `primaryRegion` DTO fields will all be `null`
   * for that chronicle. M4 Stage 1 emits the artifact only; the
   * public DTO surface that consumes it lands in Stage 2.
   */
  regions: RegionsArtifact | null;
  /**
   * Player-facing hunting / area locations from `huntingzone-e.dat`
   * (M7 Stage 1). Empty array when the chronicle doesn't ship the
   * DAT — in that case all `LocationRefDto` resolutions return
   * `null` / omitted. Catch-all "Territory" records were dropped
   * at parse time; only spatial (real `(x, y, z)`) zones land here.
   */
  huntingZones: HuntingZone[];
  /**
   * Henna symbol catalog joined from `hennas.xml` (mechanics) and
   * `hennagrp-e.dat` (display). Empty array when the chronicle
   * doesn't ship a hennas XML — in that case `HennaRefDto` cross-
   * links on items / classes are all omitted.
   */
  hennas: Henna[];
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

/**
 * Optional companion to `quests.json`. Falls back to `{}` when the
 * file is absent — that's the legitimate state for chronicles whose
 * `chronicle-sources.ts` doesn't declare `questNameDatFile`. (When
 * the source IS declared, `pnpm build:data` fails loud before we
 * ever reach runtime, so a configured-but-missing file never gets
 * here.)
 */
function readQuestNamesIfPresent(
  filePath: string
): Record<string, QuestNameRecord> {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<
    string,
    QuestNameRecord
  >;
}

/**
 * Optional companion to the rest of the dataset. Falls back to
 * `null` when the file is absent — that's the legitimate state for
 * chronicles whose `chronicle-sources.ts` doesn't declare
 * `mapRegionsXmlFile`. Configured-but-missing fails at build time,
 * not here.
 */
function readRegionsIfPresent(filePath: string): RegionsArtifact | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as RegionsArtifact;
}

/** Optional, like questname / regions. Empty array when absent. */
function readHuntingZonesIfPresent(filePath: string): HuntingZone[] {
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as HuntingZone[];
}

/** Optional, like questname / regions. Empty array when absent. */
function readHennasIfPresent(filePath: string): Henna[] {
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Henna[];
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
    recipes: readJson<Recipe[]>(path.join(config.generatedDir, "recipes.json")),
    armorSets: readJson<ArmorSet[]>(
      path.join(config.generatedDir, "armor-sets.json")
    ),
    skills: readJson<Skill[]>(path.join(config.generatedDir, "skills.json")),
    multisells: readJson<Multisell[]>(
      path.join(config.generatedDir, "multisells.json")
    ),
    buyLists: readJson<BuyList[]>(
      path.join(config.generatedDir, "buylists.json")
    ),
    classes: readJson<ClassRecord[]>(
      path.join(config.generatedDir, "classes.json")
    ),
    spellbooks: readJson<Spellbook[]>(
      path.join(config.generatedDir, "spellbooks.json")
    ),
    quests: readJson<Quest[]>(path.join(config.generatedDir, "quests.json")),
    questNames: readQuestNamesIfPresent(
      path.join(config.generatedDir, "questname.json")
    ),
    regions: readRegionsIfPresent(
      path.join(config.generatedDir, "regions.json")
    ),
    huntingZones: readHuntingZonesIfPresent(
      path.join(config.generatedDir, "huntingzones.json")
    ),
    hennas: readHennasIfPresent(path.join(config.generatedDir, "hennas.json")),
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
