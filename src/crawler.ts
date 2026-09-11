import robotsParser from "robots-parser";
import { load } from "cheerio";
import { Store } from "./store.js";
import {
  PublicTransport,
  normalizeUrl,
  inScope,
  type Transport,
  USER_AGENT,
} from "./network.js";
import { extract } from "./extract.js";
import { id, now, safeMessage, SiftError, type Source } from "./model.js";

export class Crawler {
  private active = new Map<
    string,
    { abort: AbortController; promise: Promise<void> }
  >();
  constructor(
    private store: Store,
    private transport: Transport = new PublicTransport(),
  ) {}
  start(sid: string) {
    const source = this.store.source(sid),
      jid = id();
    if (this.active.size >= 4)
      throw new SiftError(
        "job_limit",
        "At most four sources can refresh at once.",
        409,
      );
    if (
      this.store.get(
        "SELECT id FROM jobs WHERE source_id=? AND status='running'",
        sid,
      )
    )
      throw new SiftError(
        "job_running",
        "This source already has an active refresh.",
        409,
      );
    this.store.transaction(() => {
      this.store.run(
        "INSERT INTO jobs(id,source_id,status,started_at) VALUES(?,?,'running',?)",
        jid,
        sid,
        now(),
      );
      this.store.run("UPDATE sources SET status='running' WHERE id=?", sid);
    });
    const abort = new AbortController();
    const promise = this.collect(source, jid, abort.signal)
      .catch((e) => {
        console.error(
          `Sift could not persist job completion: ${safeMessage(e)} Restart recovery will mark unfinished work interrupted.`,
        );
      })
      .finally(() => this.active.delete(jid));
    this.active.set(jid, { abort, promise });
    return this.store.get("SELECT * FROM jobs WHERE id=?", jid);
  }
  cancel(jid: string) {
    const running = this.active.get(jid);
    if (!running)
      throw new SiftError("not_running", "This job is no longer active.", 409);
    running.abort.abort(new Error("User cancelled"));
    return { cancelling: true };
  }
  async wait(jid: string) {
    await this.active.get(jid)?.promise;
    return this.store.get("SELECT * FROM jobs WHERE id=?", jid);
  }
  async stop() {
    for (const job of this.active.values()) job.abort.abort();
    await Promise.all([...this.active.values()].map((x) => x.promise));
  }
  private async collect(source: Source, jid: string, userSignal: AbortSignal) {
    const signal = AbortSignal.any([
      userSignal,
      AbortSignal.timeout(5 * 60 * 1000),
    ]);
    let successes = 0,
      failures = 0,
      limited = false;
    const queue: { url: string; depth: number }[] = [],
      seen = new Set<string>(),
      variants = new Map<string, number>();
    const add = (url: string, depth: number, explicit = false) => {
      try {
        url = normalizeUrl(url);
      } catch {
        return;
      }
      if (!inScope(url, source) || seen.has(url) || depth > source.limits.depth)
        return;
      if (seen.size >= 2000) {
        limited = true;
        return;
      }
      const u = new URL(url),
        n = variants.get(u.pathname) || 0;
      if (n >= 10) {
        limited = true;
        return;
      }
      if (
        !explicit &&
        /\.(?:pdf|zip|png|jpe?g|gif|webp|svg|mp[34]|woff2?|css|js)$/i.test(
          u.pathname,
        )
      )
        return;
      seen.add(url);
      variants.set(u.pathname, n + 1);
      queue.push({ url, depth });
    };
    try {
      const robotsUrl = `${source.origin}/robots.txt`;
      const robotsResponse = await this.transport.fetch(robotsUrl, {
        signal,
        allowed: (u) => u === robotsUrl,
      });
      if (
        robotsResponse.status !== 404 &&
        (robotsResponse.status < 200 || robotsResponse.status >= 300)
      )
        throw new SiftError(
          "robots_unavailable",
          `robots.txt returned HTTP ${robotsResponse.status}. Collection stopped conservatively.`,
        );
      const robots = (
        robotsParser as unknown as (
          url: string,
          body: string,
        ) => import("robots-parser").Robot
      )(robotsUrl, robotsResponse.status === 404 ? "" : robotsResponse.body);
      const delay =
        robots.getCrawlDelay("Sift") || robots.getCrawlDelay("*") || 0;
      if (delay > 1)
        throw new SiftError(
          "robots_delay",
          `robots.txt requests a ${delay}-second crawl delay. This release supports a 1-second minimum; collection stopped to respect the longer delay.`,
        );
      add(source.url, 0, true);
      // Recheck known URLs even when a new sitemap omits them. Absence never means deletion.
      for (const d of this.store.documents(source.id))
        add(d.original_url, 0, true);
      const sitemaps = [
          ...robots.getSitemaps(),
          `${source.origin}/sitemap.xml`,
        ].slice(0, 5),
        visitedMaps = new Set<string>();
      let sitemapEntries = 0;
      for (let i = 0; i < sitemaps.length && visitedMaps.size < 5; i++) {
        signal.throwIfAborted();
        let mapUrl: string;
        try {
          mapUrl = normalizeUrl(sitemaps[i]);
        } catch {
          continue;
        }
        if (new URL(mapUrl).origin !== source.origin || visitedMaps.has(mapUrl))
          continue;
        visitedMaps.add(mapUrl);
        if (robots.isAllowed(mapUrl, USER_AGENT) === false) continue;
        try {
          const response = await this.transport.fetch(mapUrl, {
            signal,
            allowed: (u) => u === mapUrl,
          });
          if (response.status === 404) continue;
          if (response.status !== 200)
            throw new SiftError(
              "sitemap",
              `Sitemap returned HTTP ${response.status}.`,
            );
          const $ = load(response.body, { xml: true });
          $("loc").each((_, node) => {
            if (sitemapEntries++ >= 2000) {
              limited = true;
              return;
            }
            const location = $(node).text().trim();
            if ($(node).parent().is("sitemap")) {
              if (sitemaps.length < 5) sitemaps.push(location);
            } else add(location, 0);
          });
        } catch (e) {
          if (signal.aborted) throw e;
          this.store.jobOutcome(jid, mapUrl, "sitemap_warning", safeMessage(e));
        }
      }
      let requested = 0;
      while (queue.length && requested < source.limits.pages) {
        signal.throwIfAborted();
        const batch = queue.splice(
          0,
          Math.min(source.limits.concurrency, source.limits.pages - requested),
        );
        requested += batch.length;
        this.store.run(
          "UPDATE jobs SET discovered=? WHERE id=?",
          seen.size,
          jid,
        );
        await Promise.all(
          batch.map(async ({ url, depth }) => {
            if (robots.isAllowed(url, USER_AGENT) === false) {
              failures++;
              this.store.failed(source, url, "Blocked by robots.txt.");
              this.store.jobOutcome(
                jid,
                url,
                "robots_denied",
                "Blocked by robots.txt.",
              );
              return;
            }
            try {
              const old = this.store.get(
                "SELECT * FROM documents WHERE source_id=? AND original_url=?",
                source.id,
                url,
              );
              const headers: Record<string, string> = {};
              if (old?.active && old?.etag) headers["If-None-Match"] = old.etag;
              if (old?.active && old?.last_modified)
                headers["If-Modified-Since"] = old.last_modified;
              const response = await this.transport.fetch(url, {
                signal,
                headers,
                allowed: (u) =>
                  inScope(u, source) &&
                  robots.isAllowed(u, USER_AGENT) !== false,
              });
              if (response.status === 304 && old?.current_revision) {
                this.store.unchanged(source, old);
                this.store.jobOutcome(jid, url, "unchanged");
                successes++;
                return;
              }
              if ([404, 410].includes(response.status)) {
                this.store.failed(
                  source,
                  url,
                  `HTTP ${response.status}: confirmed unavailable.`,
                  true,
                );
                this.store.jobOutcome(
                  jid,
                  url,
                  "confirmed_unavailable",
                  `HTTP ${response.status}`,
                );
                return;
              }
              if (response.status !== 200)
                throw new SiftError(
                  "http_error",
                  `HTTP ${response.status}${[401, 403].includes(response.status) ? ": authenticated or restricted sources are unsupported." : [429, 503].includes(response.status) ? ": rate limited or unavailable; Retry-After is respected. No immediate retry." : ". Previous content, if any, is retained."}`,
                );
              if (
                !/^(text\/html|application\/xhtml\+xml)(;|$)/i.test(
                  response.headers["content-type"] || "",
                )
              )
                throw new SiftError(
                  "unsupported_type",
                  `Unsupported content type: ${(response.headers["content-type"] || "unknown").slice(0, 120)}. Only server-rendered HTML is supported.`,
                );
              const charset = response.headers["content-type"]
                ?.match(/charset=([^;]+)/i)?.[1]
                ?.replace(/["']/g, "")
                .toLowerCase();
              if (charset && !["utf-8", "utf8", "us-ascii"].includes(charset))
                throw new SiftError(
                  "unsupported_charset",
                  `Unsupported charset ${charset}; this release supports UTF-8 HTML.`,
                );
              const page = extract(response.body, response.url, source);
              signal.throwIfAborted();
              const outcome = this.store.savePage(
                source,
                url,
                page,
                response.headers,
              );
              this.store.jobOutcome(
                jid,
                url,
                outcome,
                page.warnings.join(" ") || null,
              );
              successes++;
              for (const link of page.links) add(link, depth + 1);
            } catch (e) {
              if (signal.aborted) return;
              failures++;
              const message = safeMessage(e);
              this.store.failed(source, url, message);
              this.store.jobOutcome(jid, url, "failed_check", message);
            }
          }),
        );
      }
      if (queue.length) limited = true;
      signal.throwIfAborted();
      const status = failures ? "partial" : limited ? "bounded" : "completed";
      this.store.transaction(() => {
        this.store.run(
          "UPDATE jobs SET status=?,finished_at=?,discovered=?,error=? WHERE id=?",
          status,
          now(),
          seen.size,
          limited
            ? "Crawl budget reached. Some discovered URLs were not checked."
            : null,
          jid,
        );
        this.store.run(
          "UPDATE sources SET status=?,last_checked=?,last_success=CASE WHEN ? THEN ? ELSE last_success END WHERE id=?",
          status,
          now(),
          successes > 0 ? 1 : 0,
          now(),
          source.id,
        );
      });
    } catch (e) {
      const status = userSignal.aborted
        ? "cancelled"
        : signal.aborted
          ? "timed_out"
          : "failed";
      const message =
        status === "timed_out"
          ? "Five-minute job deadline exceeded. Unvisited pages were not classified as deleted."
          : status === "cancelled"
            ? "Cancelled. Completed pages are retained; unvisited pages were not classified as deleted."
            : safeMessage(e);
      this.store.transaction(() => {
        this.store.run(
          "UPDATE jobs SET status=?,finished_at=?,error=? WHERE id=?",
          status,
          now(),
          message,
          jid,
        );
        this.store.run(
          "UPDATE sources SET status=?,last_checked=? WHERE id=?",
          status,
          now(),
          source.id,
        );
        if (status !== "cancelled")
          this.store.change(source, null, "failed_check", message);
      });
    }
  }
}
