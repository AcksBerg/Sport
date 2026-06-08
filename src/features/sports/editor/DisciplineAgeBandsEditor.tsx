import { createId, type Discipline, type Gender } from "@/domain";
export function DisciplineAgeBandsEditor({
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