import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const packages = new Map();
const retiredUnicodeUrl = "http://www.unicode.org/utility/trac/browser/";
const unicodeSourceLink = `[${retiredUnicodeUrl}](https://github.com/unicode-org/unicodetools)`;
const linkNote =
  "The retired Unicode source browser link keeps its original visible text and points to the current Unicode tools repository.";
const packageManager = process.env.npm_execpath;
if (!packageManager) throw new Error("Run with pnpm run notices");
const listed = spawnSync(
  process.execPath,
  [packageManager, "list", "--json", "--depth", "Infinity"],
  { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
);
if (listed.status !== 0) throw new Error(listed.stderr || listed.stdout);
const paths = new Set();
function visit(entry) {
  if (entry.path) paths.add(entry.path);
  for (const kind of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
  ])
    for (const dependency of Object.values(entry[kind] || {}))
      visit(dependency);
}
for (const root of JSON.parse(listed.stdout))
  for (const kind of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
  ])
    for (const dependency of Object.values(root[kind] || {})) visit(dependency);
// Follow the installed dependency graph; pnpm's store can retain old versions.
for (const path of paths) {
  try {
    const p = JSON.parse(await readFile(join(path, "package.json"), "utf8"));
    const key = `${p.name}@${p.version}`;
    if (packages.has(key)) continue;
    let licenses = "";
    for (const f of await readdir(path))
      if (/^(license|licence|copying|notice)(\.|$)/i.test(f)) {
        try {
          licenses += `\n${f}\n\n${await readFile(join(path, f), "utf8")}\n`;
        } catch {}
      }
    licenses = licenses.replaceAll(retiredUnicodeUrl, unicodeSourceLink);
    packages.set(
      key,
      `## ${key}\n\nDeclared license: ${JSON.stringify(p.license || p.licenses || "Not declared")}\n\n${licenses || "No root license file found; consult the upstream package for terms."}`,
    );
  } catch {}
}
await writeFile(
  "THIRD_PARTY_NOTICES.md",
  `# Third-party notices\n\nGenerated from the exact installed dependency tree, including development tools. Upstream license text is preserved. This does not license Sift itself; Sift ownership and licensing remain the owner's decision.\n\n${linkNote}\n\n${[
    ...packages.entries(),
  ]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v)
    .join("\n\n")}`,
);
console.log(`Third-party notices: ${packages.size} exact package versions.`);
