/**
 * Local dev-only inspector for `questname-e.dat`. Decodes the
 * Lineage2Ver413 envelope, writes the raw decoded body and a
 * UTF-16LE text view alongside the source file, and prints a quick
 * summary so the developer can eyeball the schema before the
 * production parser walks records.
 *
 * Usage:
 *   pnpm exec tsx scripts/inspect-questname.ts
 *
 * Output (gitignored, see .gitignore `*.decoded.{bin,txt}`):
 *   data/datapack/interlude/questname-e.decoded.bin
 *   data/datapack/interlude/questname-e.decoded.txt
 *
 * NOT wired into `pnpm build:data`. The production parser is
 * `scripts/parse-questname.ts`, which decodes the same file at build
 * time without writing inspection artifacts.
 */
import fs from "node:fs";
import path from "node:path";
import { decodeVer413, scanUtf16Ustrings } from "./lib/ver413";
import { getChronicleSources } from "./chronicle-sources";

async function main(): Promise<void> {
  const sources = getChronicleSources("interlude");
  const datPath = sources.questNameDatFile;
  if (!datPath) {
    console.error(
      "[inspect-questname] questNameDatFile is not configured for interlude; nothing to inspect."
    );
    process.exit(1);
  }
  if (!fs.existsSync(datPath)) {
    console.error(`[inspect-questname] file not found: ${datPath}`);
    process.exit(1);
  }

  const decoded = await decodeVer413(datPath, "[inspect-questname]");

  const dir = path.dirname(datPath);
  const binOut = path.join(dir, "questname-e.decoded.bin");
  const txtOut = path.join(dir, "questname-e.decoded.txt");
  fs.writeFileSync(binOut, decoded);
  fs.writeFileSync(txtOut, decoded.toString("utf16le"));

  // Permissive scanner — quest text contains spaces/punctuation that
  // the default DEFAULT_REGEX would reject. Allow common printable
  // ASCII + curly punctuation. We only use this for inspection; the
  // production parser walks records by structural offset.
  const ustrings = scanUtf16Ustrings(decoded, {
    allowedRegex: /^[\x20-\x7e]+$/,
    minLen: 2,
    maxBytes: 4096,
  });

  console.log(`[inspect-questname] Decoded.`);
  console.log(`  Source:        ${datPath}`);
  console.log(`  Decoded size:  ${decoded.length.toLocaleString()} bytes`);
  console.log(`  Ustring hits:  ${ustrings.length}`);
  if (ustrings.length > 0) {
    const lengths = ustrings.map((u) => u.s.length).sort((a, b) => a - b);
    const median = lengths[Math.floor(lengths.length / 2)];
    const longest = lengths[lengths.length - 1];
    console.log(`  Median len:    ${median} chars`);
    console.log(`  Longest:       ${longest} chars`);
  }
  console.log(`\n  Written:`);
  console.log(`   - ${binOut} (gitignored)`);
  console.log(`   - ${txtOut} (gitignored)`);
  console.log();
  console.log("  First 12 ustrings (offset → string):");
  for (const u of ustrings.slice(0, 12)) {
    const truncated = u.s.length > 80 ? u.s.slice(0, 77) + "..." : u.s;
    console.log(`   @${u.off.toString().padStart(8)}  ${JSON.stringify(truncated)}`);
  }
  console.log();
  console.log("  Sample of strings near the middle of the file:");
  const mid = Math.floor(ustrings.length / 2);
  for (const u of ustrings.slice(mid, mid + 8)) {
    const truncated = u.s.length > 80 ? u.s.slice(0, 77) + "..." : u.s;
    console.log(`   @${u.off.toString().padStart(8)}  ${JSON.stringify(truncated)}`);
  }
}

main().catch((err) => {
  console.error("[inspect-questname] fatal:", err);
  process.exit(1);
});
