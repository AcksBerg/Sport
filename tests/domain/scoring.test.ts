import { describe, expect, it } from "vitest";
import type { Attempt, Discipline, Sport } from "@/domain";
import {
  adjustmentsValid,
  applyPerformanceAdjustments,
  calculateComparisonScore,
  calculateUserProgress,
  changeAgeBandBoundary,
  determineAutomaticSportCutoffs,
  evaluateSportAttempts,
  findAgeBand,
  getAge,
  getEvaluationAge,
  normalizeAgeBands,
  removeAgeBand,
  roundScore,
  scoreAttempt,
  scoreDiscipline,
  scoreDisciplineResult,
  suggestAutomaticPointCutoff,
  splitAgeBand,
} from "@/domain/scoring";

const discipline: Discipline = {
  id: "d",
  name: "Test",
  unit: "repetitions",
  maxPoints: 100,
  ageBands: [{ id: "all", minAge: 0, maxAge: 100, label: "0-100" }],
  formulas: [
    {
      gender: "male",
      ageBandId: "all",
      segments: [
        { id: "low", from: null, to: 10, kind: "linear", a: 0, b: 2, c: 0 },
        {
          id: "high",
          from: 10.01,
          to: null,
          kind: "quadratic",
          a: 1,
          b: 0,
          c: 0,
        },
      ],
    },
  ],
};

const sport: Sport = {
  id: "s",
  slug: "test",
  name: "Test",
  description: "",
  totalMaxPoints: 100,
  aggregation: "sum",
  roundingMode: "round",
  decimalPlaces: 0,
  ageBands: [{ id: "all", minAge: 0, maxAge: 100, label: "0-100" }],
  disciplines: [discipline],
};

const attempt: Attempt = {
  id: "a",
  sportId: "s",
  date: "2026-06-07T12:00:00.000Z",
  status: "complete",
  performances: [{ disciplineId: "d", value: 12 }],
};

describe("Bewertung", () => {
  it("berechnet vollendete Lebensjahre", () => {
    expect(getAge("2000-06-08", new Date("2026-06-07T12:00:00"))).toBe(25);
    expect(getAge("2000-06-07", new Date("2026-06-07T12:00:00"))).toBe(26);
  });

  it("wertet lineare und quadratische Abschnitte aus und deckelt Punkte", () => {
    expect(scoreDiscipline(discipline, 5, "male", "all")).toBe(10);
    expect(scoreDiscipline(discipline, 12, "male", "all")).toBe(100);
  });

  it("unterstützt alle Rundungsarten", () => {
    expect(roundScore(12.345, "floor", 2)).toBe(12.34);
    expect(roundScore(12.345, "round", 2)).toBe(12.35);
    expect(roundScore(12.341, "ceil", 2)).toBe(12.35);
  });

  it("wendet Cut-offs auf Disziplin oder Durchgang an", () => {
    const cutoffSport = {
      ...sport,
      disciplines: [
        {
          ...discipline,
          cutoff: {
            kind: "performance" as const,
            comparison: "below" as const,
            threshold: 15,
            effect: "attempt" as const,
          },
        },
      ],
    };
    expect(scoreAttempt(cutoffSport, attempt, "male", 30).total).toBe(0);
  });

  it("skaliert das Prozentmittel auf das Gesamtmaximum", () => {
    const averageSport = {
      ...sport,
      aggregation: "percentageAverage" as const,
      totalMaxPoints: 200,
      disciplines: [
        {
          ...discipline,
          formulas: [
            {
              ...discipline.formulas[0],
              segments: [
                {
                  id: "x",
                  from: null,
                  to: null,
                  kind: "linear" as const,
                  a: 0,
                  b: 5,
                  c: 0,
                },
              ],
            },
          ],
        },
      ],
    };
    expect(
      scoreAttempt(
        averageSport,
        { ...attempt, performances: [{ disciplineId: "d", value: 10 }] },
        "male",
        30,
      ).total,
    ).toBe(100);
  });

  it("berechnet eine getrennte Vergleichswertung", () => {
    expect(
      calculateComparisonScore(
        { ...sport, totalMaxPoints: 300, comparisonMaxPoints: 50 },
        240,
      ),
    ).toBe(40);
  });

  it("wertet direkte Zeitformeln in Sekunden aus", () => {
    const timeFormula = (b: number, c: number): Discipline => ({
      ...discipline,
      unit: "time",
      maxPoints: 1000,
      formulas: [{
        gender: "male",
        ageBandId: "all",
        formulaValueUnit: "display",
        segments: [{ id: "seconds", from: null, to: null, kind: "linear", a: 0, b, c }],
      }],
    });
    expect(scoreDiscipline(timeFormula(-15, 1000), 60_000, "male", "all")).toBe(100);
    expect(scoreDiscipline(timeFormula(5, 75), 5_000, "male", "all")).toBe(100);
    expect(scoreDiscipline(timeFormula(-1 / 0.55, 100 + 390 / 0.55), 390_000, "male", "all")).toBeCloseTo(100);
  });

  it("addiert automatische Alters- und Geschlechtsboni aus denselben Basispunkten", () => {
    const bonusDiscipline: Discipline = {
      ...discipline,
      maxPoints: 1000,
      formulas: [{ gender: "female", ageBandId: "all", segments: [{ id: "base", from: null, to: null, kind: "linear", a: 0, b: 0, c: 100 }] }],
      automaticPointModifiers: [
        { id: "gender", label: "Geschlechtsbonus", kind: "fixedPercentage", factor: 0.15, gender: "female" },
        { id: "age", label: "Altersbonus", kind: "agePercentagePerYear", factor: 0.005, gender: "all", minAge: 36, referenceAge: 35 },
      ],
    };
    const female = scoreDisciplineResult(bonusDiscipline, { disciplineId: "d", value: 1 }, "female", "all", 36);
    expect(female?.automaticBonuses.map((bonus) => bonus.points)).toEqual([15, 0.5]);
    expect(female?.points).toBe(115.5);
    const male = scoreDisciplineResult({ ...bonusDiscipline, formulas: [{ ...bonusDiscipline.formulas[0], gender: "male" }] }, { disciplineId: "d", value: 1 }, "male", "all", 36);
    expect(male?.automaticBonusPoints).toBe(0.5);
  });

  it("deckelt automatische Boni und prüft Cut-offs danach", () => {
    const bonusDiscipline: Discipline = {
      ...discipline,
      maxPoints: 110,
      cutoff: { kind: "points", comparison: "below", threshold: 60, effect: "discipline" },
      formulas: [{ gender: "male", ageBandId: "all", segments: [{ id: "base", from: null, to: null, kind: "linear", a: 0, b: 1, c: 0 }] }],
      automaticPointModifiers: [{ id: "bonus", label: "Bonus", kind: "fixedPercentage", factor: 0.1, gender: "male" }],
    };
    expect(scoreDisciplineResult(bonusDiscipline, { disciplineId: "d", value: 59 }, "male", "all", 30)?.points).toBeCloseTo(64.9);
    expect(scoreDisciplineResult(bonusDiscipline, { disciplineId: "d", value: 109 }, "male", "all", 30)?.points).toBe(110);
  });

  it("summiert je Sportart ausschließlich die höchste vollständige Vergleichswertung", () => {
    const progressDiscipline = {
      ...discipline,
      formulas: [{
        gender: "male" as const,
        ageBandId: "all",
        segments: [{ id: "linear", from: null, to: null, kind: "linear" as const, a: 0, b: 1, c: 0 }],
      }],
    };
    const progressSport = {
      ...sport,
      totalMaxPoints: 200,
      comparisonMaxPoints: 50,
      disciplines: [
        { ...progressDiscipline, minimumPoints: 60 },
        { ...progressDiscipline, id: "d2", name: "Zweite Disziplin" },
      ],
    };
    const progress = calculateUserProgress(
      { id: "local", birthDate: "1990-01-01", gender: "male", targetPoints: 60 },
      [progressSport],
      [
        { ...attempt, id: "passed", performances: [{ disciplineId: "d", value: 60 }, { disciplineId: "d2", value: 60 }] },
        { ...attempt, id: "failed-higher", performances: [{ disciplineId: "d", value: 50 }, { disciplineId: "d2", value: 100 }] },
        { ...attempt, id: "draft", status: "draft", performances: [{ disciplineId: "d", value: 100 }, { disciplineId: "d2", value: 100 }] },
        { ...attempt, id: "not-evaluable", performances: [] },
      ],
    );
    expect(progress.bestBySport[0]).toMatchObject({
      attempt: { id: "failed-higher" },
      comparisonScore: 38,
      passStatus: "failed",
    });
    expect(progress.achievedPoints).toBe(38);
    expect(progress.remainingPoints).toBe(22);
    expect(progress.excessPoints).toBe(0);
    expect(progress.percentage).toBeCloseTo(63.333);
  });

  it("stellt den besten Verlaufseintrag zuerst und sortiert den Rest nach Datum", () => {
    const profile = { id: "local" as const, birthDate: "1990-01-01", gender: "male" as const, targetPoints: 100 };
    const entries = evaluateSportAttempts(profile, sport, [
      { ...attempt, id: "newer", date: "2026-06-08", performances: [{ disciplineId: "d", value: 5 }] },
      { ...attempt, id: "best", date: "2026-06-01", performances: [{ disciplineId: "d", value: 12 }] },
      { ...attempt, id: "draft", date: "2026-06-09", status: "draft" },
    ]);
    expect(entries.map((entry) => entry.attempt.id)).toEqual(["best", "draft", "newer"]);
    expect(entries[0]).toMatchObject({ isBest: true, comparisonScore: 100 });
    expect(entries[1]).toMatchObject({ isBest: false, comparisonScore: null });
  });

  it("berechnet Zielüberschuss und lehnt ungültige Zielwerte ab", () => {
    const profile = { id: "local" as const, birthDate: "1990-01-01", gender: "male" as const, targetPoints: 40 };
    const progress = calculateUserProgress(profile, [{ ...sport, comparisonMaxPoints: 50 }], [attempt]);
    expect(progress.achievedPoints).toBe(50);
    expect(progress.remainingPoints).toBe(0);
    expect(progress.excessPoints).toBe(10);
    expect(() => calculateUserProgress({ ...profile, targetPoints: 0 }, [], [])).toThrow(
      "größer als 0",
    );
  });

  it("wertet Tabellen diskret aus und verwendet bei Überschneidung den höheren Wert", () => {
    const tableDiscipline: Discipline = {
      ...discipline,
      scoringMode: "table",
      formulas: [],
      tables: [{
        gender: "male",
        ageBandId: "all",
        rows: [
          { id: "a", from: 10, to: 20, points: 60 },
          { id: "b", from: 15, to: 25, points: 80 },
        ],
      }],
    };
    expect(scoreDiscipline(tableDiscipline, 17, "male", "all")).toBe(80);
    expect(scoreDiscipline(tableDiscipline, 30, "male", "all")).toBe(0);
  });

  it("wendet Korrekturen an und validiert Auswahlgrenzen", () => {
    const adjusted: Discipline = {
      ...discipline,
      formulas: [{ gender: "male", ageBandId: "all", segments: [{ id: "linear", from: null, to: null, kind: "linear", a: 0, b: 2, c: 0 }] }],
      adjustmentGroups: [{
        id: "g",
        label: "Wurf",
        required: true,
        target: "performance",
        options: [
          { id: "hit", label: "Treffer", valueAdjustment: -5000 },
          { id: "miss", label: "Fehlwurf", valueAdjustment: 5000 },
        ],
      }],
    };
    const performance = { disciplineId: "d", value: 10000, selectedAdjustmentOptionIds: ["hit"] };
    expect(applyPerformanceAdjustments(adjusted, performance)).toBe(5000);
    expect(adjustmentsValid(adjusted, performance)).toBe(true);
    expect(adjustmentsValid(adjusted, { ...performance, selectedAdjustmentOptionIds: ["hit", "miss"] })).toBe(false);
  });

  it("wendet Punkteboni vor dem Punkte-Cut-off an", () => {
    const adjusted: Discipline = {
      ...discipline,
      formulas: [{ gender: "male", ageBandId: "all", segments: [{ id: "linear", from: null, to: null, kind: "linear", a: 0, b: 2, c: 0 }] }],
      cutoff: { kind: "points", comparison: "below", threshold: 60, effect: "discipline" },
      adjustmentGroups: [{ id: "bonus", label: "Bonus", required: true, target: "points", options: [{ id: "plus", label: "+10", valueAdjustment: 10 }] }],
    };
    const result = scoreDisciplineResult(adjusted, { disciplineId: "d", value: 24, selectedAdjustmentOptionIds: ["plus"] }, "male", "all");
    expect(result?.basePoints).toBe(48);
    expect(result?.adjustedPoints).toBe(58);
    expect(result?.points).toBe(0);
    const rescued = scoreDisciplineResult(adjusted, { disciplineId: "d", value: 30, selectedAdjustmentOptionIds: ["plus"] }, "male", "all");
    expect(rescued?.points).toBe(70);
  });

  it("schlägt den niedrigsten positiven Tabellenwert als Cut-off vor", () => {
    const table: Discipline = {
      ...discipline,
      scoringMode: "table",
      formulas: [],
      tables: [
        { gender: "male", ageBandId: "all", rows: [{ id: "a", from: 1, to: 2, points: 65 }] },
        { gender: "female", ageBandId: "all", rows: [{ id: "b", from: 1, to: 2, points: 60 }] },
      ],
    };
    expect(suggestAutomaticPointCutoff(table)).toBe(60);
  });

  it("unterstützt Kalenderjahresalter und nächste offene Altersgruppe", () => {
    expect(getEvaluationAge("2000-12-31", new Date("2026-01-01"), "calendarYear")).toBe(26);
    const bands = [
      { id: "young", minAge: 17, maxAge: 26, label: "17-26" },
      { id: "old", minAge: 40, maxAge: null, label: "40+" },
    ];
    expect(findAgeBand(bands, 12)?.id).toBe("young");
    expect(findAgeBand(bands, 80)?.id).toBe("old");
  });

  it("trennt Punkte und Bestehensstatus", () => {
    const passSport = {
      ...sport,
      totalMaxPoints: 300,
      minimumTotalPoints: 240,
      disciplines: [{ ...discipline, minimumPoints: 60 }],
    };
    const result = scoreAttempt(passSport, { ...attempt, performances: [{ disciplineId: "d", value: 7 }] }, "male", 30);
    expect(result.total).toBe(14);
    expect(result.passStatus).toBe("failed");
    expect(result.failedRequirements.length).toBe(2);
  });
  it("ermittelt Cut-offs sportweit mit Beibehalten und Überschreiben", () => {
    const existing = { ...discipline, id: "existing", name: "Bestehend", cutoff: { kind: "points" as const, comparison: "below" as const, threshold: 20, effect: "discipline" as const, origin: "manual" as const } };
    const table = {
      ...discipline,
      id: "table",
      name: "Tabelle",
      scoringMode: "table" as const,
      formulas: [],
      tables: [{ gender: "male" as const, ageBandId: "all", rows: [{ id: "row", from: 1, to: 2, points: 60 }] }],
    };
    const preserved = determineAutomaticSportCutoffs({ ...sport, disciplines: [existing, table] }, "preserveExisting");
    expect(preserved.sport.disciplines[0].cutoff?.threshold).toBe(20);
    expect(preserved.sport.disciplines[1].cutoff).toMatchObject({ threshold: 60, origin: "automatic" });
    expect(preserved.created).toEqual(["Tabelle"]);
    expect(preserved.preserved).toEqual(["Bestehend"]);

    const overwritten = determineAutomaticSportCutoffs({ ...sport, disciplines: [{ ...table, cutoff: existing.cutoff }] }, "overwriteExisting");
    expect(overwritten.sport.disciplines[0].cutoff).toMatchObject({ threshold: 60, origin: "automatic" });
    expect(overwritten.overwritten).toEqual(["Tabelle"]);
  });

  it("behält nicht bestimmbare bestehende Cut-offs beim Überschreiben", () => {
    const continuous = {
      ...discipline,
      name: "Kontinuierlich",
      formulas: [{ gender: "male" as const, ageBandId: "all", segments: [{ id: "open", from: null, to: null, kind: "linear" as const, a: 0, b: 1, c: 0 }] }],
      cutoff: { kind: "points" as const, comparison: "below" as const, threshold: 25, effect: "discipline" as const, origin: "manual" as const },
    };
    const result = determineAutomaticSportCutoffs({ ...sport, disciplines: [continuous] }, "overwriteExisting");
    expect(result.sport.disciplines[0].cutoff?.threshold).toBe(25);
    expect(result.preserved).toEqual(["Kontinuierlich"]);
    expect(result.notDeterminable).toEqual(["Kontinuierlich"]);
  });

  it("wertet die Cut-off-Grenze inklusiv und erst darunter mit null Punkten", () => {
    const cutoffDiscipline = {
      ...discipline,
      formulas: [{ gender: "male" as const, ageBandId: "all", segments: [{ id: "linear", from: null, to: null, kind: "linear" as const, a: 0, b: 1, c: 0 }] }],
      cutoff: { kind: "points" as const, comparison: "below" as const, threshold: 60, effect: "discipline" as const },
    };
    expect(scoreDisciplineResult(cutoffDiscipline, { disciplineId: "d", value: 60 }, "male", "all")?.points).toBe(60);
    expect(scoreDisciplineResult(cutoffDiscipline, { disciplineId: "d", value: 59 }, "male", "all")?.points).toBe(0);
  });

  it("wendet höchste Mindestpunkte und niedrigste Maximalpunkte vor dem Cut-off an", () => {
    const limited = {
      ...discipline,
      formulas: [{ gender: "male" as const, ageBandId: "all", segments: [{ id: "linear", from: null, to: null, kind: "linear" as const, a: 0, b: 1, c: 0 }] }],
      adjustmentGroups: [
        { id: "minimum", label: "Überwunden", required: true, options: [{ id: "min-10", label: "Ja", valueAdjustment: 10.78, effect: "minimumPoints" as const }] },
        { id: "maximum", label: "Deckel", required: true, options: [{ id: "max-20", label: "Nein", valueAdjustment: 0, effect: "maximumPoints" as const }] },
      ],
    };
    const minimum = scoreDisciplineResult(limited, { disciplineId: "d", value: 1, selectedAdjustmentOptionIds: ["min-10"] }, "male", "all");
    expect(minimum?.points).toBe(10.78);
    const maximumWins = scoreDisciplineResult(limited, { disciplineId: "d", value: 80, selectedAdjustmentOptionIds: ["min-10", "max-20"] }, "male", "all");
    expect(maximumWins?.points).toBe(0);
  });
});

describe("Altersbereiche", () => {
  it("teilt und verbindet die lückenlose Spanne 0-100", () => {
    const original = [{ id: "all", minAge: 0, maxAge: 100, label: "0-100" }];
    const split = splitAgeBand(original, 31);
    expect(split.map(({ minAge, maxAge }) => [minAge, maxAge])).toEqual([
      [0, 30],
      [31, 100],
    ]);
    expect(
      removeAgeBand(split, split[1].id).map(({ minAge, maxAge }) => [
        minAge,
        maxAge,
      ]),
    ).toEqual([[0, 100]]);
  });

  it("schließt bestehende Lücken zugunsten des vorherigen Bereichs", () => {
    expect(
      normalizeAgeBands([
        { id: "young", minAge: 0, maxAge: 26, label: "u26" },
        { id: "middle", minAge: 27, maxAge: 30, label: "27-39" },
        { id: "old", minAge: 40, maxAge: 100, label: "ü40" },
      ]).map(({ minAge, maxAge }) => [minAge, maxAge]),
    ).toEqual([
      [0, 26],
      [27, 39],
      [40, 100],
    ]);
  });

  it("koppelt geänderte Grenzen an den Nachbarbereich", () => {
    expect(
      changeAgeBandBoundary(
        [
          { id: "young", minAge: 0, maxAge: 30, label: "jung" },
          { id: "old", minAge: 31, maxAge: 100, label: "alt" },
        ],
        "young",
        "maxAge",
        39,
      ).map(({ minAge, maxAge }) => [minAge, maxAge]),
    ).toEqual([
      [0, 39],
      [40, 100],
    ]);
  });

  it("lehnt invertierte und doppelte Startgrenzen ab", () => {
    expect(() =>
      normalizeAgeBands([
        { id: "invalid", minAge: 0, maxAge: -1, label: "ungültig" },
      ]),
    ).toThrow("invertiert");
    expect(() =>
      normalizeAgeBands([
        { id: "first", minAge: 0, maxAge: 20, label: "eins" },
        { id: "second", minAge: 0, maxAge: 100, label: "zwei" },
      ]),
    ).toThrow("demselben Alter");
  });
});
