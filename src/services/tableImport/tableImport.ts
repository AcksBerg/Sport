import { createId, type TableRow, type Unit } from "@/domain";
import { roundToUnit, unitResolution } from "@/shared/utils/units";

export interface ParsedTableData {
  headers: string[];
  rows: { line: number; values: string[] }[];
}

export interface TableImportMapping {
  pointsColumn: number;
  performanceColumn: number;
  direction: "lowerIsBetter" | "higherIsBetter";
}

function splitDelimited(line: string, delimiter: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') value += line[++index];
      else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      values.push(value.trim());
      value = "";
    } else value += character;
  }
  values.push(value.trim());
  return values;
}

export function parseDelimitedTable(text: string): ParsedTableData {
  const lines = text.split(/\r?\n/).map((line, index) => ({ line: index + 1, text: line.trim() })).filter((line) => line.text);
  if (!lines.length) throw new Error("Die Importdatei ist leer.");
  const markdown = lines[0].text.startsWith("|") && lines[0].text.endsWith("|");
  const delimiter = markdown
    ? "|"
    : lines[0].text.includes(";")
      ? ";"
      : lines[0].text.includes("\t")
        ? "\t"
        : ",";
  const split = (line: string) => {
    const values = splitDelimited(line, delimiter);
    return markdown ? values.slice(1, -1).map((value) => value.trim()) : values;
  };
  const headers = split(lines[0].text);
  if (headers.length < 2) throw new Error("Es wurden nicht genügend Spalten erkannt.");
  const content = lines.slice(1).filter((line) => {
    const values = split(line.text);
    return !markdown || !values.every((value) => /^:?-+:?$/.test(value.replace(/\s/g, "")));
  });
  return { headers, rows: content.map((line) => ({ line: line.line, values: split(line.text) })) };
}

export function suggestImportColumns(headers: string[]) {
  const normalized = headers.map((header) => header.toLocaleLowerCase("de"));
  const find = (...needles: string[]) => normalized.findIndex((header) => needles.some((needle) => header.includes(needle)));
  return {
    pointsColumn: find("punkt", "score"),
    maleColumn: find("männ", "maenn", "male"),
    femaleColumn: find("frau", "weib", "female"),
  };
}

export function parseImportedValue(value: string, unit: Unit) {
  const trimmed = value.trim();
  if (unit === "time") {
    const match = trimmed.match(/^(\d+):(\d{1,2})(?:[,.](\d{1,2}))?$/);
    if (!match) throw new Error(`Zeitwert "${value}" ist ungültig.`);
    return Number(match[1]) * 60000 + Number(match[2]) * 1000 + Number((match[3] ?? "").padEnd(2, "0")) * 10;
  }
  const parsed = Number(trimmed.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(parsed)) throw new Error(`Leistungswert "${value}" ist ungültig.`);
  return unit === "repetitions" ? Math.round(parsed) : roundToUnit(parsed, unit);
}

export function parseImportedPoints(value: string) {
  const parsed = Number(value.trim().replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(parsed)) throw new Error(`Punktwert "${value}" ist ungültig.`);
  return parsed;
}

export function createImportedTableRows(
  data: ParsedTableData,
  mapping: TableImportMapping,
  unit: Unit,
): TableRow[] {
  const thresholds = data.rows.map(({ line, values }) => {
    try {
      return {
        value: parseImportedValue(values[mapping.performanceColumn] ?? "", unit),
        points: parseImportedPoints(values[mapping.pointsColumn] ?? ""),
      };
    } catch (error) {
      throw new Error(`Zeile ${line}: ${error instanceof Error ? error.message : "ungültiger Wert"}`, { cause: error });
    }
  }).sort((left, right) => left.value - right.value);
  if (!thresholds.length) throw new Error("Die Importdatei enthält keine Datenzeilen.");
  const uniqueValues = new Set(thresholds.map((threshold) => threshold.value));
  if (uniqueValues.size !== thresholds.length) throw new Error("Die Leistungsspalte enthält doppelte Schwellenwerte.");
  const increasing = thresholds.every((threshold, index) => index === 0 || threshold.points >= thresholds[index - 1].points);
  const decreasing = thresholds.every((threshold, index) => index === 0 || threshold.points <= thresholds[index - 1].points);
  if ((mapping.direction === "higherIsBetter" && !increasing) || (mapping.direction === "lowerIsBetter" && !decreasing))
    throw new Error("Punktwerte und gewählte Leistungsrichtung widersprechen sich.");
  const resolution = unitResolution(unit);
  return thresholds.map((threshold, index) => ({
    id: createId(),
    from: index === 0 ? null : threshold.value,
    to: index === thresholds.length - 1 ? null : roundToUnit(thresholds[index + 1].value - resolution, unit),
    points: threshold.points,
  }));
}
