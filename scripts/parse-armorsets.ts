import fs from "node:fs";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import type { ArmorSet } from "../src/lib/types";
import { getChronicleDataConfig } from "../src/lib/chronicle-config";
import type { Chronicle } from "../src/lib/chronicles";
import { getChronicleSources } from "./chronicle-sources";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: true,
  parseTagValue: true,
  trimValues: true,
});

/**
 * `0` is the "no piece in this slot" sentinel in armorSets.xml.
 * Translate it to `undefined` so consumers don't see zeroes in output.
 */
function piece(raw: unknown): number | undefined {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Format a skill id as the standard `"id-level"` reference. Armor-set
 * skills in this dataset are all single-level (`levels="1"`), so the
 * level is always 1. If aCis ever introduces multi-level set skills the
 * parser will need to look up the actual level from skills.json.
 */
function skillRef(rawId: unknown): string | undefined {
  const n = Number(rawId);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return `${n}-1`;
}

export async function parseArmorSets(
  chronicle: Chronicle = "interlude"
): Promise<ArmorSet[]> {
  const dataConfig = getChronicleDataConfig(chronicle);
  const sources = getChronicleSources(chronicle);

  const absPath = sources.armorSetsXmlFile;
  if (!fs.existsSync(absPath)) {
    console.error(`[parse-armorsets] XML file not found: ${absPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(absPath, "utf-8");
  const parsed = parser.parse(raw);

  const nodes: Record<string, unknown>[] = Array.isArray(parsed.list?.armorset)
    ? parsed.list.armorset
    : parsed.list?.armorset
      ? [parsed.list.armorset]
      : [];

  const sets: ArmorSet[] = [];
  let skipped = 0;
  const nameSeen = new Map<string, number>();
  const collisions: string[] = [];

  for (const [idx, node] of nodes.entries()) {
    const name = node["@_name"] as string | undefined;
    const chest = piece(node["@_chest"]);
    const bonusSkill = skillRef(node["@_skillId"]);

    if (!name || chest == null || !bonusSkill) {
      skipped++;
      continue;
    }

    const set: ArmorSet = {
      id: idx + 1,
      name,
      pieces: { chest },
      bonusSkill,
    };

    const legs = piece(node["@_legs"]);
    if (legs != null) set.pieces.legs = legs;
    const head = piece(node["@_head"]);
    if (head != null) set.pieces.head = head;
    const gloves = piece(node["@_gloves"]);
    if (gloves != null) set.pieces.gloves = gloves;
    const feet = piece(node["@_feet"]);
    if (feet != null) set.pieces.feet = feet;

    const shieldId = piece(node["@_shield"]);
    const shieldSkill = skillRef(node["@_shieldSkillId"]);
    if (shieldId != null && shieldSkill != null) {
      set.shield = { itemId: shieldId, bonusSkill: shieldSkill };
    }

    const enchant6 = skillRef(node["@_enchant6Skill"]);
    if (enchant6 != null) set.enchant6BonusSkill = enchant6;

    sets.push(set);

    const seenAt = nameSeen.get(name);
    if (seenAt != null) {
      collisions.push(`${name} (ids ${seenAt}, ${set.id})`);
    } else {
      nameSeen.set(name, set.id);
    }
  }

  fs.mkdirSync(dataConfig.generatedDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataConfig.generatedDir, "armor-sets.json"),
    JSON.stringify(sets, null, 2)
  );

  console.log(`[parse-armorsets] Done. (chronicle=${chronicle})`);
  console.log(`  Total sets:     ${sets.length}`);
  console.log(`  Skipped:        ${skipped}`);
  if (collisions.length > 0) {
    console.log(
      `  Name collisions (kept all, disambiguated by id): ${collisions.length}`
    );
    for (const c of collisions) console.log(`    ${c}`);
  }

  return sets;
}

if (require.main === module) {
  parseArmorSets().catch(console.error);
}
