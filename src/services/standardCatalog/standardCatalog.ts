import type { Sport, StandardSportsManifest } from "@/domain";
import { parseSportPackage, prepareSportReplacement } from "@/services/sportExchange";

export interface LoadedStandard {
  sport: Sport;
  version: string;
  fingerprint: string;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== "standard" && key !== "standardSync")
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sportFingerprint(sport: Sport) {
  let hash = 2166136261;
  for (const character of stable(sport)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function parseStandardManifest(value: unknown): StandardSportsManifest {
  if (!value || typeof value !== "object" || !Array.isArray((value as Partial<StandardSportsManifest>).sports))
    throw new Error("Ungültiges Standardsportarten-Manifest.");
  const manifest = value as StandardSportsManifest;
  const files = new Set<string>();
  manifest.sports.forEach((entry) => {
    if (!entry.file || !entry.file.endsWith(".json") || !entry.version)
      throw new Error("Jeder Manifesteintrag benötigt JSON-Datei und Version.");
    if (files.has(entry.file)) throw new Error(`Doppelte Standarddatei: ${entry.file}.`);
    files.add(entry.file);
  });
  return manifest;
}

export async function loadStandardCatalog(fetcher: typeof fetch = fetch): Promise<{ standards: LoadedStandard[]; errors: string[] }> {
  const base = `${import.meta.env.BASE_URL}sports/`;
  const manifestResponse = await fetcher(`${base}manifest.json`, { cache: "no-store" });
  if (!manifestResponse.ok) throw new Error(`Standardkatalog konnte nicht geladen werden (${manifestResponse.status}).`);
  const manifest = parseStandardManifest(await manifestResponse.json());
  const standards: LoadedStandard[] = [];
  const errors: string[] = [];
  const slugs = new Set<string>();
  const ids = new Set<string>();
  for (const entry of manifest.sports) {
    try {
      const response = await fetcher(`${base}${encodeURIComponent(entry.file)}?v=${encodeURIComponent(entry.version)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const sport = structuredClone(parseSportPackage(await response.json()).sport);
      if (slugs.has(sport.slug) || ids.has(sport.id)) throw new Error("Doppelte Sport-ID oder doppelter Slug.");
      slugs.add(sport.slug);
      ids.add(sport.id);
      sport.standard = true;
      const fingerprint = sportFingerprint(sport);
      standards.push({ sport, version: entry.version, fingerprint });
    } catch (error) {
      errors.push(`${entry.file}: ${error instanceof Error ? error.message : "unbekannter Fehler"}`);
    }
  }
  return { standards, errors };
}

export function prepareStandardUpdate(existing: Sport, loaded: LoadedStandard) {
  const replacement = prepareSportReplacement(existing, loaded.sport);
  replacement.standard = true;
  const localFingerprint = sportFingerprint(replacement);
  replacement.standardSync = { version: loaded.version, sourceFingerprint: loaded.fingerprint, localFingerprint };
  return replacement;
}

export function attachStandardSync(sport: Sport, loaded: LoadedStandard) {
  const result = structuredClone(sport);
  result.standard = true;
  const localFingerprint = sportFingerprint(result);
  result.standardSync = { version: loaded.version, sourceFingerprint: loaded.fingerprint, localFingerprint };
  return result;
}

export function standardIsLocallyUnchanged(sport: Sport) {
  return Boolean(sport.standardSync && sportFingerprint(sport) === sport.standardSync.localFingerprint);
}
