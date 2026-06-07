export type Gender = "male" | "female";
export type Unit = "time" | "distance" | "repetitions";
export type Aggregation = "sum" | "percentageAverage";
export type RoundingMode = "floor" | "round" | "ceil";
export type CutoffKind = "performance" | "points";
export type CutoffEffect = "discipline" | "attempt";
export type Comparison = "below" | "above";
export type ScoringMode = "formula" | "table";
export type AgePolicy = "attemptDate" | "calendarYear";
export type PassStatus = "passed" | "failed" | "notEvaluable";
export type AdjustmentTarget = "performance" | "points";
export type AdjustmentEffect = "performanceAdjustment" | "pointAdjustment" | "minimumPoints" | "maximumPoints";
export type CutoffOrigin = "manual" | "automatic";
export type AutomaticCutoffMode = "preserveExisting" | "overwriteExisting";
export type FormulaValueUnit = "internal" | "display";
export type AutomaticPointModifierKind = "fixedPercentage" | "agePercentagePerYear";
export type ModifierGender = Gender | "all";

export interface UserProfile {
  id: "local";
  birthDate: string;
  gender: Gender;
  targetPoints: number;
}

export interface AgeBand {
  id: string;
  minAge: number | null;
  maxAge: number | null;
  label: string;
}

export interface FormulaSegment {
  id: string;
  from: number | null;
  to: number | null;
  kind: "linear" | "quadratic";
  a: number;
  b: number;
  c: number;
}

export interface FormulaRule {
  gender: Gender;
  ageBandId: string;
  segments: FormulaSegment[];
  formulaValueUnit?: FormulaValueUnit;
}

export interface TableRow {
  id: string;
  from: number | null;
  to: number | null;
  points: number;
}

export interface TableRule {
  gender: Gender;
  ageBandId: string;
  rows: TableRow[];
  generatorRecipe?: TableGeneratorRecipe;
}

export interface TableGeneratorRecipe {
  kind: "linear" | "quadratic";
  a: number;
  b: number;
  c: number;
  minPoints: number;
  maxPoints: number;
  minValue: number;
  maxValue: number;
  pointStep?: number;
  formulaValueUnit?: "internal" | "display";
  direction: "lowerIsBetter" | "higherIsBetter";
}

export interface AdjustmentOption {
  id: string;
  label: string;
  valueAdjustment: number;
  effect?: AdjustmentEffect;
}

export interface AdjustmentGroup {
  id: string;
  label: string;
  required: boolean;
  /** Legacy field; options carry their own effect. */
  target?: AdjustmentTarget;
  options: AdjustmentOption[];
}

export interface AutomaticPointModifier {
  id: string;
  label: string;
  kind: AutomaticPointModifierKind;
  factor: number;
  gender: ModifierGender;
  minAge?: number;
  maxAge?: number;
  referenceAge?: number;
}

export interface AutomaticPointBonus {
  modifierId: string;
  label: string;
  points: number;
}

export interface CutoffRule {
  kind: CutoffKind;
  comparison: Comparison;
  threshold: number;
  effect: CutoffEffect;
  origin?: CutoffOrigin;
}

export interface AutomaticCutoffResult {
  sport: Sport;
  created: string[];
  overwritten: string[];
  preserved: string[];
  notDeterminable: string[];
}

export interface Discipline {
  id: string;
  name: string;
  unit: Unit;
  maxPoints: number;
  minimumPoints?: number;
  cutoff?: CutoffRule;
  scoringMode?: ScoringMode;
  formulas: FormulaRule[];
  tables?: TableRule[];
  adjustmentGroups?: AdjustmentGroup[];
  automaticPointModifiers?: AutomaticPointModifier[];
  ageBands: AgeBand[];
}

export interface Sport {
  id: string;
  slug: string;
  name: string;
  description: string;
  totalMaxPoints: number;
  comparisonMaxPoints?: number;
  minimumTotalPoints?: number;
  agePolicy?: AgePolicy;
  aggregation: Aggregation;
  roundingMode: RoundingMode;
  decimalPlaces: number;
  /** Legacy/template age bands; scoring uses discipline.ageBands. */
  ageBands: AgeBand[];
  disciplines: Discipline[];
  standard?: boolean;
  standardSync?: {
    version: string;
    sourceFingerprint: string;
    localFingerprint: string;
  };
}

export interface StandardSportsManifest {
  sports: { file: string; version: string }[];
}

export interface StandardSportsSyncReport {
  created: string[];
  updated: string[];
  preserved: string[];
  errors: string[];
}

export interface SportExchangePackageV1 {
  schemaVersion: 1;
  exportedAt: string;
  sport: Sport;
}

export interface SportExchangePackageV2 {
  schemaVersion: 2;
  exportedAt: string;
  sport: Sport;
}

export type SportExchangePackage = SportExchangePackageV1 | SportExchangePackageV2;

export interface Performance {
  disciplineId: string;
  value: number;
  selectedAdjustmentOptionIds?: string[];
}

export interface Attempt {
  id: string;
  sportId: string;
  date: string;
  status: "draft" | "complete";
  performances: Performance[];
}

export interface DisciplineScore {
  disciplineId: string;
  rawPoints: number;
  points: number;
  cutoffTriggered: boolean;
  evaluatedValue: number;
  minimumMet: boolean;
  basePoints: number;
  pointAdjustment: number;
  automaticBonusPoints: number;
  automaticBonuses: AutomaticPointBonus[];
}

export interface AttemptScore {
  disciplineScores: DisciplineScore[];
  total: number | null;
  attemptCutoffTriggered: boolean;
  passStatus: PassStatus | null;
  failedRequirements: string[];
}

export interface BestSportAttempt {
  sportId: string;
  attempt: Attempt;
  rawTotal: number;
  comparisonScore: number;
  passStatus: PassStatus | null;
}

export interface EvaluatedSportAttempt {
  attempt: Attempt;
  result: AttemptScore;
  comparisonScore: number | null;
  isBest: boolean;
}

export interface UserProgress {
  bestBySport: BestSportAttempt[];
  achievedPoints: number;
  targetPoints: number;
  remainingPoints: number;
  excessPoints: number;
  percentage: number;
}

export const createId = () => crypto.randomUUID();

export const slugify = (value: string) =>
  value
    .toLocaleLowerCase("de")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
