import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  attemptDateValue,
  formatAttemptDate,
  formatDataDate,
  localDateValue,
} from "@/shared/utils/dates";
import {
  countSportAttempts,
  deleteAttempt,
  deleteSport,
  saveAttempt,
  useProfile,
  useSport,
  useSportAttempts,
} from "@/infrastructure/repositories";
import { createId, type Attempt } from "@/domain";
import {
  adjustmentsValid,
  evaluateSportAttemptsWithDrafts,
} from "@/domain/scoring";
import { PageTitle, UnitValueInput } from "@/shared/components";
import { unitLabel } from "@/shared/labels";
import { formatUnitValue } from "@/shared/utils/units";
import { createSportPackage } from "@/services/sportExchange";
export function SportPage() {
  const { slug } = useParams();
  const sport = useSport(slug);
  const attempts = useSportAttempts(sport?.id);
  const profile = useProfile();
  const navigate = useNavigate();
  const [values, setValues] = useState<Record<string, number>>({});
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [editingAttemptId, setEditingAttemptId] = useState<string>();
  const [attemptDate, setAttemptDate] = useState(localDateValue);
  if (!sport) return <p>Lade Sportart …</p>;
  const activeSport = sport;
  const dataDate = formatDataDate(activeSport.sourceExportedAt);
  const historyEntries =
    profile && attempts
      ? evaluateSportAttemptsWithDrafts(profile, activeSport, attempts)
      : [...(attempts ?? [])]
          .sort((left, right) => right.date.localeCompare(left.date))
          .map((attempt) => ({
            attempt,
            result: null,
            comparisonScore: null,
            projectedResult: undefined,
            projectedComparisonScore: null,
            passingGaps: [],
            isBest: false,
            isBestProjectedDraft: false,
          }));
  const currentAttempt: Attempt = {
    id: editingAttemptId ?? "preview",
    sportId: activeSport.id,
    date: attemptDate || localDateValue(),
    status: "draft",
    performances: Object.entries(values).map(([disciplineId, value]) => ({
      disciplineId,
      value,
      selectedAdjustmentOptionIds: selections[disciplineId] ?? [],
    })),
  };
  const liveProjection =
    profile && currentAttempt.performances.length > 0
      ? evaluateSportAttemptsWithDrafts(profile, activeSport, [
          currentAttempt,
        ])[0]
      : undefined;
  async function save(status: Attempt["status"]) {
    if (!attemptDate)
      return alert("Bitte ein Datum für den Durchgang auswählen.");
    if (
      status === "complete" &&
      activeSport.disciplines.some((discipline) => {
        const value = values[discipline.id];
        return (
          value === undefined ||
          !adjustmentsValid(discipline, {
            disciplineId: discipline.id,
            value,
            selectedAdjustmentOptionIds: selections[discipline.id],
          })
        );
      })
    )
      return alert(
        "Für einen vollständigen Durchgang werden alle Leistungen und erforderlichen Bonus-/Strafauswahlen benötigt.",
      );
    await saveAttempt({
      id: editingAttemptId ?? createId(),
      sportId: activeSport.id,
      date: attemptDate,
      status,
      performances: Object.entries(values).map(([disciplineId, value]) => ({
        disciplineId,
        value,
        selectedAdjustmentOptionIds: selections[disciplineId] ?? [],
      })),
    });
    setValues({});
    setSelections({});
    setEditingAttemptId(undefined);
    setAttemptDate(localDateValue());
  }
  function editAttempt(attempt: Attempt) {
    setEditingAttemptId(attempt.id);
    setAttemptDate(attemptDateValue(attempt.date));
    setValues(
      Object.fromEntries(
        attempt.performances.map((performance) => [
          performance.disciplineId,
          performance.value,
        ]),
      ),
    );
    setSelections(
      Object.fromEntries(
        attempt.performances.map((performance) => [
          performance.disciplineId,
          performance.selectedAdjustmentOptionIds ?? [],
        ]),
      ),
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function cancelEditing() {
    setEditingAttemptId(undefined);
    setAttemptDate(localDateValue());
    setValues({});
    setSelections({});
  }
  function exportSport() {
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
  async function removeSport() {
    const historyCount = await countSportAttempts(activeSport.id);
    const message =
      historyCount > 0
        ? `Diese Sportart besitzt ${historyCount} Durchgänge. Sportart und gesamten Verlauf endgültig löschen?`
        : "Sportart endgültig löschen?";
    if (!confirm(message)) return;
    if (await deleteSport(activeSport.id, historyCount > 0))
      navigate("/sportart");
  }
  return (
    <>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <PageTitle
          intro={
            sport.description ||
            "Erfasse einen zusammenhängenden Durchgang und werte ihn anhand der aktuellen Regeln aus."
          }
        >
          {sport.name}
        </PageTitle>
        {dataDate && (
          <div className="card bg-surface-container px-4 py-3 text-right text-sm">
            <p className="text-secondary">Datenstand</p>
            <p className="font-black">{dataDate}</p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Link
            className="button-secondary"
            to={`/sportart/${sport.slug}/edit`}
          >
            Sportart bearbeiten
          </Link>
          <button className="button-secondary" onClick={exportSport}>
            Sportart exportieren
          </button>
          <button className="button-danger" onClick={() => void removeSport()}>
            Sportart löschen
          </button>
        </div>
      </div>
      <section className="card mb-8">
        <h2 className="section-title">
          {editingAttemptId ? "Durchgang bearbeiten" : "Neuer Durchgang"}
        </h2>
        {editingAttemptId && (
          <p className="notice mb-4">
            Du bearbeitest einen gespeicherten Durchgang.
          </p>
        )}
        <label className="mb-4 max-w-xs">
          Datum
          <input
            required
            type="date"
            value={attemptDate}
            onChange={(event) => setAttemptDate(event.target.value)}
          />
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          {sport.disciplines.map((discipline) => (
            <div key={discipline.id}>
              <label>
                {discipline.name}{" "}
                <span className="font-normal text-secondary">
                  ({unitLabel(discipline.unit)})
                </span>
                <UnitValueInput
                  discipline={discipline}
                  value={values[discipline.id]}
                  onChange={(value) =>
                    setValues((current) => {
                      const next = { ...current };
                      if (value === undefined) delete next[discipline.id];
                      else next[discipline.id] = value;
                      return next;
                    })
                  }
                />
              </label>
              {(discipline.adjustmentGroups ?? []).map((group) => (
                <fieldset
                  className="mt-2 rounded-lg bg-surface-container p-3"
                  key={group.id}
                >
                  <legend className="font-bold">
                    {group.label}
                    {group.required ? " (Pflicht)" : " (optional)"}
                  </legend>
                  {group.options.map((option) => (
                    <label
                      className="mt-2 flex grid-cols-none items-center gap-2"
                      key={option.id}
                    >
                      <input
                        className="w-auto"
                        type="radio"
                        name={`${discipline.id}-${group.id}`}
                        checked={(selections[discipline.id] ?? []).includes(
                          option.id,
                        )}
                        onChange={() =>
                          setSelections((current) => ({
                            ...current,
                            [discipline.id]: [
                              ...(current[discipline.id] ?? []).filter(
                                (id) =>
                                  !group.options.some(
                                    (candidate) => candidate.id === id,
                                  ),
                              ),
                              option.id,
                            ],
                          }))
                        }
                      />
                      {option.label}
                    </label>
                  ))}
                </fieldset>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-5 flex gap-2">
          <button className="button-secondary" onClick={() => save("draft")}>
            {editingAttemptId
              ? "Entwurf aktualisieren"
              : "Als Entwurf speichern"}
          </button>
          {editingAttemptId && (
            <button className="button-secondary" onClick={cancelEditing}>
              Bearbeitung abbrechen
            </button>
          )}
          <button
            className="button-primary"
            disabled={sport.disciplines.length === 0}
            onClick={() => save("complete")}
          >
            Vollständig speichern
          </button>
        </div>
        {liveProjection && (
          <div className="notice mt-4">
            {liveProjection.projectedResult?.total !== null &&
            liveProjection.projectedResult !== undefined ? (
              <>
                <p className="font-bold">
                  Prognose:{" "}
                  {liveProjection.projectedResult.total.toFixed(
                    sport.decimalPlaces,
                  )}{" "}
                  / {sport.totalMaxPoints.toFixed(sport.decimalPlaces)} Punkte
                </p>
                {liveProjection.passingGaps.length === 0 ? (
                  <p className="text-sm text-secondary">
                    Bestehensanforderungen erfüllt.
                  </p>
                ) : (
                  liveProjection.passingGaps.map((gap) => (
                    <p
                      className="text-sm text-error"
                      key={`${gap.kind}-${gap.label}`}
                    >
                      {formatPassingGap(gap, sport.decimalPlaces)}
                    </p>
                  ))
                )}
              </>
            ) : (
              <p className="text-sm text-error">Noch nicht bewertbar.</p>
            )}
          </div>
        )}
      </section>
      <h2 className="section-title">Verlauf</h2>
      {!profile && (
        <p className="notice mb-4">
          Ohne Nutzerprofil werden Rohleistungen angezeigt, aber keine Punkte
          berechnet.
        </p>
      )}
      <div className="space-y-3">
        {historyEntries.map(
          ({
            attempt,
            result,
            comparisonScore,
            projectedResult,
            projectedComparisonScore,
            passingGaps,
            isBest,
          }) => {
            const displayResult = projectedResult ?? result;
            const displayComparisonScore =
              projectedComparisonScore ?? comparisonScore;
            const isDraft = attempt.status === "draft";
            return (
              <article
                className={`card ${isBest ? "border-primary bg-primary-container" : ""} ${isDraft ? "border-error" : ""}`}
                key={attempt.id}
              >
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    {isBest && (
                      <span className="chip mb-2">Bester Versuch</span>
                    )}
                    {isDraft && (
                      <span className="chip mb-2 text-error">Entwurf</span>
                    )}
                    <strong>{formatAttemptDate(attempt.date)}</strong>
                    <p className="text-sm text-secondary">
                      {isDraft
                        ? projectedResult
                          ? "Entwurf · Prognose"
                          : "Entwurf · noch nicht bewertbar"
                        : "Vollständig"}
                    </p>
                  </div>
                  <div className="text-right">
                    <strong
                      className={`block text-xl ${isDraft ? "text-error" : "text-primary"}`}
                    >
                      {displayResult?.total !== null &&
                      displayResult?.total !== undefined
                        ? displayResult.total.toFixed(sport.decimalPlaces)
                        : "?"}{" "}
                      / {sport.totalMaxPoints.toFixed(sport.decimalPlaces)}
                    </strong>
                    <span className="text-sm text-secondary">
                      Vergleich:{" "}
                      {displayComparisonScore !== null
                        ? displayComparisonScore.toFixed(sport.decimalPlaces)
                        : "?"}{" "}
                      /{" "}
                      {(
                        sport.comparisonMaxPoints ?? sport.totalMaxPoints
                      ).toFixed(sport.decimalPlaces)}
                    </span>
                  </div>
                </div>
                {displayResult?.passStatus && (
                  <p
                    className={`mt-2 font-bold ${displayResult.passStatus === "passed" ? "text-secondary" : "text-error"}`}
                  >
                    {displayResult.passStatus === "passed"
                      ? "Bestanden"
                      : displayResult.passStatus === "failed"
                        ? "Nicht bestanden"
                        : "Nicht bewertbar"}
                  </p>
                )}
                {displayResult?.failedRequirements.map((requirement) => (
                  <p className="text-sm text-error" key={requirement}>
                    {requirement}
                  </p>
                ))}
                {displayResult?.total !== null &&
                  displayResult !== undefined &&
                  (passingGaps.length === 0 ? (
                    <p className="text-sm text-secondary">
                      Bestehensanforderungen erfüllt.
                    </p>
                  ) : (
                    passingGaps.map((gap) => (
                      <p
                        className="text-sm text-error"
                        key={`${attempt.id}-${gap.kind}-${gap.label}`}
                      >
                        {formatPassingGap(gap, sport.decimalPlaces)}
                      </p>
                    ))
                  ))}
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {attempt.performances.map((performance) => {
                    const discipline = sport.disciplines.find(
                      (item) => item.id === performance.disciplineId,
                    );
                    const score = displayResult?.disciplineScores.find(
                      (item) => item.disciplineId === performance.disciplineId,
                    );
                    return discipline ? (
                      <div
                        className="rounded-lg bg-surface-container p-3 text-sm"
                        key={performance.disciplineId}
                      >
                        <strong>{discipline.name}</strong>
                        <p>
                          {formatUnitValue(
                            score?.evaluatedValue ?? performance.value,
                            discipline.unit,
                          )}{" "}
                          -{" "}
                          {score
                            ? `${score.points.toFixed(sport.decimalPlaces)} Pkt.`
                            : "unbewertet"}
                        </p>
                        {score && (
                          <div className="mt-1 text-xs text-secondary">
                            <p>
                              Basis:{" "}
                              {score.basePoints.toFixed(sport.decimalPlaces)}{" "}
                              Pkt.
                            </p>
                            {score.automaticBonuses.map((bonus) => (
                              <p key={bonus.modifierId}>
                                {bonus.label}: +
                                {bonus.points.toFixed(sport.decimalPlaces)} Pkt.
                              </p>
                            ))}
                            {score.pointAdjustment !== 0 && (
                              <p>
                                Manuelle Korrektur:{" "}
                                {score.pointAdjustment > 0 ? "+" : ""}
                                {score.pointAdjustment.toFixed(
                                  sport.decimalPlaces,
                                )}{" "}
                                Pkt.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : null;
                  })}
                </div>
                <button
                  className="mt-4 text-sm font-bold text-error underline"
                  onClick={() => deleteAttempt(attempt.id)}
                >
                  Durchgang löschen
                </button>
                <button
                  className="button-secondary mt-4 ml-2"
                  onClick={() => editAttempt(attempt)}
                >
                  Bearbeiten
                </button>
              </article>
            );
          },
        )}
      </div>
    </>
  );
}

function formatPassingGap(
  gap: { kind: string; label: string; missingPoints: number },
  decimalPlaces: number,
) {
  if (gap.kind === "total")
    return `Noch ${gap.missingPoints.toFixed(decimalPlaces)} Gesamtpunkte bis Bestehen`;
  if (gap.kind === "missingDiscipline") return `${gap.label}: Leistung fehlt`;
  return `${gap.label}: noch ${gap.missingPoints.toFixed(decimalPlaces)} Punkte`;
}
