import { parseItems } from "./parse-items";
import { parseNpcs } from "./parse-npcs";
import { parseDrops } from "./parse-drops";
import { parseSpawns } from "./parse-spawns";
import { parseRecipes } from "./parse-recipes";
import { parseArmorSets } from "./parse-armorsets";
import { parseSkills } from "./parse-skills";
import { parseMultisells } from "./parse-multisell";
import { parseBuyLists } from "./parse-buylists";
import { parseClasses } from "./parse-classes";
import { parseQuests } from "./parse-quests";
import { parseQuestName } from "./parse-questname";
import { getChronicleSources } from "./chronicle-sources";
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
  console.log();

  const buyLists = await parseBuyLists(chronicle);
  console.log();

  const classesResult = await parseClasses(chronicle);
  console.log();

  const quests = await parseQuests(chronicle);
  console.log();

  // questname.json is optional per chronicle. parseQuestName returns an
  // empty map when `questNameDatFile` isn't declared in chronicle-sources;
  // when it IS declared, it fails loud on missing/unreadable inputs.
  const questNameSources = getChronicleSources(chronicle);
  const questNames = questNameSources.questNameDatFile
    ? await parseQuestName(chronicle)
    : new Map();

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
  const totalBuyListProducts = buyLists.reduce(
    (n, b) => n + b.products.length,
    0
  );
  const distinctShopNpcs = new Set(buyLists.map((b) => b.npcId)).size;
  console.log(
    `  BuyLists:             ${buyLists.length} (${distinctShopNpcs} NPCs, ${totalBuyListProducts} products)`
  );
  const totalClassSkillRows = classesResult.classes.reduce(
    (n, c) => n + c.skills.length,
    0
  );
  console.log(
    `  Classes:              ${classesResult.classes.length} (${totalClassSkillRows} skill-learn rows)`
  );
  console.log(`  Spellbooks:           ${classesResult.spellbooks.length}`);
  const questsWithRewards = quests.filter(
    (q) =>
      q.rewards.items.length > 0 ||
      q.rewards.adena !== null ||
      q.rewards.exp !== null ||
      q.rewards.sp !== null
  ).length;
  console.log(
    `  Quests:               ${quests.length} (${questsWithRewards} with rewards)`
  );
  if (questNames.size > 0) {
    const javaQuestIds = new Set(quests.map((q) => q.id));
    let matchedDescriptions = 0;
    for (const id of questNames.keys()) {
      if (javaQuestIds.has(id as number)) matchedDescriptions++;
    }
    console.log(
      `  Quest descriptions:   ${matchedDescriptions}/${quests.length} (${questNames.size} DAT records, ${questNames.size - matchedDescriptions} client-only stubs ignored)`
    );
  }
  console.log(`  Completed in ${elapsed}s`);
}

main().catch((err) => {
  console.error("[build-data] Fatal error:", err);
  process.exit(1);
});
