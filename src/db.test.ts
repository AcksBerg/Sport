import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db, deleteSport, replaceSportWithHistory, restoreStandardSports } from "./db";
import { createSportPackage } from "./exchange";
import type { Attempt, Sport } from "./domain";

const discipline = { id: "discipline", name: "Lauf", unit: "time" as const, maxPoints: 100, ageBands: [{ id: "all", minAge: 0, maxAge: null, label: "Alle" }], formulas: [{ gender: "male" as const, ageBandId: "all", segments: [{ id: "segment", from: null, to: null, kind: "linear" as const, a: 0, b: -1, c: 100 }] }] };
const standard: Sport = { id: "standard-test", slug: "test", name: "Teststandard", description: "", totalMaxPoints: 100, aggregation: "sum", roundingMode: "round", decimalPlaces: 0, ageBands: [], disciplines: [discipline] };
const catalogFetch = (sport = standard, version = "1") => (async (input: string | URL | Request) => String(input).includes("manifest.json") ? new Response(JSON.stringify({ sports: [{ file: "test.json", version }] }), { status: 200 }) : new Response(JSON.stringify(createSportPackage(sport)), { status: 200 })) as typeof fetch;

describe("IndexedDB-Repository", () => {
  beforeEach(async () => { await db.open(); await db.profile.clear(); await db.attempts.clear(); await db.sports.clear(); });
  afterEach(async () => { await db.profile.clear(); await db.attempts.clear(); await db.sports.clear(); });

  it("ergänzt, aktualisiert und schützt lokal bearbeitete Standards", async () => {
    expect((await restoreStandardSports(catalogFetch())).created).toEqual(["Teststandard"]);
    const first = (await db.sports.where("slug").equals("test").first())!;
    expect((await restoreStandardSports(catalogFetch({ ...standard, description: "Neu" }, "2"))).updated).toEqual(["Teststandard"]);
    await db.sports.update(first.id, { name: "Mein Standard" });
    expect((await restoreStandardSports(catalogFetch({ ...standard, description: "Noch neuer" }, "3"))).preserved).toEqual(["Mein Standard"]);
  });

  it("startet bei fehlendem Katalog mit lokalen Daten weiter", async () => {
    expect((await restoreStandardSports((async () => new Response("", { status: 503 })) as typeof fetch)).errors[0]).toContain("503");
  });

  it("blockiert Löschen mit Historie und löscht nach Bestätigung kaskadierend", async () => {
    await restoreStandardSports(catalogFetch());
    const sport = (await db.sports.where("slug").equals("test").first())!;
    const attempt: Attempt = { id: "attempt", sportId: sport.id, date: "2026-06-07", status: "draft", performances: [] };
    await db.attempts.add(attempt);
    expect(await deleteSport(sport.id)).toBe(false);
    expect(await deleteSport(sport.id, true)).toBe(true);
    expect(await db.attempts.get(attempt.id)).toBeUndefined();
  });

  it("passt Historien beim Ersetzen an und macht unvollständige Durchgänge zu Entwürfen", async () => {
    await restoreStandardSports(catalogFetch());
    const sport = (await db.sports.where("slug").equals("test").first())!;
    await db.attempts.add({ id: "replace-attempt", sportId: sport.id, date: "2026-06-07", status: "complete", performances: [{ disciplineId: discipline.id, value: 1 }] });
    await replaceSportWithHistory(sport.id, { ...sport, disciplines: [{ ...discipline, id: "new", name: "Neu" }] });
    expect(await db.attempts.get("replace-attempt")).toMatchObject({ status: "draft", performances: [] });
  });
});
