import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { saveProfile, useAllAttempts, useProfile, useSports } from "@/infrastructure/repositories";
import type { Gender } from "@/domain";
import { calculateUserProgress } from "@/domain/scoring";
import { PageTitle } from "@/shared/components";
export function ProfilePage() {
  const profile = useProfile();
  const sports = useSports();
  const attempts = useAllAttempts();
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
    await saveProfile({
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
            <option value="male">MÃ¤nnlich</option>
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
                <p className="text-sm text-secondary">Ãœberschuss</p>
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
      <h2 className="section-title">Beste vollstÃ¤ndige DurchgÃ¤nge</h2>
      {!profile && (
        <p className="notice">
          Speichere zuerst dein Profil, damit Leistungen ausgewertet werden
          kÃ¶nnen.
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
                      : "Noch keine vollstÃ¤ndige Wertung"}
                  </p>
                </div>
                <strong className="text-2xl text-primary">
                  {best
                    ? best.comparisonScore.toFixed(sport.decimalPlaces)
                    : "â€“"}{" "}
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
                Verlauf Ã¶ffnen
              </Link>
            </article>
          );
        })}
      </div>
    </>
  );
}
