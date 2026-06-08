import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { attemptDateValue, formatAttemptDate, localDateValue } from "@/shared/utils/dates";
import { deleteAttempt, saveAttempt, useProfile, useSport, useSportAttempts } from "@/infrastructure/repositories";
import { createId, type Attempt } from "@/domain";
import { adjustmentsValid, evaluateSportAttempts } from "@/domain/scoring";
import { PageTitle, UnitValueInput } from "@/shared/components";
import { unitLabel } from "@/shared/labels";
import { formatUnitValue } from "@/shared/utils/units";
export function SportPage() {
  const { slug } = useParams();
  const sport = useSport(slug);
  const attempts = useSportAttempts(sport?.id);
  const profile = useProfile();
  const [values, setValues] = useState<Record<string, number>>({});
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [editingAttemptId, setEditingAttemptId] = useState<string>();
  const [attemptDate, setAttemptDate] = useState(localDateValue);
  if (!sport) return <p>Lade Sportart …</p>;
  const activeSport = sport;
  const historyEntries =
    profile && attempts
      ? evaluateSportAttempts(profile, activeSport, attempts)
      : [...(attempts ?? [])]
          .sort((left, right) => right.date.localeCompare(left.date))
          .map((attempt) => ({
            attempt,
            result: null,
            comparisonScore: null,
            isBest: false,
          }));
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
        <Link className="button-secondary" to={`/sportart/${sport.slug}/edit`}>
          Sportart bearbeiten
        </Link>
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
      </section>
      <h2 className="section-title">Verlauf</h2>
      {!profile && (
        <p className="notice mb-4">
          Ohne Nutzerprofil werden Rohleistungen angezeigt, aber keine Punkte
          berechnet.
        </p>
      )}
      <div className="space-y-3">
        {historyEntries.map(({ attempt, result, comparisonScore, isBest }) => {
          return (
            <article
              className={`card ${isBest ? "border-primary bg-primary-container" : ""}`}
              key={attempt.id}
            >
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  {isBest && <span className="chip mb-2">Bester Versuch</span>}
                  <strong>{formatAttemptDate(attempt.date)}</strong>
                  <p className="text-sm text-secondary">
                    {attempt.status === "draft" ? "Entwurf" : "Vollständig"}
                  </p>
                </div>
                <div className="text-right">
                  <strong className="block text-xl text-primary">
                    {result?.total !== null && result?.total !== undefined
                      ? result.total.toFixed(sport.decimalPlaces)
                      : "–"}{" "}
                    / {sport.totalMaxPoints.toFixed(sport.decimalPlaces)}
                  </strong>
                  <span className="text-sm text-secondary">
                    Vergleich:{" "}
                    {comparisonScore !== null
                      ? comparisonScore.toFixed(sport.decimalPlaces)
                      : "–"}{" "}
                    /{" "}
                    {(
                      sport.comparisonMaxPoints ?? sport.totalMaxPoints
                    ).toFixed(sport.decimalPlaces)}
                  </span>
                </div>
              </div>
              {result?.passStatus && (
                <p
                  className={`mt-2 font-bold ${result.passStatus === "passed" ? "text-secondary" : "text-error"}`}
                >
                  {result.passStatus === "passed"
                    ? "Bestanden"
                    : result.passStatus === "failed"
                      ? "Nicht bestanden"
                      : "Nicht bewertbar"}
                </p>
              )}
              {result?.failedRequirements.map((requirement) => (
                <p className="text-sm text-error" key={requirement}>
                  {requirement}
                </p>
              ))}
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {attempt.performances.map((performance) => {
                  const discipline = sport.disciplines.find(
                    (item) => item.id === performance.disciplineId,
                  );
                  const score = result?.disciplineScores.find(
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
                        ·{" "}
                        {score
                          ? `${score.points.toFixed(sport.decimalPlaces)} Pkt.`
                          : "unbewertet"}
                      </p>
                      {score && (
                        <div className="mt-1 text-xs text-secondary">
                          <p>
                            Basis:{" "}
                            {score.basePoints.toFixed(sport.decimalPlaces)} Pkt.
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
        })}
      </div>
    </>
  );
}
