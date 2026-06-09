import { describe, expect, it, vi } from "vitest";
import { createSportPackage } from "@/services/sportExchange";
import type { Sport } from "@/domain";
import { loadStandardCatalog, parseStandardManifest, sportFingerprint } from "@/services/standardCatalog";

const sport: Sport = { id: "s", slug: "s", name: "S", description: "", totalMaxPoints: 1, aggregation: "sum", roundingMode: "round", decimalPlaces: 0, ageBands: [], disciplines: [] };

describe("Standardkatalog", () => {
  it("lädt Manifest ohne Cache und Sportdateien mit Version", async () => {
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      void init;
      return String(input).includes("manifest.json") ? new Response(JSON.stringify({ sports: [{ file: "s.json", version: "7" }] }), { status: 200 }) : new Response(JSON.stringify(createSportPackage(sport)), { status: 200 });
    });
    const result = await loadStandardCatalog(fetcher as unknown as typeof fetch);
    expect(result.standards[0].sport.standard).toBe(true);
    expect(fetcher).toHaveBeenNthCalledWith(1, expect.stringContaining("manifest.json"), { cache: "no-store" });
    expect(String(fetcher.mock.calls[1][0])).toContain("s.json?v=7");
    expect(fetcher.mock.calls[1][1]).toEqual({ cache: "no-store" });
  });
  it("ignoriert interne Metadaten im Fingerabdruck", () => {
    expect(sportFingerprint(sport)).toBe(sportFingerprint({ ...sport, standard: true, standardSync: { version: "1", sourceFingerprint: "x", localFingerprint: "y" } }));
  });
  it("lehnt doppelte Manifestdateien ab", () => {
    expect(() => parseStandardManifest({ sports: [{ file: "s.json", version: "1" }, { file: "s.json", version: "2" }] })).toThrow();
  });
});
