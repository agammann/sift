import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
const packages = new Map();
const retiredUnicodeUrl = "http://www.unicode.org/utility/trac/browser/";
const unicodeSourceLink = `[${retiredUnicodeUrl}](https://github.com/unicode-org/unicodetools)`;
const linkNote = "The retired Unicode source browser link keeps its original visible text and points to the current Unicode tools repository.";
for (const item of await readdir("node_modules/.pnpm")) {
  const root = join("node_modules/.pnpm", item, "node_modules");
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    continue;
  }
  const dirs = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name.startsWith("@")) {
      for (const s of await readdir(join(root, e.name)))
        dirs.push(join(root, e.name, s));
    } else dirs.push(join(root, e.name));
  }
  for (const path of dirs) {
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
