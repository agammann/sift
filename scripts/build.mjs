import { build as bundle } from "esbuild";
import { build as ui } from "vite";
import { mkdir, copyFile } from "node:fs/promises";
await mkdir("dist", { recursive: true });
await bundle({
  entryPoints: ["src/cli.ts"],
  outfile: "dist/cli.js",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  sourcemap: true,
});
await ui();
