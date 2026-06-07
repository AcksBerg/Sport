import Dexie, { type EntityTable } from "dexie";
import type { Attempt, Sport, StandardSportsSyncReport, UserProfile } from "./domain";
import { attachStandardSync, loadStandardCatalog, prepareStandardUpdate, sportFingerprint, standardIsLocallyUnchanged } from "./standardCatalog";

export const db = new Dexie("sportleistung") as Dexie & {
  profile: EntityTable<UserProfile, "id">;
  sports: EntityTable<Sport, "id">;
  attempts: EntityTable<Attempt, "id">;
};

let lastStandardSportsReport: StandardSportsSyncReport | undefined;

export function getLastStandardSportsReport() {
  return lastStandardSportsReport;
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

export async function restoreStandardSports(fetcher: typeof fetch = fetch): Promise<StandardSportsSyncReport> {
  const report: StandardSportsSyncReport = { created: [], updated: [], preserved: [], errors: [] };
  try {
    const loaded = await loadStandardCatalog(fetcher);
    report.errors.push(...loaded.errors);
    for (const standard of loaded.standards) {
      const existing = await db.sports.where("slug").equals(standard.sport.slug).first();
      if (!existing) {
        await db.sports.put(attachStandardSync(standard.sport, standard));
        report.created.push(standard.sport.name);
        continue;
      }
      if (!existing.standardSync) {
        if (sportFingerprint(existing) === standard.fingerprint) {
          await db.sports.put(attachStandardSync(existing, standard));
        }
        report.preserved.push(existing.name);
        continue;
      }
      if (!standardIsLocallyUnchanged(existing)) {
        report.preserved.push(existing.name);
        continue;
      }
      if (existing.standardSync.sourceFingerprint === standard.fingerprint) {
        report.preserved.push(existing.name);
        continue;
      }
      await replaceSportWithHistory(existing.id, prepareStandardUpdate(existing, standard));
      report.updated.push(existing.name);
    }
  } catch (error) {
    report.errors.push(error instanceof Error ? error.message : "Standardkatalog konnte nicht geladen werden.");
  }
  lastStandardSportsReport = report;
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("standard-sports-sync", { detail: report }));
  return report;
}

export async function deleteSport(id: string, withHistory = false) {
  const count = await db.attempts.where("sportId").equals(id).count();
  if (count > 0 && !withHistory) return false;
  await db.transaction("rw", db.sports, db.attempts, async () => {
    if (withHistory) await db.attempts.where("sportId").equals(id).delete();
    await db.sports.delete(id);
  });
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
}
