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
}

const SOURCE_SPECS: Record<Chronicle, { itemsXmlDir: string[]; npcsXmlDir: string[] }> = {
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
  };
}
