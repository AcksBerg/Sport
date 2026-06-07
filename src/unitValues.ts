import type { Unit } from "./domain";

export const unitResolution = (unit: Unit) =>
  unit === "time" ? 10 : unit === "repetitions" ? 1 : 0.01;

export function roundToUnit(value: number, unit: Unit) {
  const resolution = unitResolution(unit);
  return Math.round(value / resolution) * resolution;
}

export function formatUnitValue(value: number, unit: Unit) {
  if (unit === "time") {
    const minutes = Math.floor(value / 60000);
    const seconds = Math.floor((value % 60000) / 1000);
    const hundredths = Math.floor((value % 1000) / 10);
    return `${minutes}:${String(seconds).padStart(2, "0")},${String(hundredths).padStart(2, "0")}`;
  }
  return unit === "repetitions" ? `${Math.round(value)}` : value.toFixed(2);
}
