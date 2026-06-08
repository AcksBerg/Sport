import { useState } from "react";
import type { Discipline, TableGeneratorRecipe } from "@/domain";
import { generateTableRows, validateGeneratorRecipe } from "@/services/tableGeneration";
import { UnitValueInput } from "@/shared/components";
import { unitLabel } from "@/shared/labels";
export function TableGeneratorPanel({
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
