import { describe, expect, it } from "vitest";
import type { Discipline } from "@/domain";
import {
  calculateChartDomain,
  calculateChartPointDomain,
  createTableChartPoints,
  formatChartTick,
  formatChartTooltip,
} from "@/shared/utils/charts";

const discipline: Discipline = {
  id: "d",
  name: "Lauf",
  unit: "time",
  maxPoints: 100,
  scoringMode: "table",
  ageBands: [{ id: "all", minAge: 0, maxAge: null, label: "Alle" }],
  formulas: [],
  tables: [{ gender: "male", ageBandId: "all", rows: [{ id: "a", from: 180000, to: 240000, points: 100 }, { id: "b", from: 240010, to: 300000, points: 60 }] }],
};

describe("Diagrammhilfen", () => {
  it("berechnet den relevanten Tabellenbereich mit zehn Prozent Rand", () => {
    const domain = calculateChartDomain(discipline);
    expect(domain.min).toBe(168000);
    expect(domain.max).toBe(312000);
  });

  it("formatiert Ticks kompakt und Tooltips präzise", () => {
    expect(formatChartTick(244000, "time")).toBe("4:04 min");
    expect(formatChartTooltip(244370, "time")).toBe("4:04,37 min");
    expect(formatChartTick(34, "repetitions")).toBe("34 Wdh.");
    expect(formatChartTooltip(244.5, "distance")).toBe("244.50 m");
  });

  it("schneidet offene lineare Formelbereiche an null und Maximalpunkten ab", () => {
    const formula: Discipline = {
      ...discipline,
      scoringMode: "formula",
      tables: [],
      formulas: [{ gender: "male", ageBandId: "all", segments: [{ id: "segment", from: null, to: null, kind: "linear", a: 0, b: -1, c: 300000 }] }],
    };
    const domain = calculateChartDomain(formula);
    expect(domain.min).toBeGreaterThan(150000);
    expect(domain.max).toBeLessThan(350000);
  });

  it("endet bei Cut-off fünf Prozent hinter der schlechten Leistungsgrenze", () => {
    const cutoff = { ...discipline, cutoff: { kind: "points" as const, comparison: "below" as const, threshold: 60, effect: "discipline" as const } };
    const domain = calculateChartDomain(cutoff);
    expect(domain.max).toBeLessThan(320000);
    expect(domain.max).toBeGreaterThan(300000);
  });
  it("zeigt bei Punkte-Cut-off nur den relevanten Punktebereich", () => {
    expect(calculateChartPointDomain({
      ...discipline,
      cutoff: { kind: "points", comparison: "below", threshold: 60, effect: "discipline" },
    })).toEqual({ min: 55, max: 100 });
    expect(calculateChartPointDomain({
      ...discipline,
      maxPoints: 10,
      cutoff: { kind: "points", comparison: "below", threshold: 3, effect: "discipline" },
    })).toEqual({ min: 0, max: 10 });
  });

  it("erzeugt für jede sichtbare Tabellenzeile einen sortierten Diagrammpunkt", () => {
    const rows = Array.from({ length: 41 }, (_, index) => ({
      id: `${index}`,
      from: index === 10 ? 33 : 46 - index,
      to: index === 10 ? 32 : 46 - index,
      points: 100 - index,
    }));
    rows.push({ id: "duplicate", from: 26, to: 26, points: 80 });
    const points = createTableChartPoints(
      { gender: "female", ageBandId: "all", rows },
      { cutoff: { kind: "points", comparison: "below", threshold: 60, effect: "discipline" } },
    );
    expect(points).toHaveLength(42);
    expect(points.filter((point) => point.x === 26)).toHaveLength(2);
    expect(points.every((point, index) => index === 0 || points[index - 1].x <= point.x)).toBe(true);
  });
});
