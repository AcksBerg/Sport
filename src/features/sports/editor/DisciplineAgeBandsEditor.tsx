import {
  changeAgeBandBoundary,
  normalizeAgeBands,
  removeAgeBand,
  splitAgeBand,
  type Discipline,
  type Gender,
} from "@/domain";

export function DisciplineAgeBandsEditor({
  discipline,
  onChange,
}: {
  discipline: Discipline;
  onChange: (discipline: Discipline) => void;
}) {
  const bands = normalizeAgeBands(discipline.ageBands);

  function updateBands(ageBands: Discipline["ageBands"]) {
    onChange({ ...discipline, ageBands });
  }

  function changeBoundary(
    id: string,
    boundary: "minAge" | "maxAge",
    value: number,
  ) {
    try {
      updateBands(changeAgeBandBoundary(bands, id, boundary, value));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Ungültige Altersgrenze.");
    }
  }

  function split(id: string) {
    const band = bands.find((item) => item.id === id);
    if (!band) return;
    const input = prompt(
      `Neues Startalter zwischen ${(band.minAge ?? 0) + 1} und ${band.maxAge}:`,
    );
    if (input === null) return;
    const splitAt = Number(input);
    if (
      !Number.isInteger(splitAt) ||
      splitAt <= (band.minAge ?? 0) ||
      splitAt > (band.maxAge ?? 100)
    ) {
      alert("Das Startalter liegt nicht innerhalb dieses Altersbereichs.");
      return;
    }
    const nextBands = splitAgeBand(bands, splitAt);
    if (nextBands.length === bands.length) {
      alert("Das Startalter liegt nicht innerhalb dieses Altersbereichs.");
      return;
    }
    const newBand = nextBands.find(
      (item) => !bands.some((existing) => existing.id === item.id),
    )!;
    onChange({
      ...discipline,
      ageBands: normalizeAgeBands(nextBands),
      formulas: [
        ...discipline.formulas,
        ...(["male", "female"] as Gender[]).map((gender) => ({
          gender,
          ageBandId: newBand.id,
          formulaValueUnit: "display" as const,
          segments: [
            {
              id: crypto.randomUUID(),
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
          ageBandId: newBand.id,
          rows: [],
        })),
      ],
    });
  }

  function remove(id: string) {
    onChange({
      ...discipline,
      ageBands: normalizeAgeBands(removeAgeBand(bands, id)),
      formulas: discipline.formulas.filter((rule) => rule.ageBandId !== id),
      tables: discipline.tables?.filter((rule) => rule.ageBandId !== id),
    });
  }

  return (
    <div className="mt-2 grid gap-2 md:grid-cols-3">
      {bands.map((band, index) => (
        <div className="rounded-lg bg-surface-container p-3" key={band.id}>
          <label>
            Name
            <input
              value={band.label}
              onChange={(event) =>
                updateBands(
                  bands.map((item) =>
                    item.id === band.id
                      ? { ...item, label: event.target.value }
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
                disabled={index === 0}
                min="0"
                max="100"
                type="number"
                value={band.minAge ?? 0}
                onChange={(event) =>
                  changeBoundary(band.id, "minAge", Number(event.target.value))
                }
              />
            </label>
            <label>
              Bis
              <input
                disabled={index === bands.length - 1}
                min="0"
                max="100"
                type="number"
                value={band.maxAge ?? 100}
                onChange={(event) =>
                  changeBoundary(band.id, "maxAge", Number(event.target.value))
                }
              />
            </label>
          </div>
          <div className="mt-2 flex gap-3 text-sm font-bold">
            <button className="underline" onClick={() => split(band.id)}>
              Teilen
            </button>
            {bands.length > 1 && (
              <button
                className="text-error underline"
                onClick={() => remove(band.id)}
              >
                Entfernen
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
