import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getStandardCatalogState,
  useProfile,
} from "@/infrastructure/repositories";
import type { StandardCatalogState } from "@/domain";
import { formatDataDate } from "@/shared/utils/dates";
export function HomePage() {
  const profile = useProfile();
  const [catalogState, setCatalogState] = useState(getStandardCatalogState);
  const dataDate = formatDataDate(catalogState.latestExportedAt);
  const profileComplete = Boolean(
    profile?.birthDate &&
    profile?.gender &&
    Number.isFinite(profile?.targetPoints) &&
    profile!.targetPoints > 0,
  );
  useEffect(() => {
    const update = (event: Event) =>
      setCatalogState((event as CustomEvent<StandardCatalogState>).detail);
    window.addEventListener("standard-sports-sync", update);
    return () => window.removeEventListener("standard-sports-sync", update);
  }, []);
  return (
    <>
      <section className="grid overflow-hidden gap-4 mb-4  lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-center lg:gap-4">
        <div className="card bg-error-container text-on-error-container h-full place-content-center">
          Die Bewertungsgrundlagen sind nicht abschließend festgelegt und werden
          laufend angepasst. Alle Angaben sind ohne Gewähr.
        </div>
        <div className="card bg-primary-container text-on-primary-container">
          {dataDate ? (
            <>
              Letzte Aktualisierung am <strong>{dataDate}</strong>. Auf Basis
              der Daten vom <strong>09.07.2026</strong>.
            </>
          ) : (
            "Stand der lokalen Datenbasis nicht verfügbar."
          )}
        </div>
      </section>
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
            "Profil, Definitionen und Rohleistungen werden ausschließlich in deinem Browser gespeichert.",
          ],
          [
            "Immer aktuell",
            "Punkte werden nicht fest gespeichert, sondern mit der aktuell hinterlegten Formeln neu berechnet.",
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
