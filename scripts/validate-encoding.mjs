import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const roots = ["src", "public", "tests"];
const textExtensions = new Set([".css", ".html", ".json", ".md", ".mjs", ".svg", ".ts", ".tsx"]);
const mojibake = /Ã|Â|â€¦|â€“|âˆ’|�/u;
const errors = [];

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? filesBelow(path) : [path];
      }),
    )
  ).flat();
}

for (const directory of roots) {
  for (const file of await filesBelow(join(root, directory))) {
    if (!textExtensions.has(extname(file))) continue;
    const content = await readFile(file, "utf8");
    if (mojibake.test(content))
      errors.push(`Möglicher Kodierungsfehler: ${relative(root, file)}`);
  }
}

if (errors.length) throw new Error(errors.join("\n"));
console.log("UTF-8-Kodierung validiert.");
