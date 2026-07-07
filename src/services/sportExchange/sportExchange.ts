import {
  createId,
  normalizeAgeBands,
  slugify,
  type Discipline,
  type Sport,
  type SportExchangePackage,
  type SportExchangePackageV2,
} from "@/domain";

const normalize = (value: string) => slugify(value);

export function createSportPackage(sport: Sport): SportExchangePackageV2 {
  const exported = structuredClone(sport);
  delete exported.standardSync;
  return { schemaVersion: 2, exportedAt: new Date().toISOString(), sport: exported };
}

export function parseSportPackage(value: unknown): SportExchangePackageV2 {
  if (!value || typeof value !== "object") throw new Error("Ungültiges Austauschpaket.");
  const candidate = value as Partial<SportExchangePackage>;
  if (
    ![1, 2].includes(candidate.schemaVersion ?? 0) ||
    !candidate.sport ||
    !Array.isArray(candidate.sport.disciplines)
  )
    throw new Error("Unbekannte oder unvollständige Sportpaketversion.");
  if (
    ![
      candidate.sport.totalMaxPoints,
      candidate.sport.comparisonMaxPoints ?? candidate.sport.totalMaxPoints,
    ].every(Number.isFinite)
  )
    throw new Error("Das Sportpaket enthält ungültige Zahlenwerte.");

  candidate.sport.minimumViolationEffect ??= "statusOnly";
  if (
    candidate.sport.comparisonFormula !== undefined &&
    !Array.isArray(candidate.sport.comparisonFormula)
  )
    throw new Error("Das Sportpaket enthält eine ungültige Vergleichsformel.");

  candidate.sport.disciplines.forEach((discipline) => {
    if (
      !["time", "distance", "repetitions"].includes(discipline.unit) ||
      !Array.isArray(discipline.ageBands)
    )
      throw new Error(`Ungültige Disziplin: ${discipline.name ?? "unbekannt"}.`);
    discipline.capPoints ??= true;
    discipline.referenceMaxPoints ??= discipline.maxPoints;
    if (![discipline.maxPoints, discipline.referenceMaxPoints].every(Number.isFinite))
      throw new Error(`Ungültige Punktwerte in ${discipline.name ?? "unbekannt"}.`);
    const bandIds = new Set(discipline.ageBands.map((band) => band.id));
    if (
      [...discipline.formulas, ...(discipline.tables ?? [])].some(
        (rule) => !bandIds.has(rule.ageBandId),
      )
    )
      throw new Error(`Ungültige Altersbereich-Referenz in ${discipline.name}.`);
    discipline.ageBands = normalizeAgeBands(discipline.ageBands);
  });

  candidate.sport.disciplines.forEach((discipline) => {
    discipline.automaticPointModifiers ??= [];
    discipline.formulas.forEach((rule) => {
      if (rule.formulaValueUnit === "display") return;
      if (discipline.unit === "time") {
        rule.segments.forEach((segment) => {
          segment.a *= 1_000_000;
          segment.b *= 1000;
        });
      }
      rule.formulaValueUnit = "display";
    });
  });
  candidate.schemaVersion = 2;
  return candidate as SportExchangePackageV2;
}

function cloneDiscipline(source: Discipline, retained?: Discipline): Discipline {
  const discipline = structuredClone(source);
  const bandIds = new Map(discipline.ageBands.map((band) => [band.id, createId()]));
  discipline.id = retained?.id ?? createId();
  discipline.ageBands = discipline.ageBands.map((band) => ({
    ...band,
    id: bandIds.get(band.id)!,
  }));
  discipline.formulas = discipline.formulas.map((rule) => ({
    ...rule,
    ageBandId: bandIds.get(rule.ageBandId)!,
    segments: rule.segments.map((segment) => ({ ...segment, id: createId() })),
  }));
  discipline.tables = discipline.tables?.map((rule) => ({
    ...rule,
    ageBandId: bandIds.get(rule.ageBandId)!,
    rows: rule.rows.map((row) => ({ ...row, id: createId() })),
  }));
  discipline.adjustmentGroups = discipline.adjustmentGroups?.map((group) => {
    const old = retained?.adjustmentGroups?.find(
      (candidate) => normalize(candidate.label) === normalize(group.label),
    );
    return {
      ...group,
      id: old?.id ?? createId(),
      options: group.options.map((option) => ({
        ...option,
        id:
          old?.options.find(
            (candidate) => normalize(candidate.label) === normalize(option.label),
          )?.id ?? createId(),
      })),
    };
  });
  discipline.automaticPointModifiers = discipline.automaticPointModifiers?.map(
    (modifier) => ({ ...modifier, id: createId() }),
  );
  return discipline;
}

export function cloneImportedSport(source: Sport, existingSlugs: string[]): Sport {
  const sport = structuredClone(source);
  const base = `${source.slug || slugify(source.name)}-kopie`;
  let slug = base;
  let suffix = 2;
  while (existingSlugs.includes(slug)) slug = `${base}-${suffix++}`;
  sport.id = createId();
  sport.name = `${source.name} (Kopie)`;
  sport.slug = slug;
  sport.standard = false;
  sport.disciplines = sport.disciplines.map((discipline) => cloneDiscipline(discipline));
  return sport;
}

export function prepareSportReplacement(existing: Sport, imported: Sport) {
  const retainedByName = new Map(
    existing.disciplines.map((discipline) => [normalize(discipline.name), discipline]),
  );
  const disciplines = imported.disciplines.map((discipline) =>
    cloneDiscipline(discipline, retainedByName.get(normalize(discipline.name))),
  );
  return {
    ...structuredClone(imported),
    id: existing.id,
    slug: existing.slug,
    standard: existing.standard,
    disciplines,
  };
}
