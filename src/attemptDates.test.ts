import { describe, expect, it } from "vitest";
import { attemptDateValue, formatAttemptDate, localDateValue } from "./attemptDates";

describe("Durchgangsdaten", () => {
  it("liest reine Daten und bestehende ISO-Zeitstempel", () => {
    expect(attemptDateValue("2026-06-07")).toBe("2026-06-07");
    expect(attemptDateValue("2026-06-07T12:00:00.000Z")).toBe("2026-06-07");
    expect(formatAttemptDate("2026-06-07T12:00:00.000Z")).toContain("07.06.2026");
    expect(localDateValue(new Date("2026-06-07T12:00:00"))).toBe("2026-06-07");
  });
});
