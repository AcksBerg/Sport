import { Link } from "react-router-dom";
import { useProfile } from "@/infrastructure/repositories";
export function HomePage() {
  const profile = useProfile();
  const profileComplete = Boolean(
    profile?.birthDate &&
    profile?.gender &&
    Number.isFinite(profile?.targetPoints) &&
    profile!.targetPoints > 0,
  );
  return (
    <>
      <section className="card grid overflow-hidden mb-2 bg-error-container text-on-error-container lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-center lg:gap-8">
        Die Bewertungsgrundlagen sind noch nicht abschließend festgelegt und
        werden laufend angepasst. Alle Angaben sind ohne Gewähr. Letzte
        Aktualisierung vom 07.07.2026.
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
