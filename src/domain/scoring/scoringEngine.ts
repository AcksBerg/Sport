import type {
  AgeBand,
  AdjustmentGroup,
  AdjustmentOption,
  AutomaticPointBonus,
  AutomaticPointModifier,
  AutomaticCutoffMode,
  AutomaticCutoffResult,
  Attempt,
  AttemptScore,
  Discipline,
  EvaluatedSportAttempt,
  Gender,
  RoundingMode,
  Sport,
  UserProfile,
  UserProgress,
} from "@/domain";

export function getAge(birthDate: string, at = new Date()): number {
  const birth = new Date(`${birthDate}T00:00:00`);
  let age = at.getFullYear() - birth.getFullYear();
  const birthdayPassed =
    at.getMonth() > birth.getMonth() ||
    (at.getMonth() === birth.getMonth() && at.getDate() >= birth.getDate());
  if (!birthdayPassed) age -= 1;
  return age;
}

export function findAgeBand(ageBands: AgeBand[], age: number) {
  const direct = ageBands.find(
    (band) =>
      (band.minAge === null || age >= band.minAge) &&
      (band.maxAge === null || age <= band.maxAge),
  );
  if (direct) return direct;
  return [...ageBands].sort((left, right) => {
    const distance = (band: AgeBand) => {
      if (band.minAge !== null && age < band.minAge) return band.minAge - age;
      if (band.maxAge !== null && age > band.maxAge) return age - band.maxAge;
      return 0;
    };
    return distance(left) - distance(right) || (left.minAge ?? -1) - (right.minAge ?? -1);
  })[0];
}

export function getEvaluationAge(
  birthDate: string,
  attemptDate: Date,
  policy: Sport["agePolicy"] = "attemptDate",
) {
  return policy === "calendarYear"
    ? attemptDate.getFullYear() - new Date(`${birthDate}T00:00:00`).getFullYear()
    : getAge(birthDate, attemptDate);
}

export function roundScore(
  value: number,
  mode: RoundingMode,
  decimalPlaces: number,
) {
  const factor = 10 ** decimalPlaces;
  const operation =
    mode === "floor" ? Math.floor : mode === "ceil" ? Math.ceil : Math.round;
  return operation(value * factor) / factor;
}

export function scoreDiscipline(
  discipline: Discipline,
  value: number,
  gender: Gender,
  ageBandId: string,
) {
  const finalizePoints = (raw: number) => {
    const positive = Math.max(0, raw);
    return discipline.capPoints === false
      ? positive
      : Math.min(discipline.maxPoints, positive);
  };
  if (discipline.scoringMode === "table") {
    const table = discipline.tables?.find(
      (rule) => rule.gender === gender && rule.ageBandId === ageBandId,
    );
    if (!table) return null;
    const matches = table.rows.filter(
      (row) =>
        (row.from === null || value >= Math.min(row.from, row.to ?? row.from)) &&
        (row.to === null || value <= Math.max(row.from ?? row.to, row.to)),
    );
    return finalizePoints(
      matches.length === 0 ? 0 : Math.max(...matches.map((row) => row.points)),
    );
  }
  const rule = discipline.formulas.find(
    (formula) => formula.gender === gender && formula.ageBandId === ageBandId,
  );
  if (!rule || rule.segments.length === 0) return null;
  const formulaValue =
    discipline.unit === "time" && rule.formulaValueUnit === "display"
      ? value / 1000
      : value;
  const segment =
    rule.segments.find(
      (candidate) =>
        (candidate.from === null || value >= candidate.from) &&
        (candidate.to === null || value <= candidate.to),
    ) ?? rule.segments[0];
  const raw =
    segment.a * formulaValue * formulaValue +
    segment.b * formulaValue +
    segment.c;
  return finalizePoints(raw);
}

function evaluateComparisonFormula(sport: Sport, rawTotal: number) {
  const segment = sport.comparisonFormula?.find(
    (candidate) =>
      (candidate.from === null || rawTotal >= candidate.from) &&
      (candidate.to === null || rawTotal <= candidate.to),
  );
  if (!segment) return 0;
  return segment.a * rawTotal * rawTotal + segment.b * rawTotal + segment.c;
}

export function calculateComparisonScore(
  sport: Sport,
  rawTotal: number,
  attemptScore?: Pick<AttemptScore, "disciplineMinimumFailed">,
) {
  const comparisonMax = sport.comparisonMaxPoints ?? sport.totalMaxPoints;
  if (
    sport.minimumViolationEffect === "zeroComparison" &&
    attemptScore?.disciplineMinimumFailed
  )
    return 0;
  const rawComparison = sport.comparisonFormula?.length
    ? evaluateComparisonFormula(sport, rawTotal)
    : (rawTotal / sport.totalMaxPoints) * comparisonMax;
  return roundScore(
    Math.min(comparisonMax, Math.max(0, rawComparison)),
    sport.roundingMode,
    sport.decimalPlaces,
  );
}

export function evaluateSportAttempts(
  profile: UserProfile,
  sport: Sport,
  attempts: Attempt[],
): EvaluatedSportAttempt[] {
  const evaluated = attempts
    .filter((attempt) => attempt.sportId === sport.id)
    .map((attempt) => {
      const result = scoreAttempt(
        sport,
        attempt,
        profile.gender,
        getEvaluationAge(profile.birthDate, new Date(attempt.date), sport.agePolicy),
      );
      return {
        attempt,
        result,
        comparisonScore:
          result.total === null ? null : calculateComparisonScore(sport, result.total, result),
      };
    });
  const best = evaluated
    .filter((item) => item.comparisonScore !== null)
    .sort(
      (left, right) =>
        right.comparisonScore! - left.comparisonScore! ||
        right.attempt.date.localeCompare(left.attempt.date),
    )[0];
  return evaluated
    .map((item) => ({ ...item, isBest: item.attempt.id === best?.attempt.id }))
    .sort(
      (left, right) =>
        Number(right.isBest) - Number(left.isBest) ||
        right.attempt.date.localeCompare(left.attempt.date),
    );
}

export function calculateUserProgress(
  profile: UserProfile,
  sports: Sport[],
  attempts: Attempt[],
): UserProgress {
  if (!Number.isFinite(profile.targetPoints) || profile.targetPoints <= 0)
    throw new Error("Die Zielpunktzahl muss größer als 0 sein.");

  const bestBySport = sports.flatMap((sport) => {
    const best = evaluateSportAttempts(profile, sport, attempts).find((item) => item.isBest);
    return best && best.result.total !== null && best.comparisonScore !== null
      ? [{
          sportId: sport.id,
          attempt: best.attempt,
          rawTotal: best.result.total,
          comparisonScore: best.comparisonScore,
          passStatus: best.result.passStatus,
        }]
      : [];
  });
  const achievedPoints = Number(
    bestBySport.reduce((sum, best) => sum + best.comparisonScore, 0).toFixed(10),
  );
  const remainingPoints = Number(
    Math.max(0, profile.targetPoints - achievedPoints).toFixed(10),
  );
  const excessPoints = Number(
    Math.max(0, achievedPoints - profile.targetPoints).toFixed(10),
  );
  return {
    bestBySport,
    achievedPoints,
    targetPoints: profile.targetPoints,
    remainingPoints,
    excessPoints,
    percentage: (achievedPoints / profile.targetPoints) * 100,
  };
}

function selectedOptions(discipline: Discipline, performance: Attempt["performances"][number]) {
  const selected = new Set(performance.selectedAdjustmentOptionIds ?? []);
  return (discipline.adjustmentGroups ?? []).flatMap((group) =>
    group.options
      .filter((option) => selected.has(option.id))
      .map((option) => ({ group, option })),
  );
}

const optionEffect = (group: AdjustmentGroup, option: AdjustmentOption) =>
  option.effect ?? (group.target === "points" ? "pointAdjustment" : "performanceAdjustment");

export function applyPerformanceAdjustments(discipline: Discipline, performance: Attempt["performances"][number]) {
  return performance.value + selectedOptions(discipline, performance)
    .filter(({ group, option }) => optionEffect(group, option) === "performanceAdjustment")
    .reduce((sum, { option }) => sum + option.valueAdjustment, 0);
}

export function applyPointAdjustments(discipline: Discipline, performance: Attempt["performances"][number], points: number) {
  const adjustment = selectedOptions(discipline, performance)
    .filter(({ group, option }) => optionEffect(group, option) === "pointAdjustment")
    .reduce((sum, { option }) => sum + option.valueAdjustment, 0);
  const minimum = Math.max(0, ...selectedOptions(discipline, performance)
    .filter(({ group, option }) => optionEffect(group, option) === "minimumPoints")
    .map(({ option }) => option.valueAdjustment));
  const configuredMaximum = selectedOptions(discipline, performance)
    .filter(({ group, option }) => optionEffect(group, option) === "maximumPoints")
    .map(({ option }) => option.valueAdjustment);
  const maximum = configuredMaximum.length
    ? Math.min(...configuredMaximum)
    : Number.POSITIVE_INFINITY;
  const limited = Math.min(maximum, Math.max(minimum, points + adjustment));
  const capped = discipline.capPoints === false
    ? Math.max(0, limited)
    : Math.min(discipline.maxPoints, Math.max(0, limited));
  return {
    adjustment,
    minimum,
    maximum,
    points: capped,
  };
}

export function automaticModifierApplies(
  modifier: AutomaticPointModifier,
  gender: Gender,
  age: number,
) {
  return (
    (modifier.gender === "all" || modifier.gender === gender) &&
    (modifier.minAge === undefined || age >= modifier.minAge) &&
    (modifier.maxAge === undefined || age <= modifier.maxAge)
  );
}

export function calculateAutomaticPointBonuses(
  discipline: Discipline,
  basePoints: number,
  gender: Gender,
  age: number,
): AutomaticPointBonus[] {
  return (discipline.automaticPointModifiers ?? [])
    .filter((modifier) => automaticModifierApplies(modifier, gender, age))
    .map((modifier) => ({
      modifierId: modifier.id,
      label: modifier.label,
      points:
        modifier.kind === "fixedPercentage"
          ? basePoints * modifier.factor
          : basePoints *
            Math.max(0, age - (modifier.referenceAge ?? 0)) *
            modifier.factor,
    }));
}

export function adjustmentsValid(discipline: Discipline, performance: Attempt["performances"][number]) {
  const selected = new Set(performance.selectedAdjustmentOptionIds ?? []);
  return (discipline.adjustmentGroups ?? []).every((group) => {
    const count = group.options.filter((option) => selected.has(option.id)).length;
    return count === 1 || (!group.required && count === 0);
  });
}

function cutoffTriggered(
  discipline: Discipline,
  value: number,
  points: number,
) {
  if (!discipline.cutoff) return false;
  const compared = discipline.cutoff.kind === "performance" ? value : points;
  return discipline.cutoff.comparison === "below"
    ? compared < discipline.cutoff.threshold
    : compared > discipline.cutoff.threshold;
}

export function scoreConfiguredDiscipline(
  discipline: Discipline,
  value: number,
  gender: Gender,
  ageBandId: string,
  age = 0,
) {
  return scoreDisciplineResult(
    discipline,
    { disciplineId: discipline.id, value },
    gender,
    ageBandId,
    age,
  )?.points ?? null;
}

export function scoreDisciplineResult(
  discipline: Discipline,
  performance: Attempt["performances"][number],
  gender: Gender,
  ageBandId: string,
  age = 0,
) {
  const evaluatedValue = applyPerformanceAdjustments(discipline, performance);
  const basePoints = scoreDiscipline(discipline, evaluatedValue, gender, ageBandId);
  if (basePoints === null) return null;
  const automaticBonuses = calculateAutomaticPointBonuses(
    discipline,
    basePoints,
    gender,
    age,
  );
  const automaticBonusPoints = automaticBonuses.reduce(
    (sum, bonus) => sum + bonus.points,
    0,
  );
  const adjusted = applyPointAdjustments(
    discipline,
    performance,
    basePoints + automaticBonusPoints,
  );
  const triggered = cutoffTriggered(discipline, evaluatedValue, adjusted.points);
  return {
    evaluatedValue,
    basePoints,
    automaticBonuses,
    automaticBonusPoints,
    pointAdjustment: adjusted.adjustment,
    adjustedPoints: adjusted.points,
    cutoffTriggered: triggered,
    points: triggered && discipline.cutoff?.effect === "discipline" ? 0 : adjusted.points,
  };
}

export function suggestAutomaticPointCutoff(discipline: Discipline) {
  if (discipline.scoringMode === "table") {
    const positives = (discipline.tables ?? []).flatMap((rule) => rule.rows.map((row) => row.points)).filter((points) => points > 0);
    return positives.length ? Math.min(...positives) : null;
  }
  const candidates = discipline.formulas.flatMap((rule) =>
    rule.segments.flatMap((segment) => {
      if (segment.from === null && segment.to === null) return [];
      const values = [segment.from, segment.to].filter((value): value is number => value !== null);
      return values.map((value) => scoreDiscipline(discipline, value, rule.gender, rule.ageBandId)).filter((points): points is number => points !== null && points > 0);
    }),
  );
  return candidates.length ? Math.min(...candidates) : null;
}

export function determineAutomaticSportCutoffs(
  sport: Sport,
  mode: AutomaticCutoffMode,
): AutomaticCutoffResult {
  const created: string[] = [];
  const overwritten: string[] = [];
  const preserved: string[] = [];
  const notDeterminable: string[] = [];
  const disciplines = sport.disciplines.map((discipline) => {
    const suggestion = suggestAutomaticPointCutoff(discipline);
    if (suggestion === null) {
      notDeterminable.push(discipline.name);
      if (discipline.cutoff) preserved.push(discipline.name);
      return discipline;
    }
    if (discipline.cutoff && mode === "preserveExisting") {
      preserved.push(discipline.name);
      return discipline;
    }
    if (discipline.cutoff) overwritten.push(discipline.name);
    else created.push(discipline.name);
    return {
      ...discipline,
      cutoff: {
        kind: "points" as const,
        comparison: "below" as const,
        threshold: suggestion,
        effect: "discipline" as const,
        origin: "automatic" as const,
      },
    };
  });
  return {
    sport: { ...sport, disciplines },
    created,
    overwritten,
    preserved,
    notDeterminable,
  };
}

export function scoreAttempt(
  sport: Sport,
  attempt: Attempt,
  gender: Gender,
  age: number,
): AttemptScore {
  let attemptCutoffTriggered = false;
  const disciplineScores = sport.disciplines.flatMap((discipline) => {
    const performance = attempt.performances.find(
      (candidate) => candidate.disciplineId === discipline.id,
    );
    if (!performance) return [];
    const ageBand = findAgeBand(discipline.ageBands, age);
    if (!ageBand) return [];
    const result = scoreDisciplineResult(discipline, performance, gender, ageBand.id, age);
    if (!result) return [];
    const triggered = result.cutoffTriggered;
    if (triggered && discipline.cutoff?.effect === "attempt")
      attemptCutoffTriggered = true;
    return [
      {
        disciplineId: discipline.id,
        rawPoints: result.basePoints,
        points: result.points,
        cutoffTriggered: triggered,
        evaluatedValue: result.evaluatedValue,
        minimumMet: result.points >= (discipline.minimumPoints ?? 0),
        basePoints: result.basePoints,
        pointAdjustment: result.pointAdjustment,
        automaticBonusPoints: result.automaticBonusPoints,
        automaticBonuses: result.automaticBonuses,
      },
    ];
  });

  const complete =
    attempt.status === "complete" &&
    disciplineScores.length === sport.disciplines.length;
  if (!complete && attempt.status === "complete")
    return {
      disciplineScores,
      total: null,
      attemptCutoffTriggered,
      disciplineMinimumFailed: false,
      passStatus: "notEvaluable",
      failedRequirements: ["Nicht alle Disziplinen konnten bewertet werden"],
    };
  if (!complete)
    return {
      disciplineScores,
      total: null,
      attemptCutoffTriggered,
      disciplineMinimumFailed: false,
      passStatus: null,
      failedRequirements: [],
    };

  const rawTotal =
    sport.aggregation === "sum"
      ? disciplineScores.reduce((sum, score) => sum + score.points, 0)
      : (disciplineScores.reduce((sum, score) => {
          const discipline = sport.disciplines.find(
            (item) => item.id === score.disciplineId,
          )!;
          return sum + score.points / (discipline.referenceMaxPoints ?? discipline.maxPoints);
        }, 0) /
          disciplineScores.length) *
        sport.totalMaxPoints;
  const total = attemptCutoffTriggered
    ? 0
    : Math.min(
        sport.totalMaxPoints,
        roundScore(rawTotal, sport.roundingMode, sport.decimalPlaces),
      );
  const disciplineMinimumFailed = disciplineScores.some((score) => !score.minimumMet);
  const failedRequirements = [
    ...(sport.minimumTotalPoints !== undefined && total < sport.minimumTotalPoints
      ? [`Gesamtminimum ${sport.minimumTotalPoints} Punkte`]
      : []),
    ...disciplineScores
      .filter((score) => !score.minimumMet)
      .map((score) => {
        const discipline = sport.disciplines.find((item) => item.id === score.disciplineId)!;
        return `${discipline.name}: mindestens ${discipline.minimumPoints} Punkte`;
      }),
  ];
  return {
    disciplineScores,
    total,
    attemptCutoffTriggered,
    disciplineMinimumFailed,
    passStatus: failedRequirements.length === 0 ? "passed" : "failed",
    failedRequirements,
  };
}

export function splitAgeBand(ageBands: AgeBand[], splitAt: number): AgeBand[] {
  const target = ageBands.find(
    (band) =>
      (band.minAge === null || splitAt > band.minAge) &&
      (band.maxAge === null || splitAt <= band.maxAge),
  );
  if (!target) return ageBands;
  return ageBands.flatMap((band) =>
    band.id !== target.id
      ? [band]
      : [
          {
            ...band,
            maxAge: splitAt - 1,
            label: `${band.minAge ?? 0}-${splitAt - 1}`,
          },
          {
            id: crypto.randomUUID(),
            minAge: splitAt,
            maxAge: band.maxAge,
            label: band.maxAge === null ? `${splitAt}+` : `${splitAt}-${band.maxAge}`,
          },
        ],
  );
}

export function removeAgeBand(ageBands: AgeBand[], id: string): AgeBand[] {
  if (ageBands.length === 1) return ageBands;
  const index = ageBands.findIndex((band) => band.id === id);
  if (index < 0) return ageBands;
  const result = ageBands.filter((band) => band.id !== id);
  if (index === 0) {
    result[0] = { ...result[0], minAge: ageBands[index].minAge, label: `${ageBands[index].minAge ?? 0}-${result[0].maxAge ?? "+"}` };
  } else {
    const previous = result[index - 1];
    previous.maxAge = ageBands[index].maxAge;
    previous.label = previous.maxAge === null ? `${previous.minAge}+` : `${previous.minAge}-${previous.maxAge}`;
  }
  return result;
}
