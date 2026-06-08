import { useState } from "react";
import type { Discipline, Gender, TableRule } from "@/domain";
import { createImportedTableRows, parseDelimitedTable, suggestImportColumns, type ParsedTableData } from "@/services/tableImport";
export function TableImportPanel({
  discipline,
  tables,
  onChange,
}: {
  discipline: Discipline;
  tables: TableRule[];
  onChange: (tables: TableRule[]) => void;
}) {
  const [data, setData] = useState<ParsedTableData>();
  const [ageBandId, setAgeBandId] = useState(discipline.ageBands[0]?.id ?? "");
  const [pointsColumn, setPointsColumn] = useState(-1);
  const [maleColumn, setMaleColumn] = useState(-1);
  const [femaleColumn, setFemaleColumn] = useState(-1);
  const [maleDirection, setMaleDirection] = useState<
    "lowerIsBetter" | "higherIsBetter"
  >("lowerIsBetter");
  const [femaleDirection, setFemaleDirection] = useState<
    "lowerIsBetter" | "higherIsBetter"
  >("lowerIsBetter");
  const [error, setError] = useState("");
  async function load(file: File) {
    try {
      const parsed = parseDelimitedTable(await file.text());
      const suggestions = suggestImportColumns(parsed.headers);
      setData(parsed);
      setPointsColumn(suggestions.pointsColumn);
      setMaleColumn(suggestions.maleColumn);
      setFemaleColumn(suggestions.femaleColumn);
      setError("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Importdatei konnte nicht gelesen werden.",
      );
    }
  }
  function apply() {
    if (!data || pointsColumn < 0 || (maleColumn < 0 && femaleColumn < 0)) {
      setError("Bitte Punkte und mindestens eine Leistungsspalte auswÃ¤hlen.");
      return;
    }
    try {
      const imported = new Map<Gender, TableRule>();
      if (maleColumn >= 0)
        imported.set("male", {
          gender: "male",
          ageBandId,
          rows: createImportedTableRows(
            data,
            {
              pointsColumn,
              performanceColumn: maleColumn,
              direction: maleDirection,
            },
            discipline.unit,
          ),
        });
      if (femaleColumn >= 0)
        imported.set("female", {
          gender: "female",
          ageBandId,
          rows: createImportedTableRows(
            data,
            {
              pointsColumn,
              performanceColumn: femaleColumn,
              direction: femaleDirection,
            },
            discipline.unit,
          ),
        });
      if (
        !confirm(
          "Die ausgewÃ¤hlten Tabellen dieses Altersbands werden vollstÃ¤ndig ersetzt. Fortfahren?",
        )
      )
        return;
      const next = tables.filter(
        (rule) => !(rule.ageBandId === ageBandId && imported.has(rule.gender)),
      );
      onChange([...next, ...imported.values()]);
      setError("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Import fehlgeschlagen.",
      );
    }
  }
  const columnSelect = (
    value: number,
    onSelect: (value: number) => void,
    optional = false,
  ) => (
    <select
      value={value}
      onChange={(event) => onSelect(Number(event.target.value))}
    >
      <option value={-1}>
        {optional ? "Nicht importieren" : "Bitte auswÃ¤hlen"}
      </option>
      {data?.headers.map((header, index) => (
        <option key={`${header}-${index}`} value={index}>
          {header}
        </option>
      ))}
    </select>
  );
  let preview = "";
  let previewError = "";
  if (data && pointsColumn >= 0) {
    try {
      const counts = [
        ...(maleColumn >= 0
          ? [
              `MÃ¤nner: ${createImportedTableRows(data, { pointsColumn, performanceColumn: maleColumn, direction: maleDirection }, discipline.unit).length} Zeilen`,
            ]
          : []),
        ...(femaleColumn >= 0
          ? [
              `Frauen: ${createImportedTableRows(data, { pointsColumn, performanceColumn: femaleColumn, direction: femaleDirection }, discipline.unit).length} Zeilen`,
            ]
          : []),
      ];
      preview = counts.join(", ");
    } catch (caught) {
      previewError =
        caught instanceof Error
          ? caught.message
          : "Vorschau konnte nicht erstellt werden.";
    }
  }
  return (
    <details className="rounded-lg border border-outline-variant p-3">
      <summary className="cursor-pointer font-bold">
        CSV- oder Markdown-Tabelle importieren
      </summary>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <label>
          Altersband
          <select
            value={ageBandId}
            onChange={(event) => setAgeBandId(event.target.value)}
          >
            {discipline.ageBands.map((band) => (
              <option key={band.id} value={band.id}>
                {band.label}
              </option>
            ))}
          </select>
        </label>
        <label className="button-secondary cursor-pointer self-end">
          Datei auswÃ¤hlen
          <input
            className="hidden"
            type="file"
            accept=".csv,.tsv,.txt,.md,.mk,text/csv,text/plain"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void load(file);
              event.target.value = "";
            }}
          />
        </label>
        {data && (
          <p className="self-end text-sm text-secondary">
            {data.rows.length} Datenzeilen erkannt
          </p>
        )}
      </div>
      {data && (
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label>
            Punktespalte{columnSelect(pointsColumn, setPointsColumn)}
          </label>
          <label>
            MÃ¤nner-Leistung{columnSelect(maleColumn, setMaleColumn, true)}
          </label>
          <label>
            Frauen-Leistung{columnSelect(femaleColumn, setFemaleColumn, true)}
          </label>
          {maleColumn >= 0 && (
            <label>
              Richtung MÃ¤nner
              <select
                value={maleDirection}
                onChange={(event) =>
                  setMaleDirection(event.target.value as typeof maleDirection)
                }
              >
                <option value="lowerIsBetter">Kleiner ist besser</option>
                <option value="higherIsBetter">GrÃ¶ÃŸer ist besser</option>
              </select>
            </label>
          )}
          {femaleColumn >= 0 && (
            <label>
              Richtung Frauen
              <select
                value={femaleDirection}
                onChange={(event) =>
                  setFemaleDirection(
                    event.target.value as typeof femaleDirection,
                  )
                }
              >
                <option value="lowerIsBetter">Kleiner ist besser</option>
                <option value="higherIsBetter">GrÃ¶ÃŸer ist besser</option>
              </select>
            </label>
          )}
        </div>
      )}
      {preview && (
        <p className="mt-2 text-sm text-secondary">Vorschau: {preview}</p>
      )}
      {previewError && (
        <p className="mt-2 text-sm font-bold text-error">{previewError}</p>
      )}
      {error && <p className="mt-2 text-sm font-bold text-error">{error}</p>}
      {data && (
        <button
          disabled={Boolean(previewError)}
          className="button-secondary mt-3"
          onClick={apply}
        >
          AusgewÃ¤hlte Tabellen importieren
        </button>
      )}
    </details>
  );
}