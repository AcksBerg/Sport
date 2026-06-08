import { createId, type TableGeneratorRecipe, type TableRow, type Unit } from "@/domain";
import { roundToUnit, unitResolution } from "@/shared/utils/units";

const formulaValue = (value: number, unit: Unit, recipe: TableGeneratorRecipe) =>
  recipe.formulaValueUnit === "internal" || unit !== "time" ? value : value / 1000;

const pointStep = (recipe: TableGeneratorRecipe) => recipe.pointStep ?? 1;

export function validateGeneratorRecipe(recipe: TableGeneratorRecipe, unit: Unit = "distance") {
  if (![recipe.a, recipe.b, recipe.c, recipe.minPoints, recipe.maxPoints, recipe.minValue, recipe.maxValue, pointStep(recipe)].every(Number.isFinite))
    return "Alle Generatorwerte müssen gültige Zahlen sein.";
  if (recipe.minPoints > recipe.maxPoints || recipe.minValue >= recipe.maxValue)
    return "Punkte- und Leistungsbereich müssen aufsteigend sein.";
  if (pointStep(recipe) <= 0) return "Die Punkteschrittweite muss größer als 0 sein.";
  if (recipe.a === 0 && recipe.b === 0) return "Eine konstante Funktion kann keine Tabelle erzeugen.";
  const minValue = formulaValue(recipe.minValue, unit, recipe);
  const maxValue = formulaValue(recipe.maxValue, unit, recipe);
  if (recipe.a !== 0) {
    const vertex = -recipe.b / (2 * recipe.a);
    if (vertex > minValue && vertex < maxValue)
      return "Der Leistungsbereich überschreitet den Scheitelpunkt und ist nicht monoton.";
  }
  const midpoint = (minValue + maxValue) / 2;
  const derivative = 2 * recipe.a * midpoint + recipe.b;
  if (
    (recipe.direction === "higherIsBetter" && derivative <= 0) ||
    (recipe.direction === "lowerIsBetter" && derivative >= 0)
  )
    return "Formel und gewählte Leistungsrichtung widersprechen sich.";
  return null;
}

function score(recipe: TableGeneratorRecipe, value: number) {
  return recipe.a * value * value + recipe.b * value + recipe.c;
}

export function generateTableRows(recipe: TableGeneratorRecipe, unit: Unit): TableRow[] {
  const error = validateGeneratorRecipe(recipe, unit);
  if (error) throw new Error(error);
  const resolution = unitResolution(unit);
  const step = pointStep(recipe);
  const decimals = Math.max(0, `${step}`.split(".")[1]?.length ?? 0);
  const buckets = new Map<number, number[]>();
  for (let value = recipe.minValue; value <= recipe.maxValue + resolution / 2; value += resolution) {
    const points = Number((Math.round(score(recipe, formulaValue(value, unit, recipe)) / step) * step).toFixed(decimals));
    if (points < recipe.minPoints - step / 2 || points > recipe.maxPoints + step / 2) continue;
    buckets.set(points, [...(buckets.get(points) ?? []), roundToUnit(value, unit)]);
  }
  const rows = [...buckets.entries()]
    .sort((left, right) => right[0] - left[0])
    .map(([points, values]) => ({
      id: createId(),
      from: Math.min(...values),
      to: Math.max(...values),
      points,
    }));
  const expected = Math.round((recipe.maxPoints - recipe.minPoints) / step) + 1;
  if (rows.length !== expected)
    throw new Error(`Die Formel erzeugt nur ${rows.length} von ${expected} benötigten Punktestufen. Formelwerte an den Leistungsgrenzen: ${score(recipe, formulaValue(recipe.minValue, unit, recipe)).toFixed(2)} bis ${score(recipe, formulaValue(recipe.maxValue, unit, recipe)).toFixed(2)} Punkte.`);
  return rows;
}
