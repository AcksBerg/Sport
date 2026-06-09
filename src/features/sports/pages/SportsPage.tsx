import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  addSport,
  getStandardCatalogState,
  replaceSportWithHistory,
  restoreStandardSports,
  updateStandardSport,
  useSports,
} from "@/infrastructure/repositories";
import {
  cloneImportedSport,
  parseSportPackage,
  prepareSportReplacement,
} from "@/services/sportExchange";
import {
  createId,
  slugify,
  type Sport,
  type StandardCatalogState,
} from "@/domain";
import { PageTitle } from "@/shared/components";

export function SportsPage() {
  const sports = useSports();
  const [catalogState, setCatalogState] = useState(getStandardCatalogState);
  const navigate = useNavigate();

  useEffect(() => {
    const update = (event: Event) =>
      setCatalogState((event as CustomEvent<StandardCatalogState>).detail);
    window.addEventListener("standard-sports-sync", update);
    return () => window.removeEventListener("standard-sports-sync", update);
  }, []);

  const statusBySportId = new Map(
    catalogState.statuses
      .filter((status) => status.sportId)
      .map((status) => [status.sportId, status]),
  );
  const counters = {
    own: sports?.filter((sport) => !sport.standard).length ?? 0,
    current: catalogState.statuses.filter(
      (status) => status.isStandard && !status.isOutdated,
    ).length,
    outdated: catalogState.statuses.filter((status) => status.isOutdated).length,
    modified: catalogState.statuses.filter(
      (status) => status.isLocallyModified,
    ).length,
  };

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

  async function updateStandard(sport: Sport) {
    const status = statusBySportId.get(sport.id);
    if (
      status?.isLocallyModified &&
      !confirm(
        "Die lokal angepasste Definition wird durch den aktuellen Standard ersetzt. Fortfahren?",
      )
    )
      return;
    try {
      await updateStandardSport(sport.slug);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Standard konnte nicht aktualisiert werden.",
      );
    }
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

  return (
    <>
      <PageTitle intro="Sportarten bündeln Disziplinen, Formeln und zusammengehörige Durchgänge.">
        Sportarten
      </PageTitle>
      <div className="grid gap-4 md:grid-cols-2">
        {sports?.map((sport) => {
          const status = statusBySportId.get(sport.id);
          return (
            <article className="card" key={sport.id}>
              <div>
                  <p className="eyebrow">
                    {sport.standard ? "Standard" : "Eigene Sportart"}
                  </p>
                  <h2 className="text-xl font-bold">{sport.name}</h2>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {!sport.standard && !status?.hasConflict && (
                      <span className="chip">Eigene Sportart</span>
                    )}
                    {sport.standard && !status?.isOutdated && (
                      <span className="chip">Standard aktuell</span>
                    )}
                    {status?.isOutdated && (
                      <button
                        className="chip"
                        onClick={() => void updateStandard(sport)}
                      >
                        Standard veraltet · aktualisieren
                      </button>
                    )}
                    {status?.isLocallyModified && (
                      <button
                        className="chip"
                        onClick={() => void updateStandard(sport)}
                      >
                        Lokal angepasst · zurücksetzen
                      </button>
                    )}
                    {status?.hasConflict && (
                      <span className="chip">Katalogkonflikt</span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-secondary">
                    {sport.disciplines.length} Disziplinen · maximal{" "}
                    {sport.totalMaxPoints.toFixed(sport.decimalPlaces)} Punkte
                  </p>
              </div>
              <div className="mt-5">
                <Link className="button-primary" to={`/sportart/${sport.slug}`}>
                  Öffnen
                </Link>
              </div>
            </article>
          );
        })}
      </div>
      <section className="mt-8">
        <h2 className="section-title">Sportarten verwalten</h2>
        <div className="notice mb-4">
          <strong>Standardkatalog</strong>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Eigene Sportarten", counters.own],
              ["Standards aktuell", counters.current],
              ["Standards veraltet", counters.outdated],
              ["Lokal angepasst", counters.modified],
            ].map(([label, count]) => (
              <div className="rounded-lg bg-surface-container-low p-3" key={label}>
                <p className="text-sm">{label}</p>
                <p className="text-2xl font-black">{count}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm">
            Letzter Abgleich: Neu {catalogState.report.created.length},
            aktualisiert {catalogState.report.updated.length}, vorhanden{" "}
            {catalogState.report.preserved.length}.
          </p>
          {catalogState.report.errors.map((error) => (
            <p className="mt-1 text-sm font-bold text-error" key={error}>
              {error}
            </p>
          ))}
          <button
            className="button-secondary mt-3"
            onClick={() => void restoreStandardSports()}
          >
            Fehlende Standards wiederherstellen
          </button>
        </div>
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
        </div>
      </section>
    </>
  );
}
