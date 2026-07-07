import { createId, type FormulaSegment, type Unit } from "@/domain";
import { unitResolution } from "@/shared/utils/units";

export interface FormulaPoint {
  value: number;
  points: number;
}

const formulaValue = (value: number, unit: Unit) =>
  unit === "time" ? value / 1000 : value;

export function createLinearFormulaSegments(
  points: FormulaPoint[],
  unit: Unit,
): FormulaSegment[] {
  if (points.length < 2)
    throw new Error("Mindestens zwei Stützpunkte sind erforderlich.");
  if (!points.every((point) => Number.isFinite(point.value) && Number.isFinite(point.points)))
    throw new Error("Alle Stützpunkte benötigen gültige Zahlenwerte.");
  const sorted = [...points].sort((left, right) => left.value - right.value);
  if (sorted.some((point, index) => index > 0 && point.value <= sorted[index - 1].value))
    throw new Error("Leistungswerte müssen streng aufsteigend sein.");
  const resolution = unitResolution(unit);
  return sorted
    .slice(0, -1)
    .map((start, index) => {
      const end = sorted[index + 1];
      const x1 = formulaValue(start.value, unit);
      const x2 = formulaValue(end.value, unit);
      const m = (end.points - start.points) / (x2 - x1);
      const b = start.points - m * x1;
      return {
        id: createId(),
        from: index === 0 ? null : start.value,
        to: index === sorted.length - 2 ? null : end.value,
        kind: "linear",
        a: 0,
        b: m,
        c: b,
      } satisfies FormulaSegment;
    })
    .map((segment, index, segments) =>
      index === 0
        ? segment
        : { ...segment, from: (segments[index - 1].to ?? segment.from ?? 0) + resolution },
    );
}
