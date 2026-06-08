import { describe, expect, it } from "vitest";
import type { Sport } from "@/domain";
import { cloneImportedSport, createSportPackage, parseSportPackage, prepareSportReplacement } from "@/services/sportExchange";

const sport: Sport = {
  id: "sport",
  slug: "test",
  name: "Test",
  description: "",
  totalMaxPoints: 100,
  aggregation: "sum",
  roundingMode: "round",
  decimalPlaces: 0,
  ageBands: [],
  disciplines: [{
    id: "discipline",
    name: "Lauf",
    unit: "time",
    maxPoints: 100,
    ageBands: [{ id: "band", minAge: 0, maxAge: null, label: "Alle" }],
    formulas: [{ gender: "male", ageBandId: "band", segments: [{ id: "segment", from: null, to: null, kind: "linear", a: 0, b: -1, c: 100 }] }],
  }],
};

describe("Sportart-Austausch", () => {
  it("exportiert und validiert ausschließlich die Definition", () => {
    const parsed = parseSportPackage(createSportPackage({ ...sport, standardSync: { version: "1", sourceFingerprint: "x", localFingerprint: "y" } }));
    expect(parsed.schemaVersion).toBe(2);
    expect(parsed.sport.name).toBe("Test");
    expect("attempts" in parsed).toBe(false);
    expect(parsed.sport.standardSync).toBeUndefined();
  });

  it("importiert eine Kopie mit neuen IDs und eindeutigem Slug", () => {
    const copy = cloneImportedSport(sport, ["test-kopie"]);
    expect(copy.id).not.toBe(sport.id);
    expect(copy.disciplines[0].id).not.toBe("discipline");
    expect(copy.slug).toBe("test-kopie-2");
  });

  it("behält beim Ersetzen Sport- und gleichnamige Disziplin-ID", () => {
    const replacement = prepareSportReplacement(sport, { ...sport, id: "import", disciplines: [{ ...sport.disciplines[0], id: "other" }] });
    expect(replacement.id).toBe("sport");
    expect(replacement.disciplines[0].id).toBe("discipline");
  });

  it("lehnt alte Disziplinpakete ab", () => {
    expect(() => parseSportPackage({ schemaVersion: 1, discipline: {} })).toThrow();
  });

  it("normalisiert alte Zeitformeln und erhält automatische Boni", () => {
    const legacy = structuredClone(sport);
    legacy.disciplines[0].automaticPointModifiers = [{
      id: "bonus",
      label: "Altersbonus",
      kind: "agePercentagePerYear",
      factor: 0.005,
      gender: "all",
      referenceAge: 35,
      minAge: 36,
    }];
    const parsed = parseSportPackage({ schemaVersion: 1, exportedAt: "", sport: legacy });
    expect(parsed.schemaVersion).toBe(2);
    expect(parsed.sport.disciplines[0].formulas[0]).toMatchObject({
      formulaValueUnit: "display",
      segments: [{ b: -1000 }],
    });
    expect(parsed.sport.disciplines[0].automaticPointModifiers?.[0].factor).toBe(0.005);
  });
});
