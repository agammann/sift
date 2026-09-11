import http from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve, join, extname } from "node:path";
import { z } from "zod";
import { Store } from "./store.js";
import { Crawler } from "./crawler.js";
import { SiftError, safeMessage, VERSION } from "./model.js";
import { diagnoseMcp } from "./mcp.js";

export async function startServer(
  store: Store,
  options: { port: number; uiDir: string; cli: string },
) {
  const crawler = new Crawler(store),
    token = randomBytes(32).toString("hex");
  store.recover();
  let origin = "",
    restoring = false;
  const server = http.createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'none'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    const send = (value: unknown, status = 200) => {
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(value));
    };
    try {
      if (req.headers.host !== new URL(origin).host)
        throw new SiftError("host", "Invalid Host header.", 403);
      if (req.headers.origin && req.headers.origin !== origin)
        throw new SiftError(
          "origin",
          "Cross-origin requests are blocked.",
          403,
        );
      if (req.headers["sec-fetch-site"] === "cross-site")
        throw new SiftError("origin", "Cross-site requests are blocked.", 403);
      const u = new URL(req.url || "/", origin),
        path = u.pathname;
      let body: any = {};
      if (!["GET", "HEAD"].includes(req.method || "")) {
        if (restoring)
          throw new SiftError(
            "restoring",
            "A restore is in progress. Retry after it completes.",
            409,
          );
        const supplied = Buffer.from(String(req.headers["x-sift-token"] || ""));
        if (
          supplied.length !== token.length ||
          !timingSafeEqual(supplied, Buffer.from(token))
        )
          throw new SiftError(
            "csrf",
            "Missing or invalid local session token. Reload Sift.",
            403,
          );
        if (!/^application\/json(;|$)/.test(req.headers["content-type"] || ""))
          throw new SiftError(
            "content_type",
            "JSON content type required.",
            415,
          );
        let raw = "",
          size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 65536)
            throw new SiftError("body_limit", "Request exceeds 64 KB.", 413);
          raw += chunk.toString();
        }
        body = raw ? JSON.parse(raw) : {};
      }
      if (path === "/api/session" && req.method === "GET")
        return send({ token, version: VERSION, health: store.health() });
      if (path === "/api/collections" && req.method === "GET")
        return send({ collections: store.collections() });
      if (path === "/api/collections" && req.method === "POST")
        return send(store.createCollection(body.name), 201);
      const c = path.match(
        /^\/api\/collections\/([\w-]+)(?:\/(sources|profile|changes|search|diagnostics))?$/,
      );
      if (c) {
        const cid = z.string().uuid().parse(c[1]);
        store.collection(cid);
        if (!c[2] && req.method === "DELETE") {
          if (body.confirm !== cid)
            throw new SiftError(
              "confirmation",
              "Collection ID confirmation required.",
            );
          store.deleteCollection(cid);
          return send({ deleted: true });
        }
        if (c[2] === "sources" && req.method === "GET")
          return send({ sources: store.sources(cid) });
        if (c[2] === "sources" && req.method === "POST")
          return send(store.createSource(cid, body), 201);
        if (c[2] === "profile" && req.method === "GET")
          return send(store.profile(cid));
        if (c[2] === "changes" && req.method === "GET")
          return send(
            store.changes({
              collection_id: cid,
              cursor: u.searchParams.get("cursor") || undefined,
            }),
          );
        if (c[2] === "search" && req.method === "GET")
          return send(
            store.search({
              collection_id: cid,
              query: u.searchParams.get("q") || "",
              source_id: u.searchParams.get("source_id") || undefined,
              version: u.searchParams.get("version") || undefined,
              cursor: u.searchParams.get("cursor") || undefined,
            }),
          );
        if (c[2] === "diagnostics" && req.method === "POST")
          return send(await diagnoseMcp(store.file, [cid], options.cli));
      }
      const s = path.match(
        /^\/api\/sources\/([\w-]+)(?:\/(refresh|documents|jobs))?$/,
      );
      if (s) {
        const sid = z.string().uuid().parse(s[1]);
        store.source(sid);
        if (!s[2] && req.method === "DELETE") {
          if (body.confirm !== sid)
            throw new SiftError(
              "confirmation",
              "Source ID confirmation required.",
            );
          store.deleteSource(sid);
          return send({ deleted: true });
        }
        if (s[2] === "refresh" && req.method === "POST")
          return send(crawler.start(sid), 202);
        if (s[2] === "documents" && req.method === "GET")
          return send({ documents: store.documents(sid) });
        if (s[2] === "jobs" && req.method === "GET")
          return send({
            jobs: store.all(
              "SELECT * FROM jobs WHERE source_id=? ORDER BY started_at DESC LIMIT 20",
              sid,
            ),
          });
      }
      const j = path.match(/^\/api\/jobs\/([\w-]+)(?:\/(cancel))?$/);
      if (j) {
        if (j[2] === "cancel" && req.method === "POST")
          return send(crawler.cancel(j[1]));
        if (!j[2] && req.method === "GET")
          return send({
            job: store.get("SELECT * FROM jobs WHERE id=?", j[1]),
            outcomes: store.all(
              "SELECT * FROM outcomes WHERE job_id=? ORDER BY id LIMIT 2100",
              j[1],
            ),
          });
      }
      if (path === "/api/document" && req.method === "GET")
        return send(
          store.read({
            collection_id: u.searchParams.get("collection_id") || "",
            document_id: u.searchParams.get("document_id") || "",
            revision_id: u.searchParams.get("revision_id") || undefined,
            cursor: u.searchParams.get("cursor") || undefined,
            max_chars: 20000,
          }),
        );
      if (path === "/api/backup" && req.method === "POST")
        return send(
          await store.backup(
            join(
              resolve(store.file, ".."),
              "backups",
              `sift-${Date.now()}.sqlite`,
            ),
          ),
        );
      if (path === "/api/restore" && req.method === "POST") {
        restoring = true;
        try {
          return send(
            await store.restore(
              z.string().min(1).max(4096).parse(body.path),
              body.confirm,
            ),
          );
        } finally {
          restoring = false;
        }
      }
      if (path.startsWith("/api/"))
        throw new SiftError("not_found", "Endpoint not found.", 404);
      if (req.method !== "GET" && req.method !== "HEAD")
        throw new SiftError("method", "Method not allowed.", 405);
      const root = resolve(options.uiDir),
        file = resolve(
          root,
          `.${decodeURIComponent(path === "/" ? "/index.html" : path)}`,
        );
      if (!file.startsWith(`${root}\\`) && !file.startsWith(`${root}/`))
        throw new SiftError("path", "Invalid path.", 403);
      if (!existsSync(file))
        throw new SiftError(
          "not_found",
          "File not found. Build the interface before starting Sift.",
          404,
        );
      res.setHeader(
        "Content-Type",
        (
          {
            ".html": "text/html; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".svg": "image/svg+xml",
          } as any
        )[extname(file)] || "application/octet-stream",
      );
      res.end(readFileSync(file));
    } catch (e) {
      send(
        {
          error: {
            code:
              e instanceof SiftError
                ? e.code
                : e instanceof z.ZodError
                  ? "invalid_request"
                  : "internal_error",
            message: safeMessage(e),
          },
        },
        e instanceof SiftError
          ? e.status
          : e instanceof z.ZodError || e instanceof SyntaxError
            ? 400
            : 500,
      );
    }
  });
  server.requestTimeout = 20000;
  server.headersTimeout = 10000;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, "127.0.0.1", resolve);
  });
  origin = `http://127.0.0.1:${(server.address() as any).port}`;
  return {
    server,
    origin,
    async close() {
      await crawler.stop();
      await new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      );
    },
  };
}
