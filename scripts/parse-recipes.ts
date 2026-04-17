import fs from "node:fs";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import type { Recipe, RecipeIngredient } from "../src/lib/types";
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

function parseItemCountPair(pair: string): { itemId: number; count: number } {
  const [idStr, countStr] = pair.split("-");
  return { itemId: Number(idStr), count: Number(countStr) };
}

function parseIngredients(material: string): RecipeIngredient[] {
  return material.split(";").map(parseItemCountPair);
}

export async function parseRecipes(
  chronicle: Chronicle = "interlude"
): Promise<Recipe[]> {
  const dataConfig = getChronicleDataConfig(chronicle);
  const sources = getChronicleSources(chronicle);

  const absPath = sources.recipesXmlFile;
  if (!fs.existsSync(absPath)) {
    console.error(`[parse-recipes] XML file not found: ${absPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(absPath, "utf-8");
  const parsed = parser.parse(raw);

  const nodes: Record<string, unknown>[] = Array.isArray(parsed.list?.recipe)
    ? parsed.list.recipe
    : parsed.list?.recipe
      ? [parsed.list.recipe]
      : [];

  const recipes: Recipe[] = [];
  let skipped = 0;

  for (const node of nodes) {
    const id = node["@_id"] as number | undefined;
    const itemId = node["@_itemId"] as number | undefined;
    const productStr = node["@_product"] as string | undefined;
    const materialStr = node["@_material"] as string | undefined;

    if (id == null || itemId == null || !productStr || !materialStr) {
      skipped++;
      continue;
    }

    const product = parseItemCountPair(productStr);
    const ingredients = parseIngredients(materialStr);

    recipes.push({
      id,
      recipeItemId: itemId,
      productItemId: product.itemId,
      productCount: product.count,
      ingredients,
      successRate: Number(node["@_successRate"] ?? 100),
      level: Number(node["@_level"] ?? 1),
      mpConsume: Number(node["@_mpConsume"] ?? 0),
      isDwarven: node["@_isDwarven"] === true || node["@_isDwarven"] === "true",
    });
  }

  fs.mkdirSync(dataConfig.generatedDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataConfig.generatedDir, "recipes.json"),
    JSON.stringify(recipes, null, 2)
  );

  console.log(`[parse-recipes] Done. (chronicle=${chronicle})`);
  console.log(`  Total recipes:  ${recipes.length}`);
  console.log(`  Skipped:        ${skipped}`);

  return recipes;
}

if (require.main === module) {
  parseRecipes().catch(console.error);
}
