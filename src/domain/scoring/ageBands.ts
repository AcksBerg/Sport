import type { AgeBand } from "@/domain/types";

export function normalizeAgeBands(ageBands: AgeBand[]): AgeBand[] {
  if (ageBands.length === 0) throw new Error("Mindestens ein Altersbereich ist erforderlich.");
  if (
    ageBands.some(
      (band) =>
        band.minAge !== null &&
        band.maxAge !== null &&
        band.minAge > band.maxAge,
    )
  )
    throw new Error("Altersbereiche dürfen nicht invertiert sein.");
  const sorted = structuredClone(ageBands).sort(
    (left, right) => (left.minAge ?? 0) - (right.minAge ?? 0),
  );
  const starts = sorted.map((band, index) => index === 0 ? 0 : band.minAge);
  if (starts.some((start) => start === null || !Number.isInteger(start) || start < 0 || start > 100))
    throw new Error("Startalter müssen ganze Zahlen zwischen 0 und 100 sein.");
  if (new Set(starts).size !== starts.length)
    throw new Error("Altersbereiche dürfen nicht mit demselben Alter beginnen.");
  return sorted.map((band, index) => {
    const minAge = starts[index] as number;
    const maxAge = index === sorted.length - 1 ? 100 : (starts[index + 1] as number) - 1;
    if (minAge > maxAge) throw new Error("Altersbereiche dürfen nicht invertiert sein.");
    return { ...band, minAge, maxAge };
  });
}

export function validateAgeBands(ageBands: AgeBand[]): string[] {
  try {
    const normalized = normalizeAgeBands(ageBands);
    return normalized.every(
      (band, index) => band.minAge === ageBands[index]?.minAge && band.maxAge === ageBands[index]?.maxAge,
    )
      ? []
      : ["Altersbereiche müssen lückenlos von 0 bis 100 reichen."];
  } catch (error) {
    return [error instanceof Error ? error.message : "Ungültige Altersbereiche."];
  }
}

export function changeAgeBandBoundary(
  ageBands: AgeBand[],
  id: string,
  boundary: "minAge" | "maxAge",
  value: number,
): AgeBand[] {
  const sorted = normalizeAgeBands(ageBands);
  const index = sorted.findIndex((band) => band.id === id);
  if (index < 0) return sorted;
  if (boundary === "minAge") {
    if (index === 0) return sorted;
    sorted[index].minAge = value;
  } else {
    if (index === sorted.length - 1) return sorted;
    sorted[index + 1].minAge = value + 1;
  }
  return normalizeAgeBands(sorted);
}
