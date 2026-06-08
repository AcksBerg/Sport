import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { countSportAttempts, deleteSportAttempts, replaceSportWithHistory, useSport } from "@/infrastructure/repositories";
import { createSportPackage, parseSportPackage, prepareSportReplacement } from "@/services/sportExchange";
import { createId, slugify, type AutomaticCutoffMode, type AutomaticCutoffResult, type Discipline, type Gender, type Sport, type Unit } from "@/domain";
import { determineAutomaticSportCutoffs } from "@/domain/scoring";
import { PageTitle, UnitValueInput } from "@/shared/components";
import { AdjustmentEditor } from "../editor/AdjustmentEditor";
import { AutomaticPointModifierEditor } from "../editor/AutomaticPointModifierEditor";
import { DisciplineAgeBandsEditor } from "../editor/DisciplineAgeBandsEditor";
import { FormulaChart } from "../editor/FormulaChart";
import { FormulaRulesEditor } from "../editor/FormulaRulesEditor";
import { TableRulesEditor } from "../editor/TableRulesEditor";
export function SportEditPage() {
  const { slug } = useParams();
  const stored = useSport(slug);
  const [draft, setDraft] = useState<Sport>();
  const [cutoffPromptOpen, setCutoffPromptOpen] = useState(false);
  const [cutoffResult, setCutoffResult] = useState<AutomaticCutoffResult>();
  const sport = draft ?? stored;
  const navigate = useNavigate();
  if (!sport) return <p>Lade Editor …</p>;
  const activeSport = sport;
  const update = (change: Partial<Sport>) =>
    setDraft({ ...activeSport, ...change });
  const updateDiscipline = (id: string, change: Partial<Discipline>) =>
    update({
      disciplines: activeSport.disciplines.map((item) =>
        item.id === id ? { ...item, ...change } : item,
      ),
    });
  async function save() {
    await replaceSportWithHistory(activeSport.id, activeSport);
    setDraft(undefined);
    navigate(`/sportart/${activeSport.slug}`);
  }
  function applyAutomaticCutoffs(mode: AutomaticCutoffMode) {
    const result = determineAutomaticSportCutoffs(activeSport, mode);
    setDraft(result.sport);
    setCutoffResult(result);
    setCutoffPromptOpen(false);
  }
  function determineCutoffs() {
    if (activeSport.disciplines.some((discipline) => discipline.cutoff))
      setCutoffPromptOpen(true);
    else applyAutomaticCutoffs("preserveExisting");
  }
  function exportCurrentSport() {
    const blob = new Blob(
      [JSON.stringify(createSportPackage(activeSport), null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${activeSport.slug}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  async function importIntoEditor(file: File) {
    try {
      const pkg = parseSportPackage(JSON.parse(await file.text()));
      setDraft(prepareSportReplacement(activeSport, pkg.sport));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Import fehlgeschlagen.");
    }
  }
  function addDiscipline() {
    const maxPoints =
      activeSport.disciplines.length === 0
        ? activeSport.totalMaxPoints
        : activeSport.totalMaxPoints / (activeSport.disciplines.length + 1);
    const formulas = activeSport.ageBands.flatMap((band) =>
      (["male", "female"] as Gender[]).map((gender) => ({
        gender,
        ageBandId: band.id,
        formulaValueUnit: "display" as const,
        segments: [
          {
            id: createId(),
            from: null,
            to: null,
            kind: "linear" as const,
            a: 0,
            b: 1,
            c: 0,
          },
        ],
      })),
    );
    update({
      disciplines: [
        ...activeSport.disciplines,
        {
          id: createId(),
          name: "Neue Disziplin",
          unit: "repetitions",
          maxPoints,
          formulas,
          automaticPointModifiers: [],
          ageBands: structuredClone(activeSport.ageBands),
        },
      ],
    });
  }
  async function removeDiscipline(id: string) {
    const historyCount = await countSportAttempts(activeSport.id);
    if (
      historyCount > 0 &&
      !confirm(
        "Für diese Sportart existiert ein Verlauf. Beim Entfernen der Disziplin muss der gesamte Verlauf dieser Sportart gelöscht werden. Fortfahren?",
      )
    )
      return;
    if (historyCount > 0)
      await deleteSportAttempts(activeSport.id);
    update({
      disciplines: activeSport.disciplines.filter((item) => item.id !== id),
    });
  }
  return (
    <>
      <PageTitle intro="Änderungen an Formeln berechnen bestehende Rohleistungen unmittelbar neu.">
        Sportart bearbeiten
      </PageTitle>
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <button className="button-secondary" onClick={determineCutoffs}>
          Cut-offs automatisch bestimmen
        </button>
        <label className="button-secondary cursor-pointer">
          Sportpaket laden
          <input
            className="hidden"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importIntoEditor(file);
              event.target.value = "";
            }}
          />
        </label>
        <button className="button-secondary" onClick={exportCurrentSport}>
          Sportart exportieren
        </button>
      </div>
      {cutoffResult && (
        <div className="notice mb-4">
          <strong>Automatische Cut-off-Ermittlung abgeschlossen.</strong>
          <p className="mt-1 text-sm">
            Neu: {cutoffResult.created.length}, überschrieben:{" "}
            {cutoffResult.overwritten.length}, beibehalten:{" "}
            {cutoffResult.preserved.length}, nicht bestimmbar:{" "}
            {cutoffResult.notDeterminable.length}.
          </p>
          {cutoffResult.notDeterminable.length > 0 && (
            <p className="mt-1 text-sm">
              Nicht bestimmbar: {cutoffResult.notDeterminable.join(", ")}
            </p>
          )}
        </div>
      )}
      {cutoffPromptOpen && (
        <dialog
          open
          className="m-auto max-w-xl rounded-xl bg-surface p-6 text-on-surface shadow-xl backdrop:bg-black/70"
        >
          <h2 className="text-xl font-black">Bestehende Cut-offs gefunden</h2>
          <p className="mt-2">
            Sollen vorhandene Cut-offs beibehalten oder durch eindeutig
            bestimmbare automatische Cut-offs überschrieben werden?
          </p>
          <p className="mt-2 text-sm text-secondary">
            Nicht automatisch bestimmbare Cut-offs bleiben in beiden Fällen
            erhalten.
          </p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button
              className="button-secondary"
              onClick={() => setCutoffPromptOpen(false)}
            >
              Abbrechen
            </button>
            <button
              className="button-secondary"
              onClick={() => applyAutomaticCutoffs("preserveExisting")}
            >
              Bestehende behalten
            </button>
            <button
              className="button-primary"
              onClick={() => applyAutomaticCutoffs("overwriteExisting")}
            >
              Bestehende überschreiben
            </button>
          </div>
        </dialog>
      )}
      <section className="card mb-6 grid gap-4 md:grid-cols-2">
        <label>
          Name
          <input
            value={sport.name}
            onChange={(e) => update({ name: e.target.value })}
          />
        </label>
        <label>
          Kurzname / Route
          <input
            value={sport.slug}
            onChange={(e) => update({ slug: slugify(e.target.value) })}
          />
        </label>
        <label>
          Gesamtmaximum
          <input
            type="number"
            min="1"
            value={sport.totalMaxPoints}
            onChange={(e) => update({ totalMaxPoints: Number(e.target.value) })}
          />
        </label>
        <label>
          Vergleichsmaximum
          <input
            type="number"
            min="1"
            value={sport.comparisonMaxPoints ?? sport.totalMaxPoints}
            onChange={(e) =>
              update({ comparisonMaxPoints: Number(e.target.value) })
            }
          />
        </label>
        <label>
          Mindestgesamtpunkte
          <input
            type="number"
            min="0"
            value={sport.minimumTotalPoints ?? ""}
            onChange={(e) =>
              update({
                minimumTotalPoints:
                  e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
          />
        </label>
        <label>
          Altersberechnung
          <select
            value={sport.agePolicy ?? "attemptDate"}
            onChange={(e) =>
              update({ agePolicy: e.target.value as Sport["agePolicy"] })
            }
          >
            <option value="attemptDate">Am Testtag</option>
            <option value="calendarYear">Im Kalenderjahr erreicht</option>
          </select>
        </label>
        <label>
          Gesamtwertung
          <select
            value={sport.aggregation}
            onChange={(e) =>
              update({ aggregation: e.target.value as Sport["aggregation"] })
            }
          >
            <option value="sum">Summe</option>
            <option value="percentageAverage">Prozentmittel</option>
          </select>
        </label>
        <label>
          Rundung
          <select
            value={sport.roundingMode}
            onChange={(e) =>
              update({ roundingMode: e.target.value as Sport["roundingMode"] })
            }
          >
            <option value="floor">Abrunden</option>
            <option value="round">Kaufmännisch</option>
            <option value="ceil">Aufrunden</option>
          </select>
        </label>
        <label>
          Dezimalstellen
          <input
            type="number"
            min="0"
            max="3"
            value={sport.decimalPlaces}
            onChange={(e) => update({ decimalPlaces: Number(e.target.value) })}
          />
        </label>
        <label className="md:col-span-2">
          Beschreibung
          <textarea
            value={sport.description}
            onChange={(e) => update({ description: e.target.value })}
          />
        </label>
      </section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="section-title m-0">Disziplinen und Formeln</h2>
        <button className="button-secondary" onClick={addDiscipline}>
          Disziplin hinzufügen
        </button>
      </div>
      <div className="space-y-5">
        {sport.disciplines.map((discipline) => (
          <section className="card" key={discipline.id}>
            <div className="grid gap-3 md:grid-cols-3">
              <label>
                Name
                <input
                  value={discipline.name}
                  onChange={(e) =>
                    updateDiscipline(discipline.id, { name: e.target.value })
                  }
                />
              </label>
              <label>
                Einheit
                <select
                  value={discipline.unit}
                  onChange={(e) =>
                    updateDiscipline(discipline.id, {
                      unit: e.target.value as Unit,
                    })
                  }
                >
                  <option value="time">Zeit</option>
                  <option value="distance">Distanz</option>
                  <option value="repetitions">Wiederholungen</option>
                </select>
              </label>
              <label>
                Maximale Punkte
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={discipline.maxPoints}
                  onChange={(e) =>
                    updateDiscipline(discipline.id, {
                      maxPoints: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                Mindestpunkte zum Bestehen
                <input
                  type="number"
                  min="0"
                  value={discipline.minimumPoints ?? ""}
                  onChange={(e) =>
                    updateDiscipline(discipline.id, {
                      minimumPoints:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                Bewertungsart
                <select
                  value={discipline.scoringMode ?? "formula"}
                  onChange={(e) =>
                    updateDiscipline(discipline.id, {
                      scoringMode: e.target.value as Discipline["scoringMode"],
                    })
                  }
                >
                  <option value="formula">Formel</option>
                  <option value="table">Bewertungstabelle</option>
                </select>
              </label>
            </div>
            <h3 className="mt-5 font-bold">Altersbereiche dieser Disziplin</h3>
            <DisciplineAgeBandsEditor
              discipline={discipline}
              onChange={(next) => updateDiscipline(discipline.id, next)}
            />
            <h3 className="mt-5 font-bold">Cut-off</h3>
            <div className="mt-2 grid gap-3 md:grid-cols-4">
              <label>
                Typ
                <select
                  value={discipline.cutoff?.kind ?? ""}
                  onChange={(e) =>
                    updateDiscipline(discipline.id, {
                      cutoff: e.target.value
                        ? {
                            kind: e.target.value as "performance" | "points",
                            comparison: "below",
                            threshold: 0,
                            effect: "discipline",
                            origin: "manual",
                          }
                        : undefined,
                    })
                  }
                >
                  <option value="">Keiner</option>
                  <option value="performance">Leistung</option>
                  <option value="points">Punkte</option>
                </select>
              </label>
              {discipline.cutoff && (
                <>
                  <label>
                    Vergleich
                    <select
                      value={discipline.cutoff.comparison}
                      onChange={(e) =>
                        updateDiscipline(discipline.id, {
                          cutoff: {
                            ...discipline.cutoff!,
                            comparison: e.target.value as "below" | "above",
                            origin: "manual",
                          },
                        })
                      }
                    >
                      <option value="below">Unterschreitet</option>
                      <option value="above">Überschreitet</option>
                    </select>
                  </label>
                  <label>
                    Grenze
                    {discipline.cutoff.kind === "performance" ? (
                      <UnitValueInput
                        discipline={discipline}
                        value={discipline.cutoff.threshold}
                        onChange={(value) =>
                          value !== undefined &&
                          updateDiscipline(discipline.id, {
                            cutoff: {
                              ...discipline.cutoff!,
                              threshold: value,
                              origin: "manual",
                            },
                          })
                        }
                      />
                    ) : (
                      <input
                        type="number"
                        value={discipline.cutoff.threshold}
                        onChange={(e) =>
                          updateDiscipline(discipline.id, {
                            cutoff: {
                              ...discipline.cutoff!,
                              threshold: Number(e.target.value),
                              origin: "manual",
                            },
                          })
                        }
                      />
                    )}
                  </label>
                  <label>
                    Wirkung
                    <select
                      value={discipline.cutoff.effect}
                      onChange={(e) =>
                        updateDiscipline(discipline.id, {
                          cutoff: {
                            ...discipline.cutoff!,
                            effect: e.target.value as "discipline" | "attempt",
                            origin: "manual",
                          },
                        })
                      }
                    >
                      <option value="discipline">Disziplin = 0</option>
                      <option value="attempt">Durchgang = 0</option>
                    </select>
                  </label>
                </>
              )}
            </div>
            <h3 className="mt-5 font-bold">Bonus- und Strafkorrekturen</h3>
            <AdjustmentEditor
              discipline={discipline}
              onChange={(adjustmentGroups) =>
                updateDiscipline(discipline.id, { adjustmentGroups })
              }
            />
            <h3 className="mt-5 font-bold">Automatische Punkteboni</h3>
            <AutomaticPointModifierEditor
              modifiers={discipline.automaticPointModifiers ?? []}
              onChange={(automaticPointModifiers) =>
                updateDiscipline(discipline.id, { automaticPointModifiers })
              }
            />
            <h3 className="mt-5 font-bold">
              {discipline.scoringMode === "table"
                ? "Bewertungstabellen"
                : "Formeln: a·x² + b·x + c"}
            </h3>
            {discipline.scoringMode === "table" ? (
              <TableRulesEditor
                discipline={discipline}
                onChange={(tables) =>
                  updateDiscipline(discipline.id, { tables })
                }
              />
            ) : (
              <FormulaRulesEditor
                discipline={discipline}
                onChange={(formulas) =>
                  updateDiscipline(discipline.id, { formulas })
                }
              />
            )}
            <div className="mt-5">
              <FormulaChart discipline={discipline} />
            </div>
            <button
              className="mt-4 text-sm font-bold text-error underline"
              onClick={() => removeDiscipline(discipline.id)}
            >
              Disziplin entfernen
            </button>
          </section>
        ))}
      </div>
      <div className="sticky bottom-4 mt-6 flex justify-end">
        <button className="button-primary shadow-lg" onClick={save}>
          Änderungen speichern
        </button>
      </div>
    </>
  );
}
