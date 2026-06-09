import { useEffect, useState } from "react";
import { restoreStandardSports } from "@/infrastructure/repositories";
import App from "./App";

export function AppBootstrap() {
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  async function retry() {
    setLoading(true);
    const report = await restoreStandardSports();
    setErrors(report.errors);
    setLoading(false);
  }

  useEffect(() => {
    void restoreStandardSports().then((report) => {
      setErrors(report.errors);
      setLoading(false);
    });
  }, []);

  if (loading)
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <div className="card text-center">
          <p className="eyebrow">Sportleistung</p>
          <h1 className="mt-2 text-2xl font-black">
            Standardkatalog wird geladen …
          </h1>
        </div>
      </main>
    );

  return (
    <>
      {errors.length > 0 && (
        <div className="notice m-4">
          <strong>
            Der Standardkatalog konnte nicht vollständig geladen werden.
          </strong>
          {errors.map((error) => (
            <p className="mt-1 text-sm" key={error}>
              {error}
            </p>
          ))}
          <button className="button-secondary mt-3" onClick={() => void retry()}>
            Erneut versuchen
          </button>
        </div>
      )}
      <App />
    </>
  );
}
