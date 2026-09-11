import { mkdtemp, cp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
const p = JSON.parse(await readFile("package.json", "utf8"));
const stage = await mkdtemp(join(tmpdir(), "sift-release-"));
try {
  const root = join(stage, "package");
  await mkdir(root);
  for (const file of [
    "dist",
    "migrations",
    "README.md",
    "docs",
    "examples",
    "CHANGELOG.md",
    "THIRD_PARTY_NOTICES.md",
  ])
    await cp(file, join(root, file), { recursive: true });
  // Bundled runtime has zero npm dependencies and requires no install scripts.
  await writeFile(
    join(root, "package.json"),
    JSON.stringify(
      {
        name: p.name,
        version: p.version,
        description: p.description,
        type: "module",
        private: true,
        license: p.license,
        engines: p.engines,
        bin: p.bin,
        files: p.files,
      },
      null,
      2,
    ) + "\n",
  );
  await mkdir("artifacts", { recursive: true });
  const artifact = resolve("artifacts", `${p.name}-${p.version}.tgz`);
  const tar = spawnSync("tar", ["-czf", artifact, "-C", stage, "package"], {
    encoding: "utf8",
  });
  if (tar.status !== 0) throw new Error(tar.stderr || "tar failed");
  const hash = createHash("sha256")
    .update(await readFile(artifact))
    .digest("hex");
  await writeFile(
    `${artifact}.sha256`,
    `${hash}  ${p.name}-${p.version}.tgz\n`,
  );
  console.log(artifact);
  console.log(`SHA-256 ${hash}`);
} finally {
  await rm(stage, { recursive: true, force: true });
}
