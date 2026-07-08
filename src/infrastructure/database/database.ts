import Dexie, { type EntityTable } from "dexie";
import { normalizeAgeBands, type Attempt, type Sport, type StandardCatalogState, type StandardSportStatus, type StandardSportsSyncReport, type UserProfile } from "@/domain";
import { attachStandardSync, loadStandardCatalog, prepareStandardUpdate, sportFingerprint } from "@/services/standardCatalog";

export const db = new Dexie("sportleistung") as Dexie & {
  profile: EntityTable<UserProfile, "id">;
  sports: EntityTable<Sport, "id">;
  attempts: EntityTable<Attempt, "id">;
};

let lastStandardSportsReport: StandardSportsSyncReport | undefined;
type LoadedStandard = Awaited<ReturnType<typeof loadStandardCatalog>>["standards"][number];
let lastLoadedStandards = new Map<string, LoadedStandard>();
let lastStandardCatalogState: StandardCatalogState = {
  loaded: false,
  statuses: [],
  report: { created: [], updated: [], preserved: [], errors: [] },
};

export function getLastStandardSportsReport() {
  return lastStandardSportsReport;
}

export function getStandardCatalogState() {
  return lastStandardCatalogState;
}

db.version(1).stores({
  profile: "id",
  sports: "id, &slug, name",
  attempts: "id, sportId, date, status",
});

db.version(2)
  .stores({
    profile: "id",
    sports: "id, &slug, name",
    attempts: "id, sportId, date, status",
  })
  .upgrade(async (transaction) => {
    await transaction
      .table<Sport>("sports")
      .toCollection()
      .modify((sport) => {
        sport.comparisonMaxPoints ??= sport.totalMaxPoints;
        sport.agePolicy ??= "attemptDate";
        sport.disciplines.forEach((discipline) => {
          discipline.scoringMode ??= "formula";
          discipline.tables ??= [];
          discipline.adjustmentGroups ??= [];
        });
      });
  });

db.version(3)
  .stores({
    profile: "id",
    sports: "id, &slug, name",
    attempts: "id, sportId, date, status",
  })
  .upgrade(async (transaction) => {
    await transaction
      .table<Sport>("sports")
      .toCollection()
      .modify((sport) => {
        sport.disciplines.forEach((discipline) => {
          discipline.ageBands ??= structuredClone(sport.ageBands ?? [
            { id: crypto.randomUUID(), minAge: 0, maxAge: 100, label: "0-100" },
          ]);
        });
      });
  });

db.version(4)
  .stores({
    profile: "id",
    sports: "id, &slug, name",
    attempts: "id, sportId, date, status",
  })
  .upgrade(async (transaction) => {
    await transaction
      .table<Sport>("sports")
      .toCollection()
      .modify((sport) => {
        sport.disciplines.forEach((discipline) => {
          discipline.adjustmentGroups = (discipline.adjustmentGroups ?? []).map((group) => {
            const legacy = group as typeof group & { minSelections?: number };
            const required = legacy.required ?? (legacy.minSelections ?? 0) > 0;
            const options = [...group.options];
            if (!required && !options.some((option) => option.valueAdjustment === 0))
              options.unshift({ id: crypto.randomUUID(), label: "Nicht vergeben", valueAdjustment: 0 });
            return { id: group.id, label: group.label, required, target: legacy.target ?? "performance", options };
          });
        });
      });
  });

db.version(5)
  .stores({
    profile: "id",
    sports: "id, &slug, name",
    attempts: "id, sportId, date, status",
  })
  .upgrade(async (transaction) => {
    await transaction
      .table<Sport>("sports")
      .toCollection()
      .modify((sport) => {
        void sport;
      });
  });

db.version(6)
  .stores({
    profile: "id",
    sports: "id, &slug, name",
    attempts: "id, sportId, date, status",
  })
  .upgrade(async (transaction) => {
    await transaction.table<Sport>("sports").toCollection().modify((sport) => {
      sport.disciplines.forEach((discipline) => {
        discipline.tables?.forEach((table) => {
          if (!table.generatorRecipe) return;
          table.generatorRecipe.pointStep ??= 1;
          if (!table.generatorRecipe.formulaValueUnit && discipline.unit === "time") {
            table.generatorRecipe.a *= 1_000_000;
            table.generatorRecipe.b *= 1000;
          }
          table.generatorRecipe.formulaValueUnit = "display";
        });
      });
    });
  });

db.version(7)
  .stores({
    profile: "id",
    sports: "id, &slug, name",
    attempts: "id, sportId, date, status",
  })
  .upgrade(async (transaction) => {
    await transaction.table<Sport>("sports").toCollection().modify((sport) => {
      sport.disciplines.forEach((discipline) => {
        discipline.adjustmentGroups?.forEach((group) => {
          group.options.forEach((option) => {
            option.effect ??= group.target === "points" ? "pointAdjustment" : "performanceAdjustment";
          });
          delete group.target;
        });
      });
    });
  });

db.version(8)
  .stores({
    profile: "id",
    sports: "id, &slug, name",
    attempts: "id, sportId, date, status",
  })
  .upgrade(async (transaction) => {
    await transaction.table<UserProfile>("profile").toCollection().modify((profile) => {
      profile.targetPoints ??= 130;
    });
  });

db.version(9)
  .stores({
    profile: "id",
    sports: "id, &slug, name",
    attempts: "id, sportId, date, status",
  })
  .upgrade(async (transaction) => {
    await transaction.table<Sport>("sports").toCollection().modify((sport) => {
      sport.decimalPlaces = 2;
      sport.disciplines.forEach((discipline) => {
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
      if (sport.standardSync)
        sport.standardSync.localFingerprint = sportFingerprint(sport);
    });
  });

db.version(10)
  .stores({
    profile: "id",
    sports: "id, &slug, name",
    attempts: "id, sportId, date, status",
  })
  .upgrade(async (transaction) => {
    await transaction.table<Sport>("sports").toCollection().modify((sport) => {
      sport.disciplines.forEach((discipline) => {
        try {
          discipline.ageBands = normalizeAgeBands(discipline.ageBands);
        } catch {
          // Invalid legacy definitions remain editable instead of blocking database startup.
        }
      });
    });
  });

db.version(11)
  .stores({
    profile: "id",
    sports: "id, &slug, name",
    attempts: "id, sportId, date, status",
  })
  .upgrade(async (transaction) => {
    await transaction.table<Sport>("sports").toCollection().modify((sport) => {
      sport.minimumViolationEffect ??= "statusOnly";
      sport.disciplines.forEach((discipline) => {
        discipline.capPoints ??= true;
        discipline.referenceMaxPoints ??= discipline.maxPoints;
      });
    });
  });

function createStandardStatuses(sports: Sport[]): StandardSportStatus[] {
  const bySlug = new Map(sports.map((sport) => [sport.slug, sport]));
  const statuses: StandardSportStatus[] = sports
    .filter((sport) => !lastLoadedStandards.has(sport.slug))
    .map((sport) => ({
      sportId: sport.id,
      slug: sport.slug,
      name: sport.name,
      isStandard: Boolean(sport.standard),
      isOutdated: false,
      isLocallyModified: Boolean(
        sport.standardSync &&
          sportFingerprint(sport) !== sport.standardSync.localFingerprint,
      ),
      hasConflict: false,
    }));
  for (const [slug, loaded] of lastLoadedStandards) {
    const existing = bySlug.get(slug);
    statuses.push({
      sportId: existing?.id,
      slug,
      name: existing?.name ?? loaded.sport.name,
      isStandard: Boolean(existing?.standard),
      isOutdated: Boolean(
        existing &&
          existing.standardSync?.sourceFingerprint !== loaded.fingerprint,
      ),
      isLocallyModified: Boolean(
        existing &&
          (existing.standardSync
            ? sportFingerprint(existing) !== existing.standardSync.localFingerprint
            : existing.standard),
      ),
      hasConflict: Boolean(existing && !existing.standard),
    });
  }
  return statuses;
}

async function publishCatalogState(report: StandardSportsSyncReport) {
  const latestExportedAt = [...lastLoadedStandards.values()]
    .map((standard) => standard.sport.sourceExportedAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0];
  lastStandardSportsReport = report;
  lastStandardCatalogState = {
    loaded: true,
    statuses: createStandardStatuses(await db.sports.toArray()),
    report,
    latestExportedAt,
  };
  if (typeof window !== "undefined")
    window.dispatchEvent(
      new CustomEvent("standard-sports-sync", {
        detail: lastStandardCatalogState,
      }),
    );
  return lastStandardCatalogState;
}

export async function restoreStandardSports(fetcher: typeof fetch = fetch): Promise<StandardSportsSyncReport> {
  const report: StandardSportsSyncReport = { created: [], updated: [], preserved: [], errors: [] };
  try {
    const loaded = await loadStandardCatalog(fetcher);
    lastLoadedStandards = new Map(
      loaded.standards.map((standard) => [standard.sport.slug, standard]),
    );
    report.errors.push(...loaded.errors);
    for (const standard of loaded.standards) {
      const existing = await db.sports.where("slug").equals(standard.sport.slug).first();
      if (!existing) {
        await db.sports.put(attachStandardSync(standard.sport, standard));
        report.created.push(standard.sport.name);
        continue;
      }
      if (!existing.standard) {
        report.errors.push(
          `${standard.sport.name}: Eine eigene Sportart verwendet bereits diesen Kurzname.`,
        );
        report.preserved.push(existing.name);
        continue;
      }
      if (!existing.standardSync) {
        if (sportFingerprint(existing) === standard.fingerprint) {
          await db.sports.put(attachStandardSync(existing, standard));
          report.preserved.push(existing.name);
        } else {
          await replaceSportWithHistory(
            existing.id,
            prepareStandardUpdate(existing, standard),
          );
          report.updated.push(standard.sport.name);
        }
        continue;
      }
      if (existing.standardSync.sourceFingerprint !== standard.fingerprint) {
        await replaceSportWithHistory(
          existing.id,
          prepareStandardUpdate(existing, standard),
        );
        report.updated.push(standard.sport.name);
        continue;
      }
      if (existing.sourceExportedAt !== standard.sport.sourceExportedAt) {
        await db.sports.put({
          ...existing,
          sourceExportedAt: standard.sport.sourceExportedAt,
        });
      }
      report.preserved.push(existing.name);
    }
  } catch (error) {
    report.errors.push(error instanceof Error ? error.message : "Standardkatalog konnte nicht geladen werden.");
  }
  await publishCatalogState(report);
  return report;
}

export async function updateStandardSport(slug: string) {
  let loaded = lastLoadedStandards.get(slug);
  if (!loaded) {
    const catalog = await loadStandardCatalog();
    lastLoadedStandards = new Map(
      catalog.standards.map((standard) => [standard.sport.slug, standard]),
    );
    loaded = lastLoadedStandards.get(slug);
  }
  if (!loaded) throw new Error("Standard wurde im Katalog nicht gefunden.");
  const existing = await db.sports.where("slug").equals(slug).first();
  if (!existing) {
    await db.sports.put(attachStandardSync(loaded.sport, loaded));
  } else {
    if (!existing.standard)
      throw new Error("Eine eigene Sportart verwendet bereits diesen Kurzname.");
    await replaceSportWithHistory(
      existing.id,
      prepareStandardUpdate(existing, loaded),
    );
  }
  await publishCatalogState({
    created: [],
    updated: [loaded.sport.name],
    preserved: [],
    errors: [],
  });
}

export async function deleteSport(id: string, withHistory = false) {
  const count = await db.attempts.where("sportId").equals(id).count();
  if (count > 0 && !withHistory) return false;
  await db.transaction("rw", db.sports, db.attempts, async () => {
    if (withHistory) await db.attempts.where("sportId").equals(id).delete();
    await db.sports.delete(id);
  });
  await publishCatalogState(lastStandardCatalogState.report);
  return true;
}

export async function replaceSportWithHistory(existingId: string, replacement: Sport) {
  await db.transaction("rw", db.sports, db.attempts, async () => {
    const attempts = await db.attempts.where("sportId").equals(existingId).toArray();
    const disciplineIds = new Set(replacement.disciplines.map((discipline) => discipline.id));
    await db.attempts.bulkPut(
      attempts.map((attempt) => {
        const performances = attempt.performances.filter((performance) => disciplineIds.has(performance.disciplineId));
        return {
          ...attempt,
          performances,
          status: performances.length === replacement.disciplines.length ? attempt.status : "draft",
        };
      }),
    );
    await db.sports.put(replacement);
  });
  await publishCatalogState(lastStandardCatalogState.report);
}
