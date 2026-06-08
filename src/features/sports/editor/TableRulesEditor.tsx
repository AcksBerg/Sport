import { createId, type Discipline, type Gender, type TableGeneratorRecipe, type TableRule } from "@/domain";
import { generateTableRows } from "@/services/tableGeneration";
import { UnitValueInput } from "@/shared/components";
import { genderLabel } from "@/shared/labels";
import { TableGeneratorPanel } from "./TableGeneratorPanel";
import { TableImportPanel } from "./TableImportPanel";
export function TableRulesEditor({
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
          Leere Tabellen fÃ¼r alle Gruppen anlegen
        </button>
      )}
      {tables.map((rule) => (
        <details
          className="rounded-lg bg-surface-container p-3"
          key={`${rule.gender}-${rule.ageBandId}`}
        >
          <summary className="cursor-pointer font-bold">
            {genderLabel(rule.gender)} Â·{" "}
            {
              discipline.ageBands.find((band) => band.id === rule.ageBandId)
                ?.label
            }{" "}
            Â· {rule.rows.length} Zeilen
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
                    "Die bestehende Tabelle dieser Bewertungsgruppe wird vollstÃ¤ndig ersetzt. Fortfahren?",
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
                Warnung: Tabellenbereiche Ã¼berschneiden sich. Bei der Bewertung
                gewinnt der hÃ¶here Punktwert.
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
              Tabellenzeile hinzufÃ¼gen
            </button>
          </div>
        </details>
      ))}
    </div>
  );
}
