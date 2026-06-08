import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { addSport, deleteSport, getLastStandardSportsReport, replaceSportWithHistory, restoreStandardSports, useSports } from "@/infrastructure/repositories";
import { cloneImportedSport, createSportPackage, parseSportPackage, prepareSportReplacement } from "@/services/sportExchange";
import { createId, slugify, type Sport } from "@/domain";
import { PageTitle } from "@/shared/components";
export function SportsPage() {
  const sports = useSports();
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
      await addSport(sport);
      navigate(`/sportart/${slug}/edit`);
    } catch {
      alert("Name beziehungsweise Kurzname wird bereits verwendet.");
    }
  }
  async function remove(sport: Sport) {
    if (await deleteSport(sport.id)) return;
    if (
      confirm(
        "FÃ¼r diese Sportart existiert ein Verlauf. Sportart und gesamten Verlauf endgÃ¼ltig lÃ¶schen?",
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
        await addSport(
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
      <PageTitle intro="Sportarten bÃ¼ndeln Disziplinen, Formeln und zusammengehÃ¶rige DurchgÃ¤nge.">
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
                  {sport.disciplines.length} Disziplinen Â· maximal{" "}
                  {sport.totalMaxPoints.toFixed(sport.decimalPlaces)} Punkte
                </p>
              </div>
              <button
                className="button-danger self-start"
                onClick={() => remove(sport)}
              >
                LÃ¶schen
              </button>
            </div>
            <div className="mt-5 flex gap-2">
              <Link className="button-primary" to={`/sportart/${sport.slug}`}>
                Ã–ffnen
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
