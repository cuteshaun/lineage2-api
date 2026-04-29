import path from "node:path";
import type { Chronicle } from "../src/lib/chronicles";

/**
 * Build-only XML source paths for a chronicle.
 *
 * These paths can escape the project root (e.g. `../aCis_382_...`) to point
 * at the upstream datapack checkout. They are intentionally separated from
 * `chronicle-config.ts` so that runtime code (route handlers, loaders) never
 * imports them — which would otherwise trigger Next.js NFT to trace files
 * outside the project.
 */
export interface ChronicleSources {
  itemsXmlDir: string;
  npcsXmlDir: string;
  /** Absolute path to `spawnlist.sql` in the upstream datapack. */
  spawnlistSqlFile: string;
  /** Absolute path to `raidboss_spawnlist.sql` in the upstream datapack. */
  raidbossSpawnlistSqlFile: string;
  /** Absolute path to `grandboss_data.sql` in the upstream datapack. */
  grandbossDataSqlFile: string;
  /**
   * Absolute paths to the three encrypted L2 client `*grp.dat` tables
   * (etcitem / weapon / armor). Source of truth for itemId → iconName.
   */
  clientGrpFiles: {
    etcitem: string;
    weapon: string;
    armor: string;
  };
  /**
   * Absolute path to the directory holding exported icon PNGs that the
   * public site serves under `/icons/`. Used at build time to resolve a
   * `iconName` to a concrete file that actually exists on disk.
   */
  iconsDir: string;
  /** Absolute path to `recipes.xml` in the upstream datapack. */
  recipesXmlFile: string;
  /** Absolute path to `armorSets.xml` in the upstream datapack. */
  armorSetsXmlFile: string;
  /** Absolute path to the `skills/` XML directory in the upstream datapack. */
  skillsXmlDir: string;
  /** Absolute path to the `multisell/` XML directory in the upstream datapack. */
  multisellXmlDir: string;
  /** Absolute path to the `classes/` XML directory in the upstream datapack. */
  classesXmlDir: string;
  /** Absolute path to `spellbooks.xml` in the upstream datapack. */
  spellbooksXmlFile: string;
  /** Absolute path to the `ClassId.java` enum (canonical class tree: id, name, race, type, level, parent). */
  classIdEnumFile: string;
  /** Absolute path to `buyLists.xml` in the upstream datapack. */
  buyListsXmlFile: string;
}

interface SourceSpec {
  itemsXmlDir: string[];
  npcsXmlDir: string[];
  spawnlistSqlFile: string[];
  raidbossSpawnlistSqlFile: string[];
  grandbossDataSqlFile: string[];
  clientGrpFiles: {
    etcitem: string[];
    weapon: string[];
    armor: string[];
  };
  iconsDir: string[];
  recipesXmlFile: string[];
  armorSetsXmlFile: string[];
  skillsXmlDir: string[];
  multisellXmlDir: string[];
  classesXmlDir: string[];
  spellbooksXmlFile: string[];
  classIdEnumFile: string[];
  buyListsXmlFile: string[];
}

const SOURCE_SPECS: Record<Chronicle, SourceSpec> = {
  interlude: {
    itemsXmlDir: [
      "..",
      "aCis_382_LATEST_STABLE",
      "aCis_datapack",
      "data",
      "xml",
      "items",
    ],
    npcsXmlDir: [
      "..",
      "aCis_382_LATEST_STABLE",
      "aCis_datapack",
      "data",
      "xml",
      "npcs",
    ],
    spawnlistSqlFile: [
      "..",
      "aCis_382_LATEST_STABLE",
      "aCis_datapack",
      "sql",
      "spawnlist.sql",
    ],
    raidbossSpawnlistSqlFile: [
      "..",
      "aCis_382_LATEST_STABLE",
      "aCis_datapack",
      "sql",
      "raidboss_spawnlist.sql",
    ],
    grandbossDataSqlFile: [
      "..",
      "aCis_382_LATEST_STABLE",
      "aCis_datapack",
      "sql",
      "grandboss_data.sql",
    ],
    clientGrpFiles: {
      etcitem: ["data", "datapack", "interlude", "etcitemgrp.dat"],
      weapon: ["data", "datapack", "interlude", "weapongrp.dat"],
      armor: ["data", "datapack", "interlude", "armorgrp.dat"],
    },
    iconsDir: ["public", "icons"],
    recipesXmlFile: [
      "..",
      "aCis_382_LATEST_STABLE",
      "aCis_datapack",
      "data",
      "xml",
      "recipes.xml",
    ],
    armorSetsXmlFile: [
      "..",
      "aCis_382_LATEST_STABLE",
      "aCis_datapack",
      "data",
      "xml",
      "armorSets.xml",
    ],
    skillsXmlDir: [
      "..",
      "aCis_382_LATEST_STABLE",
      "aCis_datapack",
      "data",
      "xml",
      "skills",
    ],
    multisellXmlDir: [
      "..",
      "aCis_382_LATEST_STABLE",
      "aCis_datapack",
      "data",
      "xml",
      "multisell",
    ],
    classesXmlDir: [
      "..",
      "aCis_382_LATEST_STABLE",
      "aCis_datapack",
      "data",
      "xml",
      "classes",
    ],
    spellbooksXmlFile: [
      "..",
      "aCis_382_LATEST_STABLE",
      "aCis_datapack",
      "data",
      "xml",
      "spellbooks.xml",
    ],
    classIdEnumFile: [
      "..",
      "aCis_382_LATEST_STABLE",
      "aCis_gameserver",
      "java",
      "net",
      "sf",
      "l2j",
      "gameserver",
      "enums",
      "actors",
      "ClassId.java",
    ],
    buyListsXmlFile: [
      "..",
      "aCis_382_LATEST_STABLE",
      "aCis_datapack",
      "data",
      "xml",
      "buyLists.xml",
    ],
  },
};

export function getChronicleSources(chronicle: Chronicle): ChronicleSources {
  const spec = SOURCE_SPECS[chronicle];
  if (!spec) {
    throw new Error(`Unknown chronicle: ${chronicle}`);
  }
  const root = process.cwd();
  return {
    itemsXmlDir: path.join(root, ...spec.itemsXmlDir),
    npcsXmlDir: path.join(root, ...spec.npcsXmlDir),
    spawnlistSqlFile: path.join(root, ...spec.spawnlistSqlFile),
    raidbossSpawnlistSqlFile: path.join(
      root,
      ...spec.raidbossSpawnlistSqlFile
    ),
    grandbossDataSqlFile: path.join(root, ...spec.grandbossDataSqlFile),
    clientGrpFiles: {
      etcitem: path.join(root, ...spec.clientGrpFiles.etcitem),
      weapon: path.join(root, ...spec.clientGrpFiles.weapon),
      armor: path.join(root, ...spec.clientGrpFiles.armor),
    },
    iconsDir: path.join(root, ...spec.iconsDir),
    recipesXmlFile: path.join(root, ...spec.recipesXmlFile),
    armorSetsXmlFile: path.join(root, ...spec.armorSetsXmlFile),
    skillsXmlDir: path.join(root, ...spec.skillsXmlDir),
    multisellXmlDir: path.join(root, ...spec.multisellXmlDir),
    classesXmlDir: path.join(root, ...spec.classesXmlDir),
    spellbooksXmlFile: path.join(root, ...spec.spellbooksXmlFile),
    classIdEnumFile: path.join(root, ...spec.classIdEnumFile),
    buyListsXmlFile: path.join(root, ...spec.buyListsXmlFile),
  };
}
