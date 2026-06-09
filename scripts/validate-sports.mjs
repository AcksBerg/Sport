import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const directory = resolve("public/sports");
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8"));
if (!manifest || !Array.isArray(manifest.sports)) throw new Error("Ungültiges public/sports/manifest.json.");

const files = new Set();
const slugs = new Set();
const ids = new Set();
function validateAgeBands(ageBands, context) {
  if (!Array.isArray(ageBands) || ageBands.length === 0)
    throw new Error(`Keine Altersbereiche in ${context}.`);
  const sorted = [...ageBands].sort((left, right) => (left.minAge ?? 0) - (right.minAge ?? 0));
  if (sorted[0].minAge !== 0 || sorted.at(-1).maxAge !== 100)
    throw new Error(`Altersbereiche in ${context} müssen von 0 bis 100 reichen.`);
  sorted.forEach((band, index) => {
    if (!Number.isInteger(band.minAge) || !Number.isInteger(band.maxAge) || band.minAge > band.maxAge)
      throw new Error(`Ungültiger Altersbereich in ${context}.`);
    if (index > 0 && sorted[index - 1].maxAge + 1 !== band.minAge)
      throw new Error(`Lücke oder Überschneidung in den Altersbereichen von ${context}.`);
  });
}
for (const entry of manifest.sports) {
  if (!entry?.file?.endsWith(".json") || !entry.version) throw new Error("Jeder Manifesteintrag benötigt JSON-Datei und Version.");
  if (files.has(entry.file)) throw new Error(`Doppelte Manifestdatei: ${entry.file}`);
  files.add(entry.file);
  const pkg = JSON.parse(await readFile(resolve(directory, entry.file), "utf8"));
  if (![1, 2].includes(pkg.schemaVersion) || !pkg.sport || !Array.isArray(pkg.sport.disciplines)) throw new Error(`Ungültiges Sportpaket: ${entry.file}`);
  if (slugs.has(pkg.sport.slug) || ids.has(pkg.sport.id)) throw new Error(`Doppelte Sport-ID oder doppelter Slug: ${entry.file}`);
  pkg.sport.disciplines.forEach((discipline) =>
    validateAgeBands(discipline.ageBands, `${entry.file}/${discipline.name}`),
  );
  slugs.add(pkg.sport.slug);
  ids.add(pkg.sport.id);
}
const unlisted = (await readdir(directory)).filter((file) => file.endsWith(".json") && file !== "manifest.json" && !files.has(file));
if (unlisted.length) console.warn(`Nicht im Manifest aufgeführt: ${unlisted.join(", ")}`);
console.log(`${files.size} Standardsportarten validiert.`);
