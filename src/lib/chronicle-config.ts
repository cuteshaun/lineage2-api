import path from "node:path";
import type { Chronicle } from "./chronicles";

/**
 * Runtime data paths for a chronicle.
 *
 * These paths are statically scoped to `data/<...>` so they can be safely
 * imported from API route handlers without triggering Next.js NFT to trace
 * out-of-project files.
 *
 * For build-only source XML paths (which escape the project root), use
 * `getChronicleSources()`.
 */
export interface ChronicleDataConfig {
  /** Absolute path to the manual fixes JSON for this chronicle */
  manualFixesPath: string;
  /** Absolute path to the directory where generated JSON is written/read */
  generatedDir: string;
}

// Each chronicle's runtime paths are written as literal `path.join` calls so
// Turbopack/NFT can statically scope the trace to subfolders of the project.
function configFor(chronicle: Chronicle): ChronicleDataConfig {
  const root = process.cwd();
  switch (chronicle) {
    case "interlude":
      return {
        manualFixesPath: path.join(root, "data", "manual-fixes", "interlude.json"),
        generatedDir: path.join(root, "data", "generated", "interlude"),
      };
    default: {
      const _exhaustive: never = chronicle;
      throw new Error(`Unknown chronicle: ${_exhaustive}`);
    }
  }
}

export function getChronicleDataConfig(
  chronicle: Chronicle
): ChronicleDataConfig {
  return configFor(chronicle);
}
