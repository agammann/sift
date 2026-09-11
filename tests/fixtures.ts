import { readFileSync } from "node:fs";
import type { Transport, FetchResponse } from "../src/network.js";
export class FixtureTransport implements Transport {
  phase: "initial" | "changed" | "failed" | "removed" | "conditional" =
    "initial";
  delay = 0;
  requests: { url: string; headers?: Record<string, string> }[] = [];
  async fetch(
    url: string,
    options: {
      signal: AbortSignal;
      headers?: Record<string, string>;
      allowed: (url: string) => boolean;
    },
  ): Promise<FetchResponse> {
    if (!options.allowed(url)) throw new Error("Fixture scope rejected");
    this.requests.push({ url, headers: options.headers });
    if (this.delay)
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, this.delay);
        options.signal.addEventListener(
          "abort",
          () => {
            clearTimeout(t);
            reject(new Error("aborted"));
          },
          { once: true },
        );
      });
    options.signal.throwIfAborted();
    const path = new URL(url).pathname;
    const response = (status: number, body: string, type = "text/html") => ({
      status,
      body,
      url,
      headers: {
        "content-type": type,
        etag: '"fixture-etag"',
        "last-modified": "Mon, 01 Jun 2026 00:00:00 GMT",
      },
    });
    if (path === "/robots.txt")
      return response(
        200,
        "User-agent: *\nDisallow: /docs/private\nSitemap: https://docs.example.com/sitemap.xml",
        "text/plain",
      );
    if (path === "/sitemap.xml")
      return response(
        200,
        "<urlset><url><loc>https://docs.example.com/docs/start</loc></url><url><loc>https://docs.example.com/docs/alias</loc></url><url><loc>https://docs.example.com/docs/removal</loc></url></urlset>",
        "application/xml",
      );
    if (path === "/docs/removal")
      return this.phase === "removed"
        ? response(410, "Gone")
        : response(
            200,
            "<main><h1>Legacy support</h1><p>The legacy adapter supports migration through the compatibility bridge.</p></main>",
          );
    if (
      path === "/docs/start" ||
      path === "/docs/alias" ||
      path === "/v2/start"
    ) {
      if (this.phase === "failed") return response(503, "Service unavailable");
      if (this.phase === "conditional" && options.headers?.["If-None-Match"])
        return response(304, "");
      let html = readFileSync(
        new URL("./fixtures/document.html", import.meta.url),
        "utf8",
      );
      if (this.phase === "changed")
        html = html.replace("500 milliseconds", "750 milliseconds");
      if (path === "/v2/start")
        html = html.replace("500 milliseconds", "900 milliseconds");
      return response(200, html);
    }
    return response(404, "Not found");
  }
}
