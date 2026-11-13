import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Store } from "../src/store.js";
import { Crawler } from "../src/crawler.js";
import { FixtureTransport } from "../tests/fixtures.js";

// This fixture creates a new directory and never accepts an unmarked workspace.
const [phase, directory] = process.argv.slice(2);
if (!directory || !["seed", "upgrade", "rollback"].includes(phase)) throw Error("Expected phase and fresh fixture directory");
const marker = join(directory, "synthetic-sift-runtime-fixture");
const dbPath = join(directory, "fixture.sqlite");
if (phase === "seed") {
  assert.equal(process.versions.node.split(".")[0], "24");
  mkdirSync(directory, { mode: 0o700 });
  writeFileSync(marker, "synthetic-sift-runtime-v1", { flag: "wx" });
  const store = new Store(dbPath);
  try {
    const collection = store.createCollection("Synthetic runtime compatibility");
    const source = store.createSource(collection.id, {
      name: "Synthetic documentation", url: "https://docs.example.com/docs/start", allowed_paths: ["/docs"], version: "1.0",
      limits: { pages: 50, depth: 3, concurrency: 2, retention: 2 },
    });
    const crawler = new Crawler(store, new FixtureTransport());
    await crawler.wait(crawler.start(source.id).id);
    assert.equal(store.search({ collection_id: collection.id, query: "retry delay" }).results.length, 1);
    await store.backup(join(directory, "node24-backup.sqlite"));
    writeFileSync(join(directory, "fixture.json"), JSON.stringify({ collection: collection.id }), { flag: "wx" });
  } finally { store.close(); }
} else {
  assert.equal(process.versions.node.split(".")[0], phase === "upgrade" ? "26" : "24");
  assert.equal(readFileSync(marker, "utf8"), "synthetic-sift-runtime-v1");
  const { collection } = JSON.parse(readFileSync(join(directory, "fixture.json"), "utf8"));
  const store = new Store(dbPath);
  try {
    assert.equal(store.health().ok, true);
    const result = store.search({ collection_id: collection, query: "retry delay" });
    assert.equal(result.results.length, 1);
    assert.match(result.results[0].passage, /500 milliseconds/);
    if (phase === "upgrade") {
      store.createCollection("Synthetic Node 26 write");
      await store.backup(join(directory, "node26-backup.sqlite"));
      const restored = new Store(join(directory, "restored.sqlite"));
      try {
        await restored.restore(join(directory, "node24-backup.sqlite"), "REPLACE ALL DATA");
        assert.equal(restored.search({ collection_id: collection, query: "retry delay" }).results.length, 1);
      } finally { restored.close(); }
    } else {
      assert.ok(store.collections().some((c: { name: string }) => c.name === "Synthetic Node 26 write"));
      const restored = new Store(join(directory, "rollback-restored.sqlite"));
      try {
        await restored.restore(join(directory, "node26-backup.sqlite"), "REPLACE ALL DATA");
        assert.equal(restored.search({ collection_id: collection, query: "retry delay" }).results.length, 1);
      } finally { restored.close(); }
    }
  } finally { store.close(); }
}
console.log(`Synthetic Sift Node compatibility: ${phase} passed`);
