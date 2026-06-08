import type { Discipline, TableRule } from "@/domain";
import { scoreConfiguredDiscipline, scoreDiscipline } from "@/domain/scoring";
import { formatUnitValue, unitResolution } from "@/shared/utils/units";

export interface ChartDomain {
  min: number;
  max: number;
}

export interface ChartPoint {
  x: number;
  y: number;
}

export function calculateChartPointDomain(discipline: Discipline): ChartDomain {
  if (discipline.cutoff?.kind !== "points")
    return { min: 0, max: discipline.maxPoints };
  return discipline.cutoff.comparison === "below"
    ? { min: Math.min(discipline.maxPoints, Math.max(0, discipline.cutoff.threshold - 5)), max: discipline.maxPoints }
    : { min: 0, max: Math.max(0, Math.min(discipline.maxPoints, discipline.cutoff.threshold + 5)) };
}

export function createTableChartPoints(
  rule: TableRule,
  discipline: Pick<Discipline, "cutoff">,
  includeCutoffExcluded = false,
): ChartPoint[] {
  return rule.rows
    .filter((row) => {
      if (includeCutoffExcluded) return true;
      if (discipline.cutoff?.kind !== "points") return true;
      return discipline.cutoff.comparison === "below"
        ? row.points >= discipline.cutoff.threshold
        : row.points <= discipline.cutoff.threshold;
    })
    .map((row) => {
      const low = Math.min(row.from ?? row.to ?? 0, row.to ?? row.from ?? 0);
      const high = Math.max(row.from ?? row.to ?? 0, row.to ?? row.from ?? 0);
      return { x: (low + high) / 2, y: row.points };
    })
    .sort((left, right) => left.x - right.x || left.y - right.y);
}

export function calculateChartDomain(discipline: Discipline): ChartDomain {
  const explicit = discipline.scoringMode === "table"
    ? (discipline.tables ?? []).flatMap((rule) => rule.rows.flatMap((row) => [row.from, row.to]))
    : discipline.formulas.flatMap((rule) => rule.segments.flatMap((segment) => [segment.from, segment.to]));
  const roots: number[] = [];
  if (discipline.scoringMode !== "table") {
    const solve = (a: number, b: number, c: number) => {
      if (a === 0) return b === 0 ? [] : [-c / b];
      const discriminant = b * b - 4 * a * c;
      if (discriminant < 0) return [];
      return [(-b - Math.sqrt(discriminant)) / (2 * a), (-b + Math.sqrt(discriminant)) / (2 * a)];
    };
    discipline.formulas.forEach((rule) => rule.segments.forEach((segment) => {
      [0, discipline.maxPoints].forEach((target) => {
        solve(segment.a, segment.b, segment.c - target)
          .map((value) =>
            discipline.unit === "time" && rule.formulaValueUnit === "display"
              ? value * 1000
              : value,
          )
          .filter((value) => value >= 0 && (segment.from === null || value >= segment.from) && (segment.to === null || value <= segment.to))
          .forEach((value) => roots.push(value));
      });
    }));
  }
  const finite = [...explicit, ...roots].filter((value): value is number => value !== null && Number.isFinite(value));
  let min = finite.length ? Math.min(...finite) : 0;
  let max = finite.length ? Math.max(...finite) : unitResolution(discipline.unit) * 100;

  if (discipline.scoringMode !== "table") {
    const span = Math.max(max - min, unitResolution(discipline.unit) * 100);
    const sampleMin = Math.max(0, min - span);
    const sampleMax = max + span;
    const relevant: number[] = [];
    for (let index = 0; index <= 1000; index++) {
      const value = sampleMin + ((sampleMax - sampleMin) * index) / 1000;
      if (discipline.formulas.some((rule) => {
        const points = scoreDiscipline(discipline, value, rule.gender, rule.ageBandId);
        return points !== null && points > 0 && points < discipline.maxPoints;
      })) relevant.push(value);
    }
    if (relevant.length) {
      min = Math.min(...relevant);
      max = Math.max(...relevant);
    }
  }
  const span = Math.max(max - min, unitResolution(discipline.unit));
  let domain = { min: Math.max(0, min - span * 0.1), max: max + span * 0.1 };
  if (discipline.cutoff) {
    const boundaries: number[] = [];
    const steps = 2000;
    const rules = discipline.scoringMode === "table" ? (discipline.tables ?? []) : discipline.formulas;
    rules.forEach((rule) => {
      let previous = scoreConfiguredDiscipline(discipline, domain.min, rule.gender, rule.ageBandId);
      for (let index = 1; index <= steps; index++) {
        const value = domain.min + ((domain.max - domain.min) * index) / steps;
        const current = scoreConfiguredDiscipline(discipline, value, rule.gender, rule.ageBandId);
        if ((previous === 0) !== (current === 0)) boundaries.push(value);
        previous = current;
      }
    });
    if (boundaries.length) {
      const goodAtStart = rules.some((rule) => (scoreConfiguredDiscipline(discipline, domain.min, rule.gender, rule.ageBandId) ?? 0) > 0);
      const boundary = goodAtStart ? Math.max(...boundaries) : Math.min(...boundaries);
      const relevantSpan = Math.max(max - min, unitResolution(discipline.unit));
      domain = goodAtStart
        ? { min: domain.min, max: boundary + relevantSpan * 0.05 }
        : { min: Math.max(0, boundary - relevantSpan * 0.05), max: domain.max };
    }
  }
  return domain;
}

export function formatChartTick(value: number, unit: Discipline["unit"]) {
  if (unit === "time") {
    const minutes = Math.floor(value / 60000);
    const seconds = Math.floor((value % 60000) / 1000);
    return `${minutes}:${String(seconds).padStart(2, "0")} min`;
  }
  return unit === "distance" ? `${Number(value.toFixed(2))} m` : `${Math.round(value)} Wdh.`;
}

export function formatChartTooltip(value: number, unit: Discipline["unit"]) {
  const suffix = unit === "time" ? " min" : unit === "distance" ? " m" : " Wdh.";
  return `${formatUnitValue(value, unit)}${suffix}`;
}
