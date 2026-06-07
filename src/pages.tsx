import {
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Line } from "react-chartjs-2";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  attemptDateValue,
  formatAttemptDate,
  localDateValue,
} from "./attemptDates";
import {
  calculateChartDomain,
  calculateChartPointDomain,
  createTableChartPoints,
  formatChartTick,
  formatChartTooltip,
} from "./chartUtils";
import {
  db,
  deleteSport,
  getLastStandardSportsReport,
  replaceSportWithHistory,
  restoreStandardSports,
} from "./db";
import {
  cloneImportedSport,
  createSportPackage,
  parseSportPackage,
  prepareSportReplacement,
} from "./exchange";
import {
  createId,
  slugify,
  type Attempt,
  type AutomaticPointModifier,
  type AutomaticCutoffMode,
  type AutomaticCutoffResult,
  type Discipline,
  type FormulaRule,
  type FormulaSegment,
  type Gender,
  type Sport,
  type TableRule,
  type TableGeneratorRecipe,
  type Unit,
} from "./domain";
import {
  adjustmentsValid,
  calculateUserProgress,
  determineAutomaticSportCutoffs,
  evaluateSportAttempts,
  scoreConfiguredDiscipline,
} from "./scoring";
import { generateTableRows, validateGeneratorRecipe } from "./tableGenerator";
import {
  createImportedTableRows,
  parseDelimitedTable,
  suggestImportColumns,
  type ParsedTableData,
} from "./tableImport";
import { formatUnitValue } from "./unitValues";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
);

const genderLabel = (gender: Gender) =>
  gender === "male" ? "Männlich" : "Weiblich";
const unitLabel = (unit: Unit) =>
  unit === "time" ? "Zeit" : unit === "distance" ? "Distanz" : "Wiederholungen";
function PageTitle({ children, intro }: { children: string; intro?: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-black tracking-tight">{children}</h1>
      {intro && <p className="mt-2 max-w-3xl text-secondary">{intro}</p>}
    </div>
  );
}

export function HomePage() {
  const profile = useLiveQuery(() => db.profile.get("local"));
  const profileComplete = Boolean(
    profile?.birthDate &&
    profile?.gender &&
    Number.isFinite(profile?.targetPoints) &&
    profile!.targetPoints > 0,
  );
  return (
    <>
      <section className="card grid overflow-hidden bg-primary-container text-on-primary-container lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-center lg:gap-8">
        <div>
          <div>
            <p className="eyebrow">Lokal. Nachvollziehbar. Flexibel.</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight sm:text-6xl">
              Sportleistungen erfassen und direkt auswerten.
            </h1>
            <p className="mt-5 max-w-2xl text-lg">
              Lege Sportarten und Bewertungsregeln an, dokumentiere vollständige
              Durchgänge und behalte deine Entwicklung im Blick.
            </p>
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link className="button-primary" to="/nutzer">
              {profileComplete ? "Profil anzeigen" : "Profil einrichten"}
            </Link>
            <Link className="button-secondary" to="/sportart">
              Sportarten öffnen
            </Link>
          </div>
        </div>
      </section>
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {[
          [
            "Nur auf deinem Gerät",
            "Profil, Definitionen und Rohleistungen werden ausschließlich in der IndexedDB deines Browsers gespeichert.",
          ],
          [
            "Immer aktuell",
            "Punkte werden nicht gespeichert, sondern mit den aktuell konfigurierten Formeln neu berechnet.",
          ],
        ].map(([title, text]) => (
          <article className="card" key={title}>
            <h2 className="font-bold">{title}</h2>
            <p className="mt-2 text-sm text-secondary">{text}</p>
          </article>
        ))}
      </section>
    </>
  );
}

export function ProfilePage() {
  const profile = useLiveQuery(() => db.profile.get("local"));
  const sports = useLiveQuery(() => db.sports.toArray(), []);
  const attempts = useLiveQuery(() => db.attempts.toArray(), []);
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<Gender>("male");
  const [targetPoints, setTargetPoints] = useState<number | "" | undefined>();
  const effectiveBirthDate = birthDate || profile?.birthDate || "";
  const effectiveGender = birthDate ? gender : (profile?.gender ?? gender);
  const effectiveTargetPoints =
    targetPoints === undefined ? (profile?.targetPoints ?? 130) : targetPoints;
  const progress =
    profile && sports && attempts
      ? calculateUserProgress(profile, sports, attempts)
      : undefined;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (
      typeof effectiveTargetPoints !== "number" ||
      !Number.isFinite(effectiveTargetPoints) ||
      effectiveTargetPoints <= 0
    )
      return;
    await db.profile.put({
      id: "local",
      birthDate: effectiveBirthDate,
      gender: effectiveGender,
      targetPoints: effectiveTargetPoints,
    });
    setBirthDate("");
    setTargetPoints(undefined);
  }

  return (
    <>
      <PageTitle intro="Das Alter wird aus dem Geburtsdatum berechnet. Alle Angaben bleiben lokal in diesem Browser.">
        Nutzerprofil
      </PageTitle>
      <form
        onSubmit={save}
        className="card mb-6 grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end"
      >
        <label>
          Geburtsdatum
          <input
            required
            type="date"
            value={effectiveBirthDate}
            onChange={(event) => setBirthDate(event.target.value)}
          />
        </label>
        <label>
          Geschlecht
          <select
            value={effectiveGender}
            onChange={(event) => {
              setBirthDate(effectiveBirthDate);
              setGender(event.target.value as Gender);
            }}
          >
            <option value="male">Männlich</option>
            <option value="female">Weiblich</option>
          </select>
        </label>
        <label>
          Zielpunktzahl
          <input
            required
            min="0.01"
            step="0.01"
            type="number"
            value={effectiveTargetPoints}
            onChange={(event) =>
              setTargetPoints(
                event.target.value === "" ? "" : Number(event.target.value),
              )
            }
          />
        </label>
        <button className="button-primary">Profil speichern</button>
      </form>
      {progress && (
        <section className="card mb-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-sm text-secondary">
                Erreichte Vergleichspunkte
              </p>
              <strong className="text-2xl text-primary">
                {progress.achievedPoints.toFixed(2)}
              </strong>
            </div>
            <div>
              <p className="text-sm text-secondary">Zielpunktzahl</p>
              <strong className="text-2xl">
                {progress.targetPoints.toFixed(2)}
              </strong>
            </div>
            <div>
              <p className="text-sm text-secondary">Verbleibend</p>
              <strong className="text-2xl">
                {progress.remainingPoints.toFixed(2)}
              </strong>
            </div>
            {progress.excessPoints > 0 && (
              <div>
                <p className="text-sm text-secondary">Überschuss</p>
                <strong className="text-2xl">
                  {progress.excessPoints.toFixed(2)}
                </strong>
              </div>
            )}
          </div>
          <div className="mt-5 flex items-center gap-3">
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-container-high">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(100, progress.percentage)}%` }}
              />
            </div>
            <span className="text-sm font-bold">
              {progress.percentage.toFixed(1)} %
            </span>
          </div>
        </section>
      )}
      <h2 className="section-title">Beste vollständige Durchgänge</h2>
      {!profile && (
        <p className="notice">
          Speichere zuerst dein Profil, damit Leistungen ausgewertet werden
          können.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {sports?.map((sport) => {
          const best = progress?.bestBySport.find(
            (candidate) => candidate.sportId === sport.id,
          );
          return (
            <article className="card" key={sport.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">{sport.name}</h3>
                  <p className="text-sm text-secondary">
                    {best
                      ? new Date(best.attempt.date).toLocaleDateString("de-DE")
                      : "Noch keine vollständige Wertung"}
                  </p>
                </div>
                <strong className="text-2xl text-primary">
                  {best
                    ? best.comparisonScore.toFixed(sport.decimalPlaces)
                    : "–"}{" "}
                  /{" "}
                  {(sport.comparisonMaxPoints ?? sport.totalMaxPoints).toFixed(
                    sport.decimalPlaces,
                  )}
                </strong>
              </div>
              <Link
                className="mt-4 inline-block text-sm font-bold underline"
                to={`/sportart/${sport.slug}`}
              >
                Verlauf öffnen
              </Link>
            </article>
          );
        })}
      </div>
    </>
  );
}

export function SportsPage() {
  const sports = useLiveQuery(() => db.sports.toArray(), []);
  const [standardReport, setStandardReport] = useState(
    getLastStandardSportsReport,
  );
  useEffect(() => {
    const updateReport = (event: Event) =>
      setStandardReport(
        (event as CustomEvent<ReturnType<typeof getLastStandardSportsReport>>)
          .detail,
      );
    window.addEventListener("standard-sports-sync", updateReport);
    return () =>
      window.removeEventListener("standard-sports-sync", updateReport);
  }, []);
  const navigate = useNavigate();
  async function createSport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name"));
    const slug = slugify(name);
    const sport: Sport = {
      id: createId(),
      slug,
      name,
      description: "",
      totalMaxPoints: Number(data.get("max")),
      comparisonMaxPoints: Number(data.get("max")),
      agePolicy: "attemptDate",
      aggregation: "sum",
      roundingMode: "round",
      decimalPlaces: 2,
      ageBands: [{ id: createId(), minAge: 0, maxAge: 100, label: "0-100" }],
      disciplines: [],
    };
    try {
      await db.sports.add(sport);
      navigate(`/sportart/${slug}/edit`);
    } catch {
      alert("Name beziehungsweise Kurzname wird bereits verwendet.");
    }
  }
  async function remove(sport: Sport) {
    if (await deleteSport(sport.id)) return;
    if (
      confirm(
        "Für diese Sportart existiert ein Verlauf. Sportart und gesamten Verlauf endgültig löschen?",
      )
    )
      await deleteSport(sport.id, true);
  }
  async function importSport(file: File) {
    try {
      const pkg = parseSportPackage(JSON.parse(await file.text()));
      const existing = sports?.find(
        (sport) =>
          sport.slug === pkg.sport.slug ||
          sport.name.toLocaleLowerCase("de") ===
            pkg.sport.name.toLocaleLowerCase("de"),
      );
      if (
        existing &&
        confirm(
          "Eine passende Sportart existiert. OK ersetzt sie und passt ihre Historie an. Abbrechen importiert eine Kopie.",
        )
      ) {
        await replaceSportWithHistory(
          existing.id,
          prepareSportReplacement(existing, pkg.sport),
        );
      } else {
        await db.sports.add(
          cloneImportedSport(
            pkg.sport,
            sports?.map((sport) => sport.slug) ?? [],
          ),
        );
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Import fehlgeschlagen.");
    }
  }
  function exportSport(sport: Sport) {
    const blob = new Blob(
      [JSON.stringify(createSportPackage(sport), null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${sport.slug}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <PageTitle intro="Sportarten bündeln Disziplinen, Formeln und zusammengehörige Durchgänge.">
        Sportarten
      </PageTitle>
      <div className="grid gap-4 md:grid-cols-2">
        {sports?.map((sport) => (
          <article className="card" key={sport.id}>
            <div className="flex justify-between gap-4">
              <div>
                <p className="eyebrow">
                  {sport.standard ? "Standard" : "Eigene Sportart"}
                </p>
                <h2 className="text-xl font-bold">{sport.name}</h2>
                <p className="mt-2 text-sm text-secondary">
                  {sport.disciplines.length} Disziplinen · maximal{" "}
                  {sport.totalMaxPoints.toFixed(sport.decimalPlaces)} Punkte
                </p>
              </div>
              <button
                className="button-danger self-start"
                onClick={() => remove(sport)}
              >
                Löschen
              </button>
            </div>
            <div className="mt-5 flex gap-2">
              <Link className="button-primary" to={`/sportart/${sport.slug}`}>
                Öffnen
              </Link>
              <Link
                className="button-secondary"
                to={`/sportart/${sport.slug}/edit`}
              >
                Bearbeiten
              </Link>
              <button
                className="button-secondary"
                onClick={() => exportSport(sport)}
              >
                Exportieren
              </button>
            </div>
          </article>
        ))}
      </div>
      <section className="mt-8">
        <h2 className="section-title">Sportarten verwalten</h2>
        {standardReport &&
          (standardReport.created.length > 0 ||
            standardReport.updated.length > 0 ||
            standardReport.preserved.length > 0 ||
            standardReport.errors.length > 0) && (
            <div className="notice mb-4">
              <strong>Standardkatalog</strong>
              <p className="mt-1 text-sm">
                Neu: {standardReport.created.length}, aktualisiert:{" "}
                {standardReport.updated.length}, lokal beibehalten:{" "}
                {standardReport.preserved.length}.
              </p>
              {standardReport.errors.map((error) => (
                <p className="mt-1 text-sm font-bold text-error" key={error}>
                  {error}
                </p>
              ))}
            </div>
          )}
        <form
          onSubmit={createSport}
          className="card mb-4 grid gap-4 md:grid-cols-[1fr_12rem_auto] md:items-end"
        >
          <label>
            Name
            <input name="name" required placeholder="z. B. Hindernisparcours" />
          </label>
          <label>
            Gesamtmaximum
            <input
              name="max"
              required
              min="1"
              step="0.01"
              type="number"
              defaultValue="100"
            />
          </label>
          <button className="button-primary">Sportart anlegen</button>
        </form>
        <div className="flex flex-wrap justify-end gap-2">
          <label className="button-secondary cursor-pointer">
            Sportart importieren
            <input
              className="hidden"
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importSport(file);
                event.target.value = "";
              }}
            />
          </label>
          <button
            className="button-secondary"
            onClick={async () =>
              setStandardReport(await restoreStandardSports())
            }
          >
            Fehlende Standards wiederherstellen
          </button>
        </div>
      </section>
    </>
  );
}

function UnitValueInput({
  discipline,
  value,
  onChange,
  signed = false,
}: {
  discipline: Discipline;
  value?: number;
  onChange: (value: number | undefined) => void;
  signed?: boolean;
}) {
  if (discipline.unit !== "time")
    return (
      <input
        type="number"
        min={signed ? undefined : "0"}
        step={discipline.unit === "repetitions" ? "1" : "0.01"}
        value={value ?? ""}
        onChange={(event) =>
          onChange(event.target.value ? Number(event.target.value) : undefined)
        }
      />
    );
  const total = Math.abs(value ?? 0);
  const sign = (value ?? 0) < 0 ? -1 : 1;
  const minutes = Math.floor(total / 60000),
    seconds = Math.floor((total % 60000) / 1000),
    hundredths = Math.floor((total % 1000) / 10);
  const update = (m: number, s: number, h: number) =>
    onChange(sign * (m * 60000 + s * 1000 + h * 10));
  return (
    <div className={`grid gap-2 ${signed ? "grid-cols-4" : "grid-cols-3"}`}>
      {signed && (
        <select
          aria-label="Vorzeichen"
          value={sign}
          onChange={(event) =>
            onChange((Number(event.target.value) || 1) * total)
          }
        >
          <option value="1">+</option>
          <option value="-1">−</option>
        </select>
      )}
      <input
        aria-label="Minuten"
        type="number"
        min="0"
        placeholder="Min"
        value={minutes || ""}
        onChange={(e) => update(Number(e.target.value), seconds, hundredths)}
      />
      <input
        aria-label="Sekunden"
        type="number"
        min="0"
        max="59"
        placeholder="Sek"
        value={seconds || ""}
        onChange={(e) => update(minutes, Number(e.target.value), hundredths)}
      />
      <input
        aria-label="Hundertstel"
        type="number"
        min="0"
        max="99"
        placeholder="1/100"
        value={hundredths || ""}
        onChange={(e) => update(minutes, seconds, Number(e.target.value))}
      />
    </div>
  );
}

export function SportPage() {
  const { slug } = useParams();
  const sport = useLiveQuery(
    () =>
      db.sports
        .where("slug")
        .equals(slug ?? "")
        .first(),
    [slug],
  );
  const attempts = useLiveQuery(
    () =>
      sport
        ? db.attempts.where("sportId").equals(sport.id).reverse().sortBy("date")
        : [],
    [sport?.id],
  );
  const profile = useLiveQuery(() => db.profile.get("local"));
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
    await db.attempts.put({
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
                onClick={() => db.attempts.delete(attempt.id)}
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

function FormulaChart({ discipline }: { discipline: Discipline }) {
  const [expanded, setExpanded] = useState(false);
  const [previewAge, setPreviewAge] = useState(35);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (expanded) dialog.current?.showModal();
    else dialog.current?.close();
  }, [expanded]);
  const domain = calculateChartDomain(discipline);
  const pointDomain = calculateChartPointDomain(discipline);
  const rules =
    discipline.scoringMode === "table"
      ? (discipline.tables ?? [])
      : discipline.formulas;
  const ageBandIndexes = new Map(
    discipline.ageBands.map((band, index) => [band.id, index]),
  );
  const genderColors = {
    male: ["#1d4ed8", "#2563eb", "#60a5fa", "#93c5fd"],
    female: ["#15803d", "#16a34a", "#4ade80", "#86efac"],
  };
  const datasets = rules.map((rule, index) => {
    const points =
      discipline.scoringMode === "table"
        ? createTableChartPoints(rule as TableRule, discipline, true)
            .map((point) => ({
              ...point,
              y:
                scoreConfiguredDiscipline(
                  discipline,
                  point.x,
                  rule.gender,
                  rule.ageBandId,
                  previewAge,
                ) ?? point.y,
            }))
            .filter((point) => !discipline.cutoff || point.y !== 0)
        : Array.from({ length: 161 }, (_, offset) => {
            const value =
              domain.min + ((domain.max - domain.min) * offset) / 160;
            const points = scoreConfiguredDiscipline(
              discipline,
              value,
              rule.gender,
              rule.ageBandId,
              previewAge,
            );
            return {
              x: value,
              y: points === 0 && discipline.cutoff ? null : (points ?? 0),
            };
          });
    const colorIndex =
      (ageBandIndexes.get(rule.ageBandId) ?? index) %
      genderColors[rule.gender].length;
    return {
      label: `${genderLabel(rule.gender)} · ${discipline.ageBands.find((band) => band.id === rule.ageBandId)?.label}`,
      data: points,
      borderColor: genderColors[rule.gender][colorIndex],
      backgroundColor: genderColors[rule.gender][colorIndex],
      pointStyle:
        rule.gender === "male" ? ("triangle" as const) : ("circle" as const),
      pointRadius: 3,
      showLine: true,
      spanGaps: false,
      stepped: discipline.scoringMode === "table",
    };
  });
  if (discipline.cutoff?.kind === "points") {
    datasets.push({
      label: `Cut-off: ${discipline.cutoff.threshold} Punkte`,
      data: [
        { x: domain.min, y: discipline.cutoff.threshold },
        { x: domain.max, y: discipline.cutoff.threshold },
      ],
      borderColor: "#dd0000",
      backgroundColor: "#dd0000",
      pointStyle: "circle" as const,
      pointRadius: 0,
      showLine: true,
      spanGaps: false,
      stepped: false,
    });
  }
  const chart = (fullscreen = false) => (
    <div className={fullscreen ? "h-[85vh]" : "h-64"}>
      <Line
        options={{
          responsive: true,
          maintainAspectRatio: false,
          parsing: false,
          scales: {
            x: {
              type: "linear",
              min: domain.min,
              max: domain.max,
              title: {
                display: true,
                text: `Leistung (${unitLabel(discipline.unit)})`,
              },
              ticks: {
                callback: (value) =>
                  formatChartTick(Number(value), discipline.unit),
                minRotation: 45,
                maxRotation: 45,
              },
            },
            y: {
              min: pointDomain.min,
              max: pointDomain.max,
              title: { display: true, text: "Punkte" },
            },
          },
          plugins: {
            tooltip: {
              callbacks: {
                title: (items) =>
                  items[0]
                    ? formatChartTooltip(
                        Number(items[0].parsed.x),
                        discipline.unit,
                      )
                    : "",
              },
            },
          },
        }}
        data={{ datasets }}
      />
    </div>
  );
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-end justify-end gap-2">
        <label className="max-w-32">
          Vorschaualter
          <input
            type="number"
            min="0"
            value={previewAge}
            onChange={(event) => setPreviewAge(Number(event.target.value))}
          />
        </label>
        <button className="button-secondary" onClick={() => setExpanded(true)}>
          Diagramm vergrößern
        </button>
      </div>
      {chart()}
      <dialog
        ref={dialog}
        className="m-auto h-[95vh] w-[95vw] max-w-none rounded-xl bg-surface p-4 text-on-surface backdrop:bg-black/70"
        onCancel={() => setExpanded(false)}
        onClick={(event) => {
          if (event.target === dialog.current) setExpanded(false);
        }}
      >
        <div className="mb-2 flex items-center justify-between">
          <strong>{discipline.name}</strong>
          <button
            className="button-secondary"
            onClick={() => setExpanded(false)}
          >
            Schließen
          </button>
        </div>
        {chart(true)}
      </dialog>
    </div>
  );
}

function FormulaRulesEditor({
  discipline,
  onChange,
}: {
  discipline: Discipline;
  onChange: (formulas: FormulaRule[]) => void;
}) {
  const updateRule = (rule: FormulaRule, segments: FormulaSegment[]) =>
    onChange(
      discipline.formulas.map((item) =>
        item === rule ? { ...item, segments } : item,
      ),
    );
  return (
    <div className="mt-2 space-y-3">
      {discipline.formulas.map((rule) => (
        <div
          className="rounded-lg bg-surface-container p-3"
          key={`${rule.gender}-${rule.ageBandId}`}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <strong>
              {genderLabel(rule.gender)} ·{" "}
              {
                discipline.ageBands.find((band) => band.id === rule.ageBandId)
                  ?.label
              }
              {" · "}x ={" "}
              {discipline.unit === "time"
                ? "Sekunden"
                : discipline.unit === "distance"
                  ? "Meter"
                  : "Wiederholungen"}
            </strong>
            <button
              className="button-secondary"
              onClick={() => {
                const previous = rule.segments.at(-1);
                const splitValue = discipline.unit === "time" ? 100_000 : 100;
                const nextValue =
                  splitValue +
                  (discipline.unit === "time"
                    ? 10
                    : discipline.unit === "distance"
                      ? 0.01
                      : 1);
                updateRule(rule, [
                  ...rule.segments.map((segment, index) =>
                    index === rule.segments.length - 1
                      ? { ...segment, to: splitValue }
                      : segment,
                  ),
                  {
                    id: createId(),
                    from: nextValue,
                    to: null,
                    kind: previous?.kind ?? "linear",
                    a: previous?.a ?? 0,
                    b: previous?.b ?? 1,
                    c: previous?.c ?? 0,
                  },
                ]);
              }}
            >
              Abschnitt hinzufügen
            </button>
          </div>
          <div className="space-y-2">
            {rule.segments.map((segment, segmentIndex) => (
              <div className="grid gap-2 sm:grid-cols-6" key={segment.id}>
                <label>
                  Von
                  {segmentIndex === 0 ? (
                    <input disabled value="offen" />
                  ) : (
                    <UnitValueInput
                      discipline={discipline}
                      value={segment.from ?? undefined}
                      onChange={(value) =>
                        value !== undefined &&
                        updateRule(
                          rule,
                          rule.segments.map((item) =>
                            item.id === segment.id
                              ? { ...item, from: value }
                              : item,
                          ),
                        )
                      }
                    />
                  )}
                </label>
                <label>
                  Bis
                  {segmentIndex === rule.segments.length - 1 ? (
                    <input disabled value="offen" />
                  ) : (
                    <UnitValueInput
                      discipline={discipline}
                      value={segment.to ?? undefined}
                      onChange={(value) =>
                        value !== undefined &&
                        updateRule(
                          rule,
                          rule.segments.map((item) =>
                            item.id === segment.id
                              ? { ...item, to: value }
                              : item,
                          ),
                        )
                      }
                    />
                  )}
                </label>
                {(["a", "b", "c"] as const).map((coefficient) => (
                  <label key={coefficient}>
                    {coefficient}
                    <input
                      type="number"
                      step="any"
                      value={segment[coefficient]}
                      onChange={(event) =>
                        updateRule(
                          rule,
                          rule.segments.map((item) =>
                            item.id === segment.id
                              ? {
                                  ...item,
                                  [coefficient]: Number(event.target.value),
                                  kind:
                                    coefficient === "a" &&
                                    Number(event.target.value) !== 0
                                      ? "quadratic"
                                      : item.kind,
                                }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                ))}
                <button
                  className="button-danger self-end"
                  disabled={rule.segments.length === 1}
                  onClick={() => {
                    const next = rule.segments
                      .filter((item) => item.id !== segment.id)
                      .map((item, index, all) => ({
                        ...item,
                        from: index === 0 ? null : item.from,
                        to: index === all.length - 1 ? null : item.to,
                      }));
                    updateRule(rule, next);
                  }}
                >
                  Entfernen
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TableImportPanel({
  discipline,
  tables,
  onChange,
}: {
  discipline: Discipline;
  tables: TableRule[];
  onChange: (tables: TableRule[]) => void;
}) {
  const [data, setData] = useState<ParsedTableData>();
  const [ageBandId, setAgeBandId] = useState(discipline.ageBands[0]?.id ?? "");
  const [pointsColumn, setPointsColumn] = useState(-1);
  const [maleColumn, setMaleColumn] = useState(-1);
  const [femaleColumn, setFemaleColumn] = useState(-1);
  const [maleDirection, setMaleDirection] = useState<
    "lowerIsBetter" | "higherIsBetter"
  >("lowerIsBetter");
  const [femaleDirection, setFemaleDirection] = useState<
    "lowerIsBetter" | "higherIsBetter"
  >("lowerIsBetter");
  const [error, setError] = useState("");
  async function load(file: File) {
    try {
      const parsed = parseDelimitedTable(await file.text());
      const suggestions = suggestImportColumns(parsed.headers);
      setData(parsed);
      setPointsColumn(suggestions.pointsColumn);
      setMaleColumn(suggestions.maleColumn);
      setFemaleColumn(suggestions.femaleColumn);
      setError("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Importdatei konnte nicht gelesen werden.",
      );
    }
  }
  function apply() {
    if (!data || pointsColumn < 0 || (maleColumn < 0 && femaleColumn < 0)) {
      setError("Bitte Punkte und mindestens eine Leistungsspalte auswählen.");
      return;
    }
    try {
      const imported = new Map<Gender, TableRule>();
      if (maleColumn >= 0)
        imported.set("male", {
          gender: "male",
          ageBandId,
          rows: createImportedTableRows(
            data,
            {
              pointsColumn,
              performanceColumn: maleColumn,
              direction: maleDirection,
            },
            discipline.unit,
          ),
        });
      if (femaleColumn >= 0)
        imported.set("female", {
          gender: "female",
          ageBandId,
          rows: createImportedTableRows(
            data,
            {
              pointsColumn,
              performanceColumn: femaleColumn,
              direction: femaleDirection,
            },
            discipline.unit,
          ),
        });
      if (
        !confirm(
          "Die ausgewählten Tabellen dieses Altersbands werden vollständig ersetzt. Fortfahren?",
        )
      )
        return;
      const next = tables.filter(
        (rule) => !(rule.ageBandId === ageBandId && imported.has(rule.gender)),
      );
      onChange([...next, ...imported.values()]);
      setError("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Import fehlgeschlagen.",
      );
    }
  }
  const columnSelect = (
    value: number,
    onSelect: (value: number) => void,
    optional = false,
  ) => (
    <select
      value={value}
      onChange={(event) => onSelect(Number(event.target.value))}
    >
      <option value={-1}>
        {optional ? "Nicht importieren" : "Bitte auswählen"}
      </option>
      {data?.headers.map((header, index) => (
        <option key={`${header}-${index}`} value={index}>
          {header}
        </option>
      ))}
    </select>
  );
  let preview = "";
  let previewError = "";
  if (data && pointsColumn >= 0) {
    try {
      const counts = [
        ...(maleColumn >= 0
          ? [
              `Männer: ${createImportedTableRows(data, { pointsColumn, performanceColumn: maleColumn, direction: maleDirection }, discipline.unit).length} Zeilen`,
            ]
          : []),
        ...(femaleColumn >= 0
          ? [
              `Frauen: ${createImportedTableRows(data, { pointsColumn, performanceColumn: femaleColumn, direction: femaleDirection }, discipline.unit).length} Zeilen`,
            ]
          : []),
      ];
      preview = counts.join(", ");
    } catch (caught) {
      previewError =
        caught instanceof Error
          ? caught.message
          : "Vorschau konnte nicht erstellt werden.";
    }
  }
  return (
    <details className="rounded-lg border border-outline-variant p-3">
      <summary className="cursor-pointer font-bold">
        CSV- oder Markdown-Tabelle importieren
      </summary>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <label>
          Altersband
          <select
            value={ageBandId}
            onChange={(event) => setAgeBandId(event.target.value)}
          >
            {discipline.ageBands.map((band) => (
              <option key={band.id} value={band.id}>
                {band.label}
              </option>
            ))}
          </select>
        </label>
        <label className="button-secondary cursor-pointer self-end">
          Datei auswählen
          <input
            className="hidden"
            type="file"
            accept=".csv,.tsv,.txt,.md,.mk,text/csv,text/plain"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void load(file);
              event.target.value = "";
            }}
          />
        </label>
        {data && (
          <p className="self-end text-sm text-secondary">
            {data.rows.length} Datenzeilen erkannt
          </p>
        )}
      </div>
      {data && (
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label>
            Punktespalte{columnSelect(pointsColumn, setPointsColumn)}
          </label>
          <label>
            Männer-Leistung{columnSelect(maleColumn, setMaleColumn, true)}
          </label>
          <label>
            Frauen-Leistung{columnSelect(femaleColumn, setFemaleColumn, true)}
          </label>
          {maleColumn >= 0 && (
            <label>
              Richtung Männer
              <select
                value={maleDirection}
                onChange={(event) =>
                  setMaleDirection(event.target.value as typeof maleDirection)
                }
              >
                <option value="lowerIsBetter">Kleiner ist besser</option>
                <option value="higherIsBetter">Größer ist besser</option>
              </select>
            </label>
          )}
          {femaleColumn >= 0 && (
            <label>
              Richtung Frauen
              <select
                value={femaleDirection}
                onChange={(event) =>
                  setFemaleDirection(
                    event.target.value as typeof femaleDirection,
                  )
                }
              >
                <option value="lowerIsBetter">Kleiner ist besser</option>
                <option value="higherIsBetter">Größer ist besser</option>
              </select>
            </label>
          )}
        </div>
      )}
      {preview && (
        <p className="mt-2 text-sm text-secondary">Vorschau: {preview}</p>
      )}
      {previewError && (
        <p className="mt-2 text-sm font-bold text-error">{previewError}</p>
      )}
      {error && <p className="mt-2 text-sm font-bold text-error">{error}</p>}
      {data && (
        <button
          disabled={Boolean(previewError)}
          className="button-secondary mt-3"
          onClick={apply}
        >
          Ausgewählte Tabellen importieren
        </button>
      )}
    </details>
  );
}

function TableRulesEditor({
  discipline,
  onChange,
}: {
  discipline: Discipline;
  onChange: (tables: TableRule[]) => void;
}) {
  const tables = discipline.tables ?? [];
  const emptyRecipe: TableGeneratorRecipe = {
    kind: "linear",
    a: 0,
    b: 1,
    c: 0,
    minPoints: 60,
    maxPoints: discipline.maxPoints,
    minValue: 0,
    maxValue: 100,
    pointStep: 1,
    formulaValueUnit: "display",
    direction: "higherIsBetter",
  };
  return (
    <div className="mt-2 space-y-3">
      <TableImportPanel
        discipline={discipline}
        tables={tables}
        onChange={onChange}
      />
      {tables.length === 0 && (
        <button
          className="button-secondary"
          onClick={() =>
            onChange(
              discipline.ageBands.flatMap((band) =>
                (["male", "female"] as Gender[]).map((gender) => ({
                  gender,
                  ageBandId: band.id,
                  rows: [],
                })),
              ),
            )
          }
        >
          Leere Tabellen für alle Gruppen anlegen
        </button>
      )}
      {tables.map((rule) => (
        <details
          className="rounded-lg bg-surface-container p-3"
          key={`${rule.gender}-${rule.ageBandId}`}
        >
          <summary className="cursor-pointer font-bold">
            {genderLabel(rule.gender)} ·{" "}
            {
              discipline.ageBands.find((band) => band.id === rule.ageBandId)
                ?.label
            }{" "}
            · {rule.rows.length} Zeilen
          </summary>
          <div className="mt-3 space-y-2">
            <TableGeneratorPanel
              discipline={discipline}
              recipe={rule.generatorRecipe ?? emptyRecipe}
              onGenerate={(recipe) => {
                const rows = generateTableRows(recipe, discipline.unit);
                if (
                  rule.rows.length > 0 &&
                  !confirm(
                    "Die bestehende Tabelle dieser Bewertungsgruppe wird vollständig ersetzt. Fortfahren?",
                  )
                )
                  return;
                onChange(
                  tables.map((item) =>
                    item === rule
                      ? { ...item, rows, generatorRecipe: recipe }
                      : item,
                  ),
                );
              }}
            />
            {rule.rows.some(
              (row) =>
                row.from !== null && row.to !== null && row.from > row.to,
            ) && (
              <p className="text-sm font-bold text-error">
                Warnung: Mindestens ein Bereich ist invertiert.
              </p>
            )}
            {rule.rows.some((row, index) =>
              rule.rows.some(
                (other, otherIndex) =>
                  index !== otherIndex &&
                  (row.from ?? -Infinity) <= (other.to ?? Infinity) &&
                  (row.to ?? Infinity) >= (other.from ?? -Infinity),
              ),
            ) && (
              <p className="text-sm font-bold text-error">
                Warnung: Tabellenbereiche überschneiden sich. Bei der Bewertung
                gewinnt der höhere Punktwert.
              </p>
            )}
            <div className="max-h-[32rem] overflow-auto rounded-lg border border-outline-variant">
              <table className="w-full min-w-[48rem] border-collapse">
                <thead className="sticky top-0 z-10 bg-surface-container-high text-left">
                  <tr>
                    <th className="p-2">Von</th>
                    <th className="p-2">Bis</th>
                    <th className="w-32 p-2">Punkte</th>
                    <th className="w-32 p-2">Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {rule.rows.map((row) => (
                    <tr
                      className="border-t border-outline-variant align-top"
                      key={row.id}
                    >
                      <td className="p-2">
                        <UnitValueInput
                          discipline={discipline}
                          value={row.from ?? undefined}
                          onChange={(value) =>
                            onChange(
                              tables.map((item) =>
                                item === rule
                                  ? {
                                      ...item,
                                      rows: item.rows.map((candidate) =>
                                        candidate.id === row.id
                                          ? {
                                              ...candidate,
                                              from: value ?? null,
                                            }
                                          : candidate,
                                      ),
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                      </td>
                      <td className="p-2">
                        <UnitValueInput
                          discipline={discipline}
                          value={row.to ?? undefined}
                          onChange={(value) =>
                            onChange(
                              tables.map((item) =>
                                item === rule
                                  ? {
                                      ...item,
                                      rows: item.rows.map((candidate) =>
                                        candidate.id === row.id
                                          ? { ...candidate, to: value ?? null }
                                          : candidate,
                                      ),
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                      </td>
                      <td className="p-2">
                        <input
                          aria-label="Punkte"
                          type="number"
                          value={row.points}
                          onChange={(event) =>
                            onChange(
                              tables.map((item) =>
                                item === rule
                                  ? {
                                      ...item,
                                      rows: item.rows.map((candidate) =>
                                        candidate.id === row.id
                                          ? {
                                              ...candidate,
                                              points: Number(
                                                event.target.value,
                                              ),
                                            }
                                          : candidate,
                                      ),
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                      </td>
                      <td className="p-2">
                        <button
                          className="button-danger w-full"
                          onClick={() =>
                            onChange(
                              tables.map((item) =>
                                item === rule
                                  ? {
                                      ...item,
                                      rows: item.rows.filter(
                                        (candidate) => candidate.id !== row.id,
                                      ),
                                    }
                                  : item,
                              ),
                            )
                          }
                        >
                          Entfernen
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              className="button-secondary"
              onClick={() =>
                onChange(
                  tables.map((item) =>
                    item === rule
                      ? {
                          ...item,
                          rows: [
                            ...item.rows,
                            { id: createId(), from: null, to: null, points: 0 },
                          ],
                        }
                      : item,
                  ),
                )
              }
            >
              Tabellenzeile hinzufügen
            </button>
          </div>
        </details>
      ))}
    </div>
  );
}

function TableGeneratorPanel({
  discipline,
  recipe,
  onGenerate,
}: {
  discipline: Discipline;
  recipe: TableGeneratorRecipe;
  onGenerate: (recipe: TableGeneratorRecipe) => void;
}) {
  const [draft, setDraft] = useState(recipe);
  let error = validateGeneratorRecipe(draft, discipline.unit);
  let preview = 0;
  if (!error) {
    try {
      preview = generateTableRows(draft, discipline.unit).length;
    } catch (generatorError) {
      error =
        generatorError instanceof Error
          ? generatorError.message
          : "Die Tabelle kann nicht erzeugt werden.";
    }
  }
  return (
    <div className="mb-4 rounded-lg border border-outline-variant p-3">
      <h4 className="font-bold">Tabelle aus Formel generieren</h4>
      <p className="mt-1 text-sm text-secondary">
        Formelvariable x ={" "}
        {discipline.unit === "time"
          ? "Sekunden"
          : discipline.unit === "distance"
            ? "Meter"
            : "Wiederholungen"}
        . Leistungsgrenzen werden in {unitLabel(discipline.unit)} eingegeben.
      </p>
      <div className="mt-2 grid gap-2 md:grid-cols-4">
        <label>
          Formeltyp
          <select
            value={draft.kind}
            onChange={(e) =>
              setDraft({
                ...draft,
                kind: e.target.value as TableGeneratorRecipe["kind"],
                a: e.target.value === "linear" ? 0 : draft.a,
              })
            }
          >
            <option value="linear">Linear</option>
            <option value="quadratic">Quadratisch</option>
          </select>
        </label>
        {(["a", "b", "c"] as const).map((key) => (
          <label key={key}>
            {key}
            <input
              type="number"
              step="any"
              disabled={draft.kind === "linear" && key === "a"}
              value={draft[key]}
              onChange={(e) =>
                setDraft({ ...draft, [key]: Number(e.target.value) })
              }
            />
          </label>
        ))}
        <label>
          Min. Punkte
          <input
            type="number"
            value={draft.minPoints}
            onChange={(e) =>
              setDraft({ ...draft, minPoints: Number(e.target.value) })
            }
          />
        </label>
        <label>
          Max. Punkte
          <input
            type="number"
            value={draft.maxPoints}
            onChange={(e) =>
              setDraft({ ...draft, maxPoints: Number(e.target.value) })
            }
          />
        </label>
        <label>
          Punkteschrittweite
          <input
            type="number"
            min="0.0001"
            step="any"
            value={draft.pointStep ?? 1}
            onChange={(e) =>
              setDraft({ ...draft, pointStep: Number(e.target.value) })
            }
          />
        </label>
        <label>
          Min. Leistung ({unitLabel(discipline.unit)})
          <UnitValueInput
            discipline={discipline}
            value={draft.minValue}
            onChange={(value) =>
              value !== undefined && setDraft({ ...draft, minValue: value })
            }
          />
        </label>
        <label>
          Max. Leistung ({unitLabel(discipline.unit)})
          <UnitValueInput
            discipline={discipline}
            value={draft.maxValue}
            onChange={(value) =>
              value !== undefined && setDraft({ ...draft, maxValue: value })
            }
          />
        </label>
        <label>
          Richtung
          <select
            value={draft.direction}
            onChange={(e) =>
              setDraft({
                ...draft,
                direction: e.target.value as TableGeneratorRecipe["direction"],
              })
            }
          >
            <option value="higherIsBetter">Größer ist besser</option>
            <option value="lowerIsBetter">Kleiner ist besser</option>
          </select>
        </label>
      </div>
      {error ? (
        <p className="mt-2 text-sm font-bold text-error">{error}</p>
      ) : (
        <p className="mt-2 text-sm text-secondary">
          Vorschau: {preview} Tabellenzeilen werden erzeugt.
        </p>
      )}
      <button
        disabled={Boolean(error)}
        className="button-secondary mt-2"
        onClick={() => onGenerate(draft)}
      >
        Tabelle neu generieren
      </button>
    </div>
  );
}

function AdjustmentEditor({
  discipline,
  onChange,
}: {
  discipline: Discipline;
  onChange: (groups: NonNullable<Discipline["adjustmentGroups"]>) => void;
}) {
  const groups = discipline.adjustmentGroups ?? [];
  return (
    <div className="mt-2 space-y-3">
      {groups.map((group) => (
        <div className="rounded-lg bg-surface-container p-3" key={group.id}>
          <div className="grid gap-2 sm:grid-cols-2">
            <label>
              Bezeichnung
              <input
                value={group.label}
                onChange={(e) =>
                  onChange(
                    groups.map((item) =>
                      item.id === group.id
                        ? { ...item, label: e.target.value }
                        : item,
                    ),
                  )
                }
              />
            </label>
            <label className="flex grid-cols-none items-center gap-2 self-end">
              <input
                className="w-auto"
                type="checkbox"
                checked={group.required}
                onChange={(e) =>
                  onChange(
                    groups.map((item) =>
                      item.id === group.id
                        ? {
                            ...item,
                            required: e.target.checked,
                            options: e.target.checked
                              ? item.options.filter(
                                  (option) => option.label !== "Nicht vergeben",
                                )
                              : item.options.some(
                                    (option) => option.valueAdjustment === 0,
                                  )
                                ? item.options
                                : [
                                    {
                                      id: createId(),
                                      label: "Nicht vergeben",
                                      valueAdjustment: 0,
                                      effect: "pointAdjustment",
                                    },
                                    ...item.options,
                                  ],
                          }
                        : item,
                    ),
                  )
                }
              />
              Verpflichtend
            </label>
          </div>
          {group.options.map((option) => {
            const effect =
              option.effect ??
              (group.target === "points"
                ? "pointAdjustment"
                : "performanceAdjustment");
            return (
              <div
                className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
                key={option.id}
              >
                <label>
                  Option
                  <input
                    value={option.label}
                    onChange={(e) =>
                      onChange(
                        groups.map((item) =>
                          item.id === group.id
                            ? {
                                ...item,
                                options: item.options.map((candidate) =>
                                  candidate.id === option.id
                                    ? { ...candidate, label: e.target.value }
                                    : candidate,
                                ),
                              }
                            : item,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Wirkung
                  <select
                    value={effect}
                    onChange={(e) =>
                      onChange(
                        groups.map((item) =>
                          item.id === group.id
                            ? {
                                ...item,
                                options: item.options.map((candidate) =>
                                  candidate.id === option.id
                                    ? {
                                        ...candidate,
                                        effect: e.target.value as NonNullable<
                                          typeof option.effect
                                        >,
                                      }
                                    : candidate,
                                ),
                              }
                            : item,
                        ),
                      )
                    }
                  >
                    <option value="performanceAdjustment">
                      Leistung addieren
                    </option>
                    <option value="pointAdjustment">Punkte addieren</option>
                    <option value="minimumPoints">Mindestpunkte</option>
                    <option value="maximumPoints">Maximalpunkte</option>
                  </select>
                </label>
                <label>
                  Wert
                  {effect === "performanceAdjustment" ? (
                    <UnitValueInput
                      discipline={discipline}
                      signed
                      value={option.valueAdjustment}
                      onChange={(value) =>
                        value !== undefined &&
                        onChange(
                          groups.map((item) =>
                            item.id === group.id
                              ? {
                                  ...item,
                                  options: item.options.map((candidate) =>
                                    candidate.id === option.id
                                      ? { ...candidate, valueAdjustment: value }
                                      : candidate,
                                  ),
                                }
                              : item,
                          ),
                        )
                      }
                    />
                  ) : (
                    <input
                      type="number"
                      step="any"
                      value={option.valueAdjustment}
                      onChange={(e) =>
                        onChange(
                          groups.map((item) =>
                            item.id === group.id
                              ? {
                                  ...item,
                                  options: item.options.map((candidate) =>
                                    candidate.id === option.id
                                      ? {
                                          ...candidate,
                                          valueAdjustment: Number(
                                            e.target.value,
                                          ),
                                        }
                                      : candidate,
                                  ),
                                }
                              : item,
                          ),
                        )
                      }
                    />
                  )}
                </label>
                <button
                  className="button-danger self-end"
                  onClick={() =>
                    onChange(
                      groups.map((item) =>
                        item.id === group.id
                          ? {
                              ...item,
                              options: item.options.filter(
                                (candidate) => candidate.id !== option.id,
                              ),
                            }
                          : item,
                      ),
                    )
                  }
                >
                  Entfernen
                </button>
              </div>
            );
          })}
          <div className="mt-2 flex gap-2">
            <button
              className="button-secondary"
              onClick={() =>
                onChange(
                  groups.map((item) =>
                    item.id === group.id
                      ? {
                          ...item,
                          options: [
                            ...item.options,
                            {
                              id: createId(),
                              label: "Neue Option",
                              valueAdjustment: 0,
                            },
                          ],
                        }
                      : item,
                  ),
                )
              }
            >
              Option hinzufügen
            </button>
            <button
              className="button-danger"
              onClick={() =>
                onChange(groups.filter((item) => item.id !== group.id))
              }
            >
              Gruppe entfernen
            </button>
          </div>
        </div>
      ))}
      <button
        className="button-secondary"
        onClick={() =>
          onChange([
            ...groups,
            {
              id: createId(),
              label: "Neue Korrekturgruppe",
              required: false,
              target: "performance",
              options: [
                { id: createId(), label: "Nicht vergeben", valueAdjustment: 0 },
              ],
            },
          ])
        }
      >
        Korrekturgruppe hinzufügen
      </button>
    </div>
  );
}

function AutomaticPointModifierEditor({
  modifiers,
  onChange,
}: {
  modifiers: AutomaticPointModifier[];
  onChange: (modifiers: AutomaticPointModifier[]) => void;
}) {
  const update = (id: string, change: Partial<AutomaticPointModifier>) =>
    onChange(
      modifiers.map((modifier) =>
        modifier.id === id ? { ...modifier, ...change } : modifier,
      ),
    );
  return (
    <div className="mt-2 space-y-3">
      {modifiers.map((modifier) => (
        <div className="rounded-lg bg-surface-container p-3" key={modifier.id}>
          <div className="grid gap-2 md:grid-cols-3">
            <label>
              Bezeichnung
              <input
                value={modifier.label}
                onChange={(event) =>
                  update(modifier.id, { label: event.target.value })
                }
              />
            </label>
            <label>
              Bonusart
              <select
                value={modifier.kind}
                onChange={(event) =>
                  update(modifier.id, {
                    kind: event.target.value as AutomaticPointModifier["kind"],
                    referenceAge:
                      event.target.value === "agePercentagePerYear"
                        ? (modifier.referenceAge ?? 35)
                        : undefined,
                  })
                }
              >
                <option value="fixedPercentage">
                  Fester Anteil der Basispunkte
                </option>
                <option value="agePercentagePerYear">
                  Anteil je Altersjahr
                </option>
              </select>
            </label>
            <label>
              Geschlecht
              <select
                value={modifier.gender}
                onChange={(event) =>
                  update(modifier.id, {
                    gender: event.target
                      .value as AutomaticPointModifier["gender"],
                  })
                }
              >
                <option value="all">Alle</option>
                <option value="male">Männlich</option>
                <option value="female">Weiblich</option>
              </select>
            </label>
            <label>
              Faktor
              <input
                type="number"
                step="any"
                value={modifier.factor}
                onChange={(event) =>
                  update(modifier.id, { factor: Number(event.target.value) })
                }
              />
            </label>
            {modifier.kind === "agePercentagePerYear" && (
              <label>
                Bezugsalter
                <input
                  type="number"
                  value={modifier.referenceAge ?? 35}
                  onChange={(event) =>
                    update(modifier.id, {
                      referenceAge: Number(event.target.value),
                    })
                  }
                />
              </label>
            )}
            <label>
              Mindestalter
              <input
                type="number"
                value={modifier.minAge ?? ""}
                onChange={(event) =>
                  update(modifier.id, {
                    minAge:
                      event.target.value === ""
                        ? undefined
                        : Number(event.target.value),
                  })
                }
              />
            </label>
            <label>
              Höchstalter
              <input
                type="number"
                value={modifier.maxAge ?? ""}
                onChange={(event) =>
                  update(modifier.id, {
                    maxAge:
                      event.target.value === ""
                        ? undefined
                        : Number(event.target.value),
                  })
                }
              />
            </label>
          </div>
          <p className="mt-2 text-sm text-secondary">
            {modifier.kind === "fixedPercentage"
              ? `Bonus = Basispunkte × ${modifier.factor}`
              : `Bonus = Basispunkte × max(0, Alter − ${modifier.referenceAge ?? 35}) × ${modifier.factor}`}
          </p>
          <button
            className="mt-2 text-sm font-bold text-error underline"
            onClick={() =>
              onChange(modifiers.filter((item) => item.id !== modifier.id))
            }
          >
            Bonus entfernen
          </button>
        </div>
      ))}
      <button
        className="button-secondary"
        onClick={() =>
          onChange([
            ...modifiers,
            {
              id: createId(),
              label: "Neuer automatischer Bonus",
              kind: "fixedPercentage",
              factor: 0,
              gender: "all",
            },
          ])
        }
      >
        Automatischen Bonus hinzufügen
      </button>
    </div>
  );
}

function DisciplineAgeBandsEditor({
  discipline,
  onChange,
}: {
  discipline: Discipline;
  onChange: (discipline: Discipline) => void;
}) {
  const updateBands = (ageBands: Discipline["ageBands"]) =>
    onChange({ ...discipline, ageBands });
  const add = () => {
    const band = {
      id: createId(),
      minAge: 0,
      maxAge: 100,
      label: "Neuer Bereich",
    };
    onChange({
      ...discipline,
      ageBands: [...discipline.ageBands, band],
      formulas: [
        ...discipline.formulas,
        ...(["male", "female"] as Gender[]).map((gender) => ({
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
      ],
      tables: [
        ...(discipline.tables ?? []),
        ...(["male", "female"] as Gender[]).map((gender) => ({
          gender,
          ageBandId: band.id,
          rows: [],
        })),
      ],
    });
  };
  const remove = (id: string) =>
    onChange({
      ...discipline,
      ageBands: discipline.ageBands.filter((band) => band.id !== id),
      formulas: discipline.formulas.filter((rule) => rule.ageBandId !== id),
      tables: discipline.tables?.filter((rule) => rule.ageBandId !== id),
    });
  return (
    <>
      <div className="mt-2 grid gap-2 md:grid-cols-3">
        {discipline.ageBands.map((band) => (
          <div className="rounded-lg bg-surface-container p-3" key={band.id}>
            <label>
              Name
              <input
                value={band.label}
                onChange={(e) =>
                  updateBands(
                    discipline.ageBands.map((item) =>
                      item.id === band.id
                        ? { ...item, label: e.target.value }
                        : item,
                    ),
                  )
                }
              />
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label>
                Von
                <input
                  type="number"
                  value={band.minAge ?? ""}
                  onChange={(e) =>
                    updateBands(
                      discipline.ageBands.map((item) =>
                        item.id === band.id
                          ? {
                              ...item,
                              minAge:
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                            }
                          : item,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Bis
                <input
                  type="number"
                  value={band.maxAge ?? ""}
                  onChange={(e) =>
                    updateBands(
                      discipline.ageBands.map((item) =>
                        item.id === band.id
                          ? {
                              ...item,
                              maxAge:
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                            }
                          : item,
                      ),
                    )
                  }
                />
              </label>
            </div>
            {discipline.ageBands.length > 1 && (
              <button
                className="mt-2 text-sm font-bold text-error underline"
                onClick={() => remove(band.id)}
              >
                Entfernen
              </button>
            )}
          </div>
        ))}
      </div>
      <button className="button-secondary mt-2" onClick={add}>
        Altersbereich hinzufügen
      </button>
    </>
  );
}

export function SportEditPage() {
  const { slug } = useParams();
  const stored = useLiveQuery(
    () =>
      db.sports
        .where("slug")
        .equals(slug ?? "")
        .first(),
    [slug],
  );
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
    const historyCount = await db.attempts
      .where("sportId")
      .equals(activeSport.id)
      .count();
    if (
      historyCount > 0 &&
      !confirm(
        "Für diese Sportart existiert ein Verlauf. Beim Entfernen der Disziplin muss der gesamte Verlauf dieser Sportart gelöscht werden. Fortfahren?",
      )
    )
      return;
    if (historyCount > 0)
      await db.attempts.where("sportId").equals(activeSport.id).delete();
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
