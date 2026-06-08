import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const sourceRoot = join(root, "src");
const forbiddenRootModules = [
  "pages.tsx",
  "scoring.ts",
  "chartUtils.ts",
  "tableImport.ts",
  "tableGenerator.ts",
  "exchange.ts",
  "standardCatalog.ts",
  "db.ts",
];

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? filesBelow(join(directory, entry.name))
          : [join(directory, entry.name)],
      ),
    )
  ).flat();
}

const files = await filesBelow(sourceRoot);
const errors = [];

for (const name of forbiddenRootModules) {
  if (files.includes(join(sourceRoot, name)))
    errors.push(`Veraltetes Sammelmodul vorhanden: src/${name}`);
}

for (const file of files) {
  const path = relative(root, file).replaceAll("\\", "/");
  if (/\.test\.[jt]sx?$/.test(path))
    errors.push(`Testdatei liegt unter src/: ${path}`);
  if (
    path.startsWith("src/features/") &&
    [".ts", ".tsx"].includes(extname(file))
  ) {
    const content = await readFile(file, "utf8");
    if (/from ["']@\/infrastructure\/database/.test(content))
      errors.push(`Feature importiert Datenbank direkt: ${path}`);
  }
  if (
    /^(src\/features\/|src\/shared\/components\/|src\/infrastructure\/repositories\/)/.test(path) &&
    [".ts", ".tsx"].includes(extname(file)) &&
    !path.endsWith("/index.ts")
  ) {
    const content = await readFile(file, "utf8");
    const exports = content.match(/^export (?:default )?(?:async )?(?:function|const|class) /gm) ?? [];
    if (exports.length > 1)
      errors.push(`Mehr als ein öffentlicher Runtime-Hauptexport: ${path}`);
  }
}

if (errors.length) throw new Error(errors.join("\n"));
console.log("Projektstruktur validiert.");
