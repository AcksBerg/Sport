import type { Unit } from "@/domain";

export const unitLabel = (unit: Unit) =>
  unit === "time" ? "Zeit" : unit === "distance" ? "Distanz" : "Wiederholungen";
