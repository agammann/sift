#!/usr/bin/env node
import { parseArgs } from "node:util";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { Store, dataDirectory } from "./store.js";
import { startServer } from "./server.js";
import { runMcp } from "./mcp.js";
import { writerLock } from "./lock.js";
import { VERSION, safeMessage } from "./model.js";

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      db: { type: "string" },
      port: { type: "string" },
      collections: { type: "string" },
      confirm: { type: "string" },
      help: { type: "boolean" },
      version: { type: "boolean" },
    },
  });
  const command = values.version ? "version" : positionals[0] || "help";
  if (command === "version") {
    console.log(`Sift ${VERSION}`);
    return;
  }
  if (command === "help" || values.help) {
    console.log(
      `Sift ${VERSION} — Clean documentation. Clear sources.\n\nCommands:\n  sift start [--port 4587]\n  sift mcp --collections ID[,ID...]\n  sift doctor\n  sift backup PATH\n  sift restore PATH --confirm "REPLACE ALL DATA"\n  sift version\n\nAll data commands accept --db PATH or SIFT_DATA_DIR. Default: ${dataDirectory()}\nMCP exposes no collections without explicit IDs. Telemetry: none.`,
    );
    return;
  }
  const file = resolve(values.db || join(dataDirectory(), "sift.sqlite"));
  if (command === "mcp") {
    await runMcp(file, values.collections?.split(",").filter(Boolean) || []);
    return;
  }
  if (!["start", "doctor", "backup", "restore"].includes(command))
    throw new Error("Unknown command. Use sift help.");
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const unlock = writerLock(file);
  let store: Store | undefined;
  try {
    store = new Store(file);
    if (command === "start") {
      const port = Number(values.port || 4587);
      if (!Number.isInteger(port) || port < 1 || port > 65535)
        throw new Error("Port must be an integer between 1 and 65535.");
      const app = await startServer(store, {
        port,
        uiDir: join(dirname(fileURLToPath(import.meta.url)), "ui"),
        cli: fileURLToPath(import.meta.url),
      });
      console.error(
        `Sift ${VERSION} is running at ${app.origin}\nData: ${file}\nMCP setup is in the Connect tab. Press Ctrl+C to stop.`,
      );
      let stopping = false;
      const stop = () => {
        if (stopping) return;
        stopping = true;
        void app.close().finally(() => {
          store?.close();
          unlock();
          process.exit(0);
        });
      };
      process.on("SIGINT", stop);
      process.on("SIGTERM", stop);
      return;
    }
    if (command === "doctor")
      console.log(JSON.stringify(store.health(), null, 2));
    if (command === "backup") {
      if (!positionals[1]) throw new Error("Backup path required.");
      console.log(JSON.stringify(await store.backup(positionals[1]), null, 2));
    }
    if (command === "restore") {
      if (!positionals[1]) throw new Error("Restore path required.");
      console.log(
        JSON.stringify(
          await store.restore(positionals[1], values.confirm || ""),
          null,
          2,
        ),
      );
    }
    store.close();
    unlock();
  } catch (e) {
    try {
      store?.close();
    } finally {
      unlock();
    }
    throw e;
  }
}
main().catch((e) => {
  console.error(
    e instanceof Error && !/SQLITE|database|disk/i.test(e.message)
      ? e.message
      : safeMessage(e),
  );
  process.exitCode = 1;
});
