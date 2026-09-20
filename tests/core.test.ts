import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Store, migrate, validateBackup } from "../src/store.js";
import { Crawler } from "../src/crawler.js";
import {
  normalizeUrl,
  inScope,
  publicAddress,
  PublicTransport,
} from "../src/network.js";
import { extract, chunkMarkdown } from "../src/extract.js";
import { FixtureTransport } from "./fixtures.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { startServer } from "../src/server.js";
import { writerLock } from "../src/lock.js";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import http from "node:http";
import { Markdown, HeadingLabel } from "../ui/components.js";
import { Connect } from "../ui/Settings.js";
import { load } from "cheerio";

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "sift-test-")),
    store = new Store(join(dir, "sift.sqlite")),
    fixture = new FixtureTransport(),
    crawler = new Crawler(store, fixture);
  const c = store.createCollection("Fixture project");
  const source = store.createSource(c.id, {
    name: "Example v1",
    url: "https://docs.example.com/docs/start",
    allowed_paths: ["/docs"],
    version: "1.0",
    limits: { pages: 50, depth: 3, concurrency: 2, retention: 2 },
  });
  return {
    dir,
    store,
    fixture,
    crawler,
    c,
    source,
    close() {
      store.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
test("oversized source headings cannot amplify stored or rebuilt indexes", () => {
  const t = setup();
  try {
    const html = `<main><h1>${"heading ".repeat(125000)}</h1>${`<p>${"documentation ".repeat(72)}</p>`.repeat(900)}</main>`;
    assert.ok(Buffer.byteLength(html) < 2 * 1024 * 1024);
    const page = extract(html, t.source.url, t.source);
    assert.ok(page.headings[0].length > 900000);
    assert.ok(page.warnings.some((w) => w.includes("512 characters")));
    assert.ok(
      page.chunks.every(
        (c) => c.heading.length <= 512 && c.passage.length <= 16000,
      ),
    );
    t.store.savePage(t.source, t.source.url, page, {});
    const check = () => {
      const rows = t.store.all("SELECT title,heading,passage FROM chunks");
      assert.ok(rows.length > 400 && rows.length <= 2048);
      assert.ok(
        rows.every((c) => c.heading.length <= 512 && c.passage.length <= 16000),
      );
      const bytes = rows.reduce(
        (sum, c) => sum + Buffer.byteLength(c.title + c.heading + c.passage),
        0,
      );
      assert.ok(bytes <= 4 * 1024 * 1024);
      return bytes;
    };
    const before = check();
    t.store.transaction(() => t.store.reindexSource(t.source.id));
    assert.equal(check(), before);
    assert.equal(
      t.store.get("SELECT content FROM revisions").content,
      page.content,
    );
    assert.ok(
      t.store.search({
        collection_id: t.c.id,
        query: "documentation",
        limit: 1,
      }).results[0].heading.length <= 512,
    );
  } finally {
    t.close();
  }
});
test("indexed text budgets include repeated metadata and preserve full input", () => {
  const warnings: string[] = [];
  const title = "界".repeat(1000);
  const content = "# Section\n\nText.\n\n".repeat(3000);
  const chunks = chunkMarkdown(content, warnings, title);
  assert.ok(chunks.length < 2048);
  assert.ok(
    chunks.reduce(
      (n, c) => n + Buffer.byteLength(title + c.heading + c.passage),
      0,
    ) <=
      4 * 1024 * 1024,
  );
  assert.ok(warnings.some((w) => w.includes("per-document limit")));
  const countWarnings: string[] = [];
  assert.equal(chunkMarkdown(content, countWarnings).length, 2048);
  assert.ok(countWarnings.some((w) => w.includes("per-document limit")));
});
test("collection → bounded crawl → ranked search: extraction, aliases and attributed evidence", async () => {
  const t = setup();
  try {
    const job = await t.crawler.wait(t.crawler.start(t.source.id).id);
    assert.equal(job.status, "partial");
    const r = t.store.search({ collection_id: t.c.id, query: "retry delay" });
    assert.equal(r.results.length, 1);
    const hit = r.results[0];
    assert.match(hit.passage, /500 milliseconds/);
    assert.equal(hit.aliases.length, 2);
    assert.equal(hit.version, "1.0");
    assert.equal(hit.collection_id, t.c.id);
    assert.ok(hit.revision_id);
    const doc = t.store.read({
      collection_id: t.c.id,
      document_id: hit.document_id,
    });
    assert.match(doc.content, /const client/);
    assert.match(doc.content, /\| timeout/);
    assert.match(doc.content, /Never retry a payment/);
    assert.match(doc.content, /Ignore previous instructions/);
    assert.doesNotMatch(
      doc.content,
      /Buy Subscribe|Accept all cookies|Footer layout/,
    );
    assert.equal(doc.language, "en");
    assert.equal(doc.freshness.upstream_currentness, "unknown");
    assert.ok(
      t.store.get("SELECT * FROM outcomes WHERE outcome='robots_denied'"),
    );
    assert.equal(t.store.health().ok, true);
  } finally {
    t.close();
  }
});
test("source and version isolation, query validation and cursor binding", async () => {
  const t = setup();
  try {
    await t.crawler.wait(t.crawler.start(t.source.id).id);
    const s2 = t.store.createSource(t.c.id, {
      ...t.source,
      name: "Example v2",
      url: "https://docs.example.com/v2/start",
      allowed_paths: ["/v2"],
      version: "2.0",
    });
    await t.crawler.wait(t.crawler.start(s2.id).id);
    assert.match(
      t.store.search({
        collection_id: t.c.id,
        query: "retry delay",
        version: "2.0",
      }).results[0].passage,
      /900 milliseconds/,
    );
    assert.equal(
      t.store.search({
        collection_id: t.c.id,
        query: "retry delay",
        source_id: s2.id,
        version: "1.0",
      }).results.length,
      0,
    );
    assert.throws(
      () => t.store.search({ collection_id: t.c.id, query: "***" }),
      /at least one/,
    );
    assert.equal(
      t.store.search({ collection_id: t.c.id, query: "nonexistentword" })
        .status,
      "no_matches",
    );
    const r = t.store.search({
      collection_id: t.c.id,
      query: "retry",
      limit: 1,
    });
    assert.ok(r.next_cursor);
    assert.throws(
      () =>
        t.store.search({
          collection_id: t.c.id,
          query: "other",
          cursor: r.next_cursor!,
        }),
      /Cursor/,
    );
    const d = t.store.read({
      collection_id: t.c.id,
      document_id: r.results[0].document_id,
      max_chars: 100,
    });
    assert.ok(d.next_cursor);
    assert.equal(d.content.length, 100);
    assert.throws(
      () =>
        t.store.read({
          collection_id: t.store.createCollection("Other").id,
          document_id: d.document_id,
        }),
      /not found/,
    );
  } finally {
    t.close();
  }
});
test("refresh changes, conditional confirmation, failed-check preservation, removal and bounded revisions", async () => {
  const t = setup();
  try {
    await t.crawler.wait(t.crawler.start(t.source.id).id);
    const first = t.store.search({
      collection_id: t.c.id,
      query: "retry delay",
    }).results[0];
    t.fixture.phase = "changed";
    await t.crawler.wait(t.crawler.start(t.source.id).id);
    const changed = t.store.search({
      collection_id: t.c.id,
      query: "retry delay",
    }).results[0];
    assert.notEqual(first.revision_id, changed.revision_id);
    assert.match(changed.passage, /750 milliseconds/);
    assert.match(
      t.store.read({
        collection_id: t.c.id,
        document_id: first.document_id,
        revision_id: first.revision_id,
      }).content,
      /500 milliseconds/,
    );
    t.fixture.phase = "conditional";
    await t.crawler.wait(t.crawler.start(t.source.id).id);
    assert.equal(
      t.store.search({ collection_id: t.c.id, query: "retry delay" }).results[0]
        .revision_id,
      changed.revision_id,
    );
    const checked = t.store.search({
      collection_id: t.c.id,
      query: "retry delay",
    }).results[0];
    t.fixture.phase = "failed";
    await t.crawler.wait(t.crawler.start(t.source.id).id);
    const failed = t.store.search({
      collection_id: t.c.id,
      query: "retry delay",
    }).results[0];
    assert.equal(failed.revision_id, changed.revision_id);
    assert.match(failed.freshness.warning, /failed/);
    assert.equal(failed.last_success, checked.last_success);
    assert.notEqual(failed.last_checked, checked.last_checked);
    t.fixture.phase = "removed";
    await t.crawler.wait(t.crawler.start(t.source.id).id);
    assert.equal(
      t.store.search({ collection_id: t.c.id, query: "compatibility bridge" })
        .results.length,
      0,
    );
    assert.ok(
      t.store
        .changes({ collection_id: t.c.id })
        .changes.some((c) => c.kind === "confirmed_unavailable"),
    );
    assert.ok(
      t.store
        .all(
          "SELECT document_id,count(*) n FROM revisions GROUP BY document_id",
        )
        .every((r) => r.n <= 2),
    );
  } finally {
    t.close();
  }
});
test("cancellation, overlap prevention, writer exclusion and interrupted job recovery", async () => {
  const t = setup();
  try {
    t.fixture.delay = 100;
    const j = t.crawler.start(t.source.id);
    assert.throws(() => t.crawler.start(t.source.id), /active refresh/);
    t.crawler.cancel(j.id);
    assert.equal((await t.crawler.wait(j.id)).status, "cancelled");
    t.store.run(
      "INSERT INTO jobs(id,source_id,status,started_at) VALUES('interrupted-job',?,'running','2026-01-01T00:00:00Z')",
      t.source.id,
    );
    assert.equal(t.store.recover(), 1);
    assert.equal(
      t.store.get("SELECT status FROM jobs WHERE id='interrupted-job'").status,
      "interrupted",
    );
    const unlock = writerLock(t.store.file);
    assert.throws(() => writerLock(t.store.file), /Another Sift/);
    unlock();
  } finally {
    t.close();
  }
});
test("SSRF: address classes, normalized traps, scope and real production transport rejection", async () => {
  for (const ip of [
    "127.0.0.1",
    "0.0.0.0",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "192.0.2.1",
    "198.51.100.2",
    "203.0.113.1",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "fc00::1",
    "fe80::1",
    "ff00::1",
    "2001:db8::1",
    "::ffff:127.0.0.1",
  ])
    assert.equal(publicAddress(ip), false, ip);
  assert.equal(publicAddress("93.184.215.14"), true);
  assert.equal(publicAddress("2606:4700:4700::1111"), true);
  for (const url of [
    "file:///etc/passwd",
    "http://user:secret@example.com/",
    "http://2130706433/",
    "http://0x7f000001/",
    "http://[::1]/",
    "http://localhost/",
  ])
    assert.throws(() => normalizeUrl(url));
  assert.equal(
    normalizeUrl("https://example.com/docs?x=1&utm_source=a#anchor"),
    "https://example.com/docs?x=1",
  );
  const scope = { origin: "https://example.com", allowed_paths: ["/docs"] };
  for (const url of [
    "https://evil.example/docs",
    "https://example.com/docsevil",
    "https://example.com/docs/%2f..",
    "https://example.com/docs/%252e",
  ])
    assert.equal(inScope(url, scope), false);
  await assert.rejects(
    new PublicTransport().fetch("http://127.0.0.1/", {
      signal: AbortSignal.timeout(1000),
      allowed: () => true,
    }),
    /blocked/,
  );
});
test("safe Markdown renders no scripts, unsafe links, raw HTML or remote images", () => {
  const html = renderToStaticMarkup(
    createElement(Markdown, {
      text: '<script>alert(1)</script>\n\n[unsafe](javascript:alert%281%29)\n\n![track](https://example.com/image.png)\n\n[good](https://example.com/docs)\n\n<iframe src="https://evil.example"></iframe>',
    }),
  );
  assert.doesNotMatch(html, /<script|<iframe|<img|href="javascript:/);
  assert.match(html, /href="https:\/\/example.com\/docs"/);
});
test("SQLite-safe backup/restore, confirmation, invalid backup rejection and rollback", async () => {
  const t = setup();
  try {
    await t.crawler.wait(t.crawler.start(t.source.id).id);
    const file = join(t.dir, "backup.sqlite");
    assert.equal((await t.store.backup(file)).valid, true);
    await assert.rejects(t.store.backup(file), /never overwritten/);
    t.store.createCollection("Later");
    await assert.rejects(t.store.restore(file, "yes"), /REPLACE ALL DATA/);
    assert.equal(t.store.collections().length, 2);
    assert.equal(
      (await t.store.restore(file, "REPLACE ALL DATA")).restored,
      true,
    );
    assert.equal(t.store.collections().length, 1);
    assert.equal(
      t.store.search({ collection_id: t.c.id, query: "retry delay" }).results
        .length,
      1,
    );
    const bad = join(t.dir, "bad.sqlite");
    writeFileSync(bad, "not a database");
    await assert.rejects(t.store.restore(bad, "REPLACE ALL DATA"));
    assert.equal(t.store.collections().length, 1);
    assert.throws(
      () =>
        t.store.transaction(() => {
          t.store.run("DELETE FROM collections");
          throw new Error("simulated write failure");
        }),
      /simulated/,
    );
    assert.equal(t.store.collections().length, 1);
  } finally {
    t.close();
  }
});
test("migration backup and rollback, newer schema is never modified", () => {
  const dir = mkdtempSync(join(tmpdir(), "sift-migration-"));
  try {
    const file = join(dir, "older.sqlite"),
      db = new DatabaseSync(file);
    db.exec(
      "CREATE TABLE sentinel(value TEXT); INSERT INTO sentinel VALUES('keep')",
    );
    assert.throws(
      () => migrate(db, file, "CREATE TABLE attempted(x); INVALID SQL;"),
      /rolled back/,
    );
    assert.equal(
      (db.prepare("SELECT value FROM sentinel").get() as any).value,
      "keep",
    );
    assert.equal(
      db.prepare("SELECT name FROM sqlite_master WHERE name='attempted'").get(),
      undefined,
    );
    db.exec("PRAGMA user_version=99");
    db.close();
    const before = readFileSync(file);
    assert.throws(() => new Store(file), /newer/);
    assert.deepEqual(readFileSync(file), before);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("real stdio MCP initialization, tool discovery, search/retrieval and every-tool collection authorization", async () => {
  const t = setup();
  let client: Client | undefined;
  try {
    await t.crawler.wait(t.crawler.start(t.source.id).id);
    const hidden = t.store.createCollection("Hidden");
    client = new Client({ name: "sift-integration-test", version: "1.0.0" });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [
        resolve("dist/cli.js"),
        "mcp",
        "--db",
        t.store.file,
        "--collections",
        t.c.id,
      ],
      stderr: "pipe",
    });
    await client.connect(transport);
    const tools = await client.listTools();
    assert.deepEqual(tools.tools.map((x) => x.name).sort(), [
      "get_collection_profile",
      "list_changes",
      "list_collections",
      "read_document",
      "search_docs",
    ]);
    assert.ok(tools.tools.every((x) => x.annotations?.readOnlyHint));
    const list: any = (
      await client.callTool({ name: "list_collections", arguments: {} })
    ).structuredContent;
    assert.equal(list.data.collections.length, 1);
    const search: any = (
      await client.callTool({
        name: "search_docs",
        arguments: { collection_id: t.c.id, query: "retry delay" },
      })
    ).structuredContent;
    assert.equal(search.ok, true);
    const hit = search.data.results[0];
    const read: any = (
      await client.callTool({
        name: "read_document",
        arguments: { collection_id: t.c.id, document_id: hit.document_id },
      })
    ).structuredContent;
    assert.match(read.data.content, /500 milliseconds/);
    for (const name of [
      "get_collection_profile",
      "search_docs",
      "read_document",
      "list_changes",
    ]) {
      const r: any = await client.callTool({
        name,
        arguments: {
          collection_id: hidden.id,
          ...(name === "search_docs" ? { query: "retry" } : {}),
          ...(name === "read_document" ? { document_id: hit.document_id } : {}),
        },
      });
      assert.equal(r.isError, true);
      assert.equal(r.structuredContent.error.code, "forbidden_collection");
    }
    const invalid = await client.callTool({
      name: "search_docs",
      arguments: { collection_id: t.c.id, query: "", limit: 999 },
    });
    assert.equal(invalid.isError, true);
  } finally {
    await client?.close();
    t.close();
  }
});
test("local HTTP origin/host/CSRF enforcement and complete management endpoints", async () => {
  const t = setup();
  const app = await startServer(t.store, {
    port: 0,
    uiDir: resolve("dist/ui"),
    cli: resolve("dist/cli.js"),
  });
  try {
    const wrongHost = await new Promise<number>((resolve, reject) => {
      http
        .get(app.origin, { headers: { Host: "evil.example" } }, (r) => {
          r.resume();
          resolve(r.statusCode!);
        })
        .on("error", reject);
    });
    assert.equal(wrongHost, 403);
    assert.equal(
      (
        await fetch(app.origin + "/api/session", {
          headers: { Origin: "https://evil.example" },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(app.origin + "/api/collections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: '{"name":"blocked"}',
        })
      ).status,
      403,
    );
    const session: any = await (
      await fetch(app.origin + "/api/session")
    ).json();
    const res = await fetch(app.origin + "/api/collections", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sift-Token": session.token,
      },
      body: '{"name":"UI created"}',
    });
    assert.equal(res.status, 201);
    assert.match(await (await fetch(app.origin)).text(), /Sift/);
  } finally {
    await app.close();
    t.close();
  }
});
test("copied Connect configuration launches without PATH and targets the selected workspace", async () => {
  const t = setup();
  const app = await startServer(t.store, {
    port: 0,
    uiDir: resolve("dist/ui"),
    cli: resolve("dist/cli.js"),
  });
  const client = new Client({ name: "copied-config-check", version: "1.0.0" });
  try {
    await t.crawler.wait(t.crawler.start(t.source.id).id);
    const session: any = await (
      await fetch(app.origin + "/api/session")
    ).json();
    const html = renderToStaticMarkup(
      createElement(Connect, {
        cid: t.c.id,
        launch: session.mcpLaunch,
        act: async (fn: () => Promise<any>) => {
          await fn();
        },
      }),
    );
    const config = JSON.parse(load(html)("pre").first().text()).mcpServers.sift;
    await client.connect(
      new StdioClientTransport({
        ...config,
        cwd: t.dir,
        env: { PATH: "" },
        stderr: "pipe",
      }),
    );
    const result: any = await client.callTool({
      name: "search_docs",
      arguments: { collection_id: t.c.id, query: "retry delay" },
    });
    assert.equal(result.structuredContent.ok, true);
    assert.ok(
      result.structuredContent.data.results.some(
        (r: any) => r.source_id === t.source.id,
      ),
    );
  } finally {
    await client.close();
    await app.close();
    t.close();
  }
});

test("search heading labels render Markdown inline without interactive or unsafe elements", () => {
  const html = renderToStaticMarkup(
    createElement(
      "button",
      null,
      createElement(HeadingLabel, {
        text: '2\\. Using `python` [¶](https://docs.example.com/#heading "Link") ![image](https://example.com/x.png) <script>alert(1)</script>',
      }),
    ),
  );
  assert.match(html, /2\. Using/);
  assert.match(html, /<code>python<\/code>/);
  assert.doesNotMatch(html, /<a\b|<img\b|<script\b|<p\b|https:\/\/|\]\(/);
});

test("retrieval benchmark: expected passages and source labels (original fixtures)", async () => {
  const t = setup();
  try {
    await t.crawler.wait(t.crawler.start(t.source.id).id);
    const cases = [
      ["retry delay", "500 milliseconds"],
      ["idempotency key", "Never retry a payment"],
      ["client setup", "ExampleClient"],
      ["configuration timeout", "15000"],
      ["compatibility bridge", "legacy adapter"],
    ];
    let passed = 0;
    for (const [query, expected] of cases) {
      const rows = t.store.search({ collection_id: t.c.id, query }).results;
      if (
        rows
          .slice(0, 3)
          .some(
            (r) =>
              r.passage.includes(expected) &&
              r.source_id === t.source.id &&
              r.version === "1.0",
          )
      )
        passed++;
    }
    console.log(
      `RETRIEVAL BENCHMARK: ${passed}/${cases.length} expected passages in top 3; original deterministic fixtures; no comparative claims.`,
    );
    assert.equal(passed, cases.length);
  } finally {
    t.close();
  }
});
