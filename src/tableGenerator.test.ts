import { describe, expect, it } from "vitest";
import type { TableGeneratorRecipe } from "./domain";
import { generateTableRows, validateGeneratorRecipe } from "./tableGenerator";
import { formatUnitValue, roundToUnit, unitResolution } from "./unitValues";

const linear: TableGeneratorRecipe = {
  kind: "linear",
  a: 0,
  b: 1,
  c: 0,
  minPoints: 1,
  maxPoints: 3,
  minValue: 0.5,
  maxValue: 3.49,
  direction: "higherIsBetter",
};

describe("Einheitenwerte", () => {
  it("verwendet die festgelegten Auflösungen und Formate", () => {
    expect(unitResolution("time")).toBe(10);
    expect(unitResolution("repetitions")).toBe(1);
    expect(unitResolution("distance")).toBe(0.01);
    expect(roundToUnit(1.236, "distance")).toBeCloseTo(1.24);
    expect(formatUnitValue(260_340, "time")).toBe("4:20,34");
  });
  it("wertet Zeitformeln in Sekunden aus und speichert Millisekunden", () => {
    const rows = generateTableRows({
      kind: "linear",
      a: 0,
      b: -0.2778,
      c: 45.8333,
      minPoints: 20,
      maxPoints: 25,
      minValue: 75000,
      maxValue: 93000,
      pointStep: 1,
      formulaValueUnit: "display",
      direction: "lowerIsBetter",
    }, "time");
    expect(rows.map((row) => row.points)).toEqual([25, 24, 23, 22, 21, 20]);
    expect(rows[0].from).toBeGreaterThanOrEqual(75000);
  });

  it("unterstützt Dezimalpunktestufen", () => {
    const rows = generateTableRows({ ...linear, minPoints: 1, maxPoints: 2, pointStep: 0.1 }, "distance");
    expect(rows).toHaveLength(11);
    expect(rows.map((row) => row.points)).toContain(1.5);
  });

  it("erzeugt die Frauenformel ab 1:35 in Sekunden", () => {
    const rows = generateTableRows({
      kind: "linear",
      a: 0,
      b: -0.209,
      c: 44.8579,
      minPoints: 20,
      maxPoints: 25,
      minValue: 95000,
      maxValue: 119000,
      pointStep: 1,
      formulaValueUnit: "display",
      direction: "lowerIsBetter",
    }, "time");
    expect(rows[0].points).toBe(25);
    expect(rows[0].from).toBeGreaterThanOrEqual(95000);
  });
});

describe("Tabellengenerator", () => {
  it("erzeugt inklusive Zeilen je ganzzahligem Punktwert", () => {
    const rows = generateTableRows(linear, "distance");
    expect(rows.map((row) => row.points)).toEqual([3, 2, 1]);
    expect(rows[0].from).toBeLessThanOrEqual(rows[0].to!);
  });

  it("unterstützt kleinere Leistung ist besser", () => {
    const rows = generateTableRows({ ...linear, b: -1, c: 4, direction: "lowerIsBetter" }, "distance");
    expect(rows).toHaveLength(3);
  });

  it("blockiert quadratische Bereiche über dem Scheitelpunkt", () => {
    expect(validateGeneratorRecipe({ ...linear, kind: "quadratic", a: 1, b: -4, minValue: 0, maxValue: 4 })).toContain("Scheitelpunkt");
  });
});
