import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const directory = resolve("public/sports");
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8"));
if (!manifest || !Array.isArray(manifest.sports)) throw new Error("Ungültiges public/sports/manifest.json.");

const files = new Set();
const slugs = new Set();
const ids = new Set();
for (const entry of manifest.sports) {
  if (!entry?.file?.endsWith(".json") || !entry.version) throw new Error("Jeder Manifesteintrag benötigt JSON-Datei und Version.");
  if (files.has(entry.file)) throw new Error(`Doppelte Manifestdatei: ${entry.file}`);
  files.add(entry.file);
  const pkg = JSON.parse(await readFile(resolve(directory, entry.file), "utf8"));
  if (![1, 2].includes(pkg.schemaVersion) || !pkg.sport || !Array.isArray(pkg.sport.disciplines)) throw new Error(`Ungültiges Sportpaket: ${entry.file}`);
  if (slugs.has(pkg.sport.slug) || ids.has(pkg.sport.id)) throw new Error(`Doppelte Sport-ID oder doppelter Slug: ${entry.file}`);
  slugs.add(pkg.sport.slug);
  ids.add(pkg.sport.id);
}
const unlisted = (await readdir(directory)).filter((file) => file.endsWith(".json") && file !== "manifest.json" && !files.has(file));
if (unlisted.length) console.warn(`Nicht im Manifest aufgeführt: ${unlisted.join(", ")}`);
console.log(`${files.size} Standardsportarten validiert.`);
