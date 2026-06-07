import { describe, expect, it } from "vitest";
import testValues from "../testwerte.mk?raw";
import { createImportedTableRows, parseDelimitedTable, parseImportedValue, suggestImportColumns } from "./tableImport";

describe("Tabellenimport", () => {
  const markdown = `| Punkte | Zeit Männer | Zeit Frauen |
| -----: | :---------: | :---------: |
| 25,00 | 01:15,00 | 01:35,00 |
| 24,86 | 01:15,50 | 01:35,65 |`;

  it("erkennt Markdown-Spalten und deutsche Zeitwerte", () => {
    const parsed = parseDelimitedTable(markdown);
    expect(parsed.rows).toHaveLength(2);
    expect(suggestImportColumns(parsed.headers)).toEqual({ pointsColumn: 0, maleColumn: 1, femaleColumn: 2 });
    expect(parseImportedValue("01:15,50", "time")).toBe(75500);
  });

  it("erzeugt lückenlose inklusive Schwellenbereiche", () => {
    const parsed = parseDelimitedTable(markdown);
    const rows = createImportedTableRows(parsed, { pointsColumn: 0, performanceColumn: 1, direction: "lowerIsBetter" }, "time");
    expect(rows).toEqual([
      expect.objectContaining({ from: null, to: 75490, points: 25 }),
      expect.objectContaining({ from: 75500, to: null, points: 24.86 }),
    ]);
  });

  it("liest Semikolon-CSV mit Dezimalkomma", () => {
    const parsed = parseDelimitedTable("Punkte;Distanz\n10,5;12,25");
    const rows = createImportedTableRows(parsed, { pointsColumn: 0, performanceColumn: 1, direction: "higherIsBetter" }, "distance");
    expect(rows[0]).toMatchObject({ from: null, to: null, points: 10.5 });
  });

  it("liest die bereitgestellte testwerte.mk mit Männer- und Frauenspalte", () => {
    const parsed = parseDelimitedTable(testValues);
    expect(parsed.rows.length).toBeGreaterThan(90);
    expect(suggestImportColumns(parsed.headers)).toEqual({ pointsColumn: 0, maleColumn: 1, femaleColumn: 2 });
  });
});
