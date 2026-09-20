import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync, spawn } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const root = await mkdtemp(join(tmpdir(), "sift-clean-install-"));
const manifest = JSON.parse(await readFile("package.json", "utf8"));
const packageManager = process.env.npm_execpath;
if (!packageManager) throw new Error("Run with pnpm run verify:package");
let server;
function command(args) {
  const r = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, CI: "true" },
  });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  return r.stdout;
}
try {
  await writeFile(
    join(root, "package.json"),
    '{"name":"sift-install-verification","private":true}',
  );
  command([
    packageManager,
    "add",
    resolve(`artifacts/${manifest.name}-${manifest.version}.tgz`),
    "--ignore-scripts",
  ]);
  const cli = join(root, "node_modules", "sift-local", "dist", "cli.js"),
    db = join(root, "data", "sift.sqlite");
  if (command([cli, "version"]).trim() !== `Sift ${manifest.version}`)
    throw new Error("Wrong installed version");
  const health = JSON.parse(command([cli, "doctor", "--db", db]));
  if (!health.ok) throw new Error("Installed doctor failed");
  // Reserve a dynamically assigned test port, then release it just before launching.
  const { createServer } = await import("node:net");
  const portServer = createServer();
  await new Promise((r) => portServer.listen(0, "127.0.0.1", r));
  const port = portServer.address().port;
  await new Promise((r) => portServer.close(r));
  server = spawn(
    process.execPath,
    [cli, "start", "--db", db, "--port", String(port)],
    { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
  );
  await new Promise((resolve, reject) => {
    let text = "";
    const timeout = setTimeout(
      () => reject(new Error("Installed server startup timed out")),
      15000,
    );
    server.stderr.on("data", (chunk) => {
      text += chunk;
      if (text.includes("is running at")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    server.once("exit", () => {
      clearTimeout(timeout);
      reject(new Error("Installed server exited before startup: " + text));
    });
  });
  const origin = `http://127.0.0.1:${port}`;
  const session = await (await fetch(origin + "/api/session")).json();
  if (!(await (await fetch(origin)).text()).includes("Sift"))
    throw new Error("Packaged UI missing");
  const response = await fetch(origin + "/api/collections", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Sift-Token": session.token,
    },
    body: JSON.stringify({ name: "Installed artifact check" }),
  });
  const collection = await response.json();
  if (!response.ok) throw new Error("Installed management mutation failed");
  const client = new Client({
    name: "sift-packaged-install-check",
    version: "1.0.0",
  });
  try {
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [cli, "mcp", "--db", db, "--collections", collection.id],
        stderr: "pipe",
      }),
    );
    const tools = await client.listTools();
    if (tools.tools.length !== 5) throw new Error("Packaged MCP tools missing");
    const result = await client.callTool({
      name: "list_collections",
      arguments: {},
    });
    if (!result.structuredContent?.ok) throw new Error("Packaged MCP failed");
  } finally {
    await client.close();
  }
  console.log(
    "CLEAN INSTALL PASSED: installed local archive in a fresh temporary project; version, persistent database, doctor, packaged UI, management mutation, real stdio MCP initialization/discovery/listing. No source-checkout runtime dependencies.",
  );
} finally {
  if (server && server.exitCode === null) {
    const exited = new Promise((r) => server.once("exit", r));
    server.kill();
    await exited;
  }
  await rm(root, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 500,
  });
}
