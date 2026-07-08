import { describe, expect, it, vi } from "vitest";
import { createSportPackage } from "@/services/sportExchange";
import type { Sport } from "@/domain";
import { loadStandardCatalog, parseStandardManifest, sportFingerprint } from "@/services/standardCatalog";

const sport: Sport = {
  id: "s",
  slug: "s",
  name: "S",
  description: "",
  totalMaxPoints: 1,
  aggregation: "sum",
  roundingMode: "round",
  decimalPlaces: 0,
  ageBands: [],
  disciplines: [],
};

describe("Standardkatalog", () => {
  it("lädt Manifest ohne Cache und Sportdateien mit Version", async () => {
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      void init;
      return String(input).includes("manifest.json")
        ? new Response(JSON.stringify({ sports: [{ file: "s.json", version: "7" }] }), { status: 200 })
        : new Response(JSON.stringify(createSportPackage(sport)), { status: 200 });
    });
    const result = await loadStandardCatalog(fetcher as unknown as typeof fetch);
    expect(result.standards[0].sport.standard).toBe(true);
    expect(result.standards[0].sport.sourceExportedAt).toBeTruthy();
    expect(fetcher).toHaveBeenNthCalledWith(1, expect.stringContaining("manifest.json"), { cache: "no-store" });
    expect(String(fetcher.mock.calls[1][0])).toContain("s.json?v=7");
    expect(fetcher.mock.calls[1][1]).toEqual({ cache: "no-store" });
  });

  it("ignoriert interne und inaktive Metadaten im Fingerabdruck", () => {
    const withInactiveTables: Sport = {
      ...sport,
      sourceExportedAt: "2026-01-01T00:00:00.000Z",
      disciplines: [{
        id: "d",
        name: "D",
        unit: "repetitions",
        maxPoints: 100,
        scoringMode: "formula",
        ageBands: [{ id: "all", minAge: 0, maxAge: 100, label: "Alle" }],
        formulas: [{ gender: "male", ageBandId: "all", segments: [{ id: "s", from: null, to: null, kind: "linear", a: 0, b: 1, c: 0 }] }],
        tables: [{ gender: "male", ageBandId: "all", rows: [{ id: "r", from: 1, to: 1, points: 1 }] }],
      }],
    };
    expect(sportFingerprint(sport)).toBe(sportFingerprint({ ...sport, standard: true, standardSync: { version: "1", sourceFingerprint: "x", localFingerprint: "y" } }));
    expect(sportFingerprint(withInactiveTables)).toBe(sportFingerprint({
      ...withInactiveTables,
      sourceExportedAt: "2026-02-01T00:00:00.000Z",
      disciplines: withInactiveTables.disciplines.map((discipline) => ({ ...discipline, tables: undefined })),
    }));
  });

  it("lehnt doppelte Manifestdateien ab", () => {
    expect(() => parseStandardManifest({ sports: [{ file: "s.json", version: "1" }, { file: "s.json", version: "2" }] })).toThrow();
  });
});
