import { parseItems } from "./parse-items";
import { parseNpcs } from "./parse-npcs";
import { parseDrops } from "./parse-drops";
import { parseSpawns } from "./parse-spawns";
import { parseRecipes } from "./parse-recipes";
import { parseArmorSets } from "./parse-armorsets";
import { parseSkills } from "./parse-skills";
import { parseMultisells } from "./parse-multisell";
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
  console.log();

  // Spawns are generated alongside the other datasets but are NOT yet
  // wired into any public API route or runtime index. First iteration is
  // foundation-only — see `parse-spawns.ts`.
  const spawns = await parseSpawns(chronicle);
  console.log();

  const recipes = await parseRecipes(chronicle);
  console.log();

  const armorSets = await parseArmorSets(chronicle);
  console.log();

  const skills = await parseSkills(chronicle);
  console.log();

  const multisells = await parseMultisells(chronicle);

  let totalCategories = 0;
  let totalDropEntries = 0;
  for (const npc of drops) {
    totalCategories += npc.categories.length;
    for (const cat of npc.categories) {
      totalDropEntries += cat.drops.length;
    }
  }
  const distinctSpawnNpcIds = new Set(spawns.map((s) => s.npcId)).size;

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`\n[build-data] Summary (chronicle=${chronicle})`);
  console.log(`  Items:                ${items.length}`);
  console.log(`  NPCs:                 ${npcs.length}`);
  console.log(`  NPCs with drops:      ${drops.length}`);
  console.log(`  Drop categories:      ${totalCategories}`);
  console.log(`  Drop entries:         ${totalDropEntries}`);
  console.log(`  Spawn rows:           ${spawns.length}`);
  console.log(`  Distinct spawn npcs:  ${distinctSpawnNpcIds}`);
  console.log(`  Recipes:              ${recipes.length}`);
  console.log(`  Armor sets:           ${armorSets.length}`);
  console.log(`  Skills:               ${skills.length}`);
  const totalMultisellEntries = multisells.reduce(
    (n, m) => n + m.entries.length,
    0
  );
  console.log(
    `  Multisells:           ${multisells.length} files, ${totalMultisellEntries} entries`
  );
  console.log(`  Completed in ${elapsed}s`);
}

main().catch((err) => {
  console.error("[build-data] Fatal error:", err);
  process.exit(1);
});
