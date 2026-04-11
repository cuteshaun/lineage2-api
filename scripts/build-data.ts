import { parseItems } from "./parse-items";
import { parseNpcs } from "./parse-npcs";
import { parseDrops } from "./parse-drops";
import {
  isChronicle,
  SUPPORTED_CHRONICLES,
  type Chronicle,
} from "../src/lib/chronicles";

function parseChronicleArg(): Chronicle {
  const arg = process.argv.find((a) => a.startsWith("--chronicle="));
  if (!arg) return "interlude";

  const value = arg.slice("--chronicle=".length);
  if (!isChronicle(value)) {
    console.error(
      `[build-data] Unknown chronicle: "${value}". Supported: ${SUPPORTED_CHRONICLES.join(", ")}`
    );
    process.exit(1);
  }
  return value;
}

async function main() {
  const chronicle = parseChronicleArg();
  console.log(`[build-data] Building chronicle: ${chronicle}\n`);

  const start = Date.now();

  const items = await parseItems(chronicle);
  console.log();

  const npcs = await parseNpcs(chronicle);
  console.log();

  const drops = await parseDrops(chronicle);

  let totalCategories = 0;
  let totalDropEntries = 0;
  for (const npc of drops) {
    totalCategories += npc.categories.length;
    for (const cat of npc.categories) {
      totalDropEntries += cat.drops.length;
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`\n[build-data] Summary (chronicle=${chronicle})`);
  console.log(`  Items:           ${items.length}`);
  console.log(`  NPCs:            ${npcs.length}`);
  console.log(`  NPCs with drops: ${drops.length}`);
  console.log(`  Drop categories: ${totalCategories}`);
  console.log(`  Drop entries:    ${totalDropEntries}`);
  console.log(`  Completed in ${elapsed}s`);
}

main().catch((err) => {
  console.error("[build-data] Fatal error:", err);
  process.exit(1);
});
