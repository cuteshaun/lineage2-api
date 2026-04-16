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
  };
}
