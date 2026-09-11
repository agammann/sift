import http from "node:http";
import https from "node:https";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { createGunzip, createInflate, createBrotliDecompress } from "node:zlib";
import ipaddr from "ipaddr.js";
import { SiftError, type Source } from "./model.js";

export const USER_AGENT =
  "Sift/0.1 (+local documentation collector; robots respected)";
export function publicAddress(address: string): boolean {
  try {
    const parsed = ipaddr.parse(address.replace(/^\[|\]$/g, ""));
    return (
      parsed.range() === "unicast" &&
      !(
        parsed.kind() === "ipv6" &&
        (parsed as ipaddr.IPv6).isIPv4MappedAddress()
      )
    );
  } catch {
    return false;
  }
}
export function normalizeUrl(input: string): string {
  const u = new URL(input);
  if (!["http:", "https:"].includes(u.protocol) || u.username || u.password)
    throw new SiftError(
      "unsafe_url",
      "Only HTTP(S) URLs without embedded credentials are allowed.",
    );
  if (u.href.length > 2048)
    throw new SiftError("unsafe_url", "URL exceeds 2,048 characters.");
  const hostname = u.hostname.replace(/^\[|\]$/g, "");
  if (isIP(hostname) && !publicAddress(hostname))
    throw new SiftError(
      "unsafe_destination",
      "Private, local, reserved and metadata destinations are blocked.",
    );
  if (/^(localhost|.*\.localhost|.*\.local|.*\.internal)$/i.test(hostname))
    throw new SiftError("unsafe_destination", "Local hostnames are blocked.");
  u.hash = "";
  for (const key of [...u.searchParams.keys()])
    if (/^(utm_.+|fbclid|gclid|msclkid|mc_cid|mc_eid)$/i.test(key))
      u.searchParams.delete(key);
  u.searchParams.sort();
  return u.href;
}
export function inScope(
  url: string,
  source: Pick<Source, "origin" | "allowed_paths">,
): boolean {
  try {
    const u = new URL(normalizeUrl(url));
    // Ambiguous encoded separators and double-encoding are rejected conservatively.
    if (/%(?:2f|5c|25)/i.test(u.pathname)) return false;
    const path = decodeURIComponent(u.pathname);
    return (
      u.origin === source.origin &&
      source.allowed_paths.some(
        (p) =>
          p === "/" ||
          path === p.replace(/\/$/, "") ||
          path.startsWith(p.endsWith("/") ? p : `${p}/`),
      )
    );
  } catch {
    return false;
  }
}
export type FetchResponse = {
  status: number;
  headers: Record<string, string>;
  body: string;
  url: string;
};
export async function resolveDestination(
  hostname: string,
  resolver: typeof lookup = lookup,
) {
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await resolver(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    throw new SiftError(
      "unsafe_destination",
      "DNS returned a private, local, reserved or metadata address.",
    );
  return addresses[0];
}
export function validateConnection(
  selected: string,
  remote: string | undefined,
) {
  if (
    !remote ||
    !publicAddress(remote) ||
    ipaddr.process(remote).toString() !== ipaddr.process(selected).toString()
  )
    throw new SiftError(
      "unsafe_destination",
      "Actual connection destination did not match validated DNS.",
    );
}
export interface Transport {
  fetch(
    url: string,
    options: {
      signal: AbortSignal;
      headers?: Record<string, string>;
      allowed: (url: string) => boolean;
    },
  ): Promise<FetchResponse>;
}
const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const done = () => {
      signal.removeEventListener("abort", abort);
      resolve();
    };
    const timer = setTimeout(done, Math.min(ms, 2_147_483_647));
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      reject(signal.reason);
    };
    signal.addEventListener("abort", abort, { once: true });
  });

/** A transport instance is shared by all jobs, so pacing is global per origin. */
export class PublicTransport implements Transport {
  private nextStart = new Map<string, number>();
  async fetch(
    input: string,
    options: {
      signal: AbortSignal;
      headers?: Record<string, string>;
      allowed: (url: string) => boolean;
    },
  ): Promise<FetchResponse> {
    options = {
      ...options,
      signal: AbortSignal.any([options.signal, AbortSignal.timeout(15000)]),
    };
    let url = normalizeUrl(input);
    for (let redirects = 0; redirects <= 4; redirects++) {
      if (!options.allowed(url))
        throw new SiftError(
          "out_of_scope",
          "Request or redirect is outside the explicit crawl scope.",
        );
      const origin = new URL(url).origin;
      const start = Math.max(Date.now(), this.nextStart.get(origin) || 0);
      this.nextStart.set(origin, start + 1000);
      await sleep(Math.max(0, start - Date.now()), options.signal);
      const response = await this.request(url, options);
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (!response.headers.location)
          throw new SiftError("redirect", "Redirect had no Location header.");
        url = normalizeUrl(new URL(response.headers.location, url).href);
        continue;
      }
      if ([429, 503].includes(response.status)) {
        const raw = response.headers["retry-after"];
        const until =
          raw && /^\d+$/.test(raw)
            ? Date.now() + Number(raw) * 1000
            : Date.parse(raw || "");
        if (Number.isFinite(until))
          this.nextStart.set(
            origin,
            Math.max(this.nextStart.get(origin) || 0, until),
          );
      }
      return response;
    }
    throw new SiftError("redirect_limit", "Redirect limit (4) exceeded.");
  }
  private async request(
    url: string,
    options: { signal: AbortSignal; headers?: Record<string, string> },
  ): Promise<FetchResponse> {
    const signal = AbortSignal.any([
      options.signal,
      AbortSignal.timeout(15000),
    ]);
    const u = new URL(url),
      hostname = u.hostname.replace(/^\[|\]$/g, "");
    const selected = await Promise.race([
      resolveDestination(hostname),
      new Promise<never>((_, reject) =>
        signal.addEventListener(
          "abort",
          () =>
            reject(new SiftError("timeout", "Request exceeded its deadline.")),
          { once: true },
        ),
      ),
    ]);
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
      const req = (u.protocol === "https:" ? https : http).request(
        u,
        {
          method: "GET",
          signal,
          agent: false,
          headers: {
            "User-Agent": USER_AGENT,
            Accept:
              "text/html,application/xhtml+xml,text/plain,application/xml,text/xml",
            "Accept-Encoding": "gzip, deflate, br",
            ...options.headers,
          },
          // Pin the validated address for the actual socket; no second DNS resolution.
          lookup: ((_host: string, opts: { all?: boolean }, cb: Function) =>
            opts.all
              ? cb(null, [selected])
              : cb(null, selected.address, selected.family)) as any,
        },
        (res) => {
          const remote = res.socket.remoteAddress;
          try {
            validateConnection(selected.address, remote);
          } catch (e) {
            req.destroy();
            return reject(e);
          }
          const headers = Object.fromEntries(
            Object.entries(res.headers).map(([k, v]) => [
              k,
              Array.isArray(v) ? v.join(", ") : v || "",
            ]),
          );
          const encoding = headers["content-encoding"];
          const decoder =
            encoding === "gzip"
              ? createGunzip()
              : encoding === "deflate"
                ? createInflate()
                : encoding === "br"
                  ? createBrotliDecompress()
                  : null;
          if (encoding && !decoder && encoding !== "identity") {
            req.destroy();
            return reject(
              new SiftError("encoding", "Unsupported response encoding."),
            );
          }
          const stream = decoder ? res.pipe(decoder) : res;
          const buffers: Buffer[] = [];
          let size = 0;
          stream.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > 2 * 1024 * 1024) {
              stream.destroy();
              req.destroy();
              reject(
                new SiftError(
                  "response_limit",
                  "Decompressed response exceeds 2 MB.",
                ),
              );
            } else buffers.push(chunk);
          });
          stream.on("error", reject);
          res.on("error", reject);
          stream.on("end", () =>
            resolve({
              status: res.statusCode || 0,
              headers,
              body: Buffer.concat(buffers).toString("utf8"),
              url,
            }),
          );
        },
      );
      req.on("error", (e) =>
        reject(
          signal.aborted
            ? new SiftError(
                "timeout",
                "Request cancelled or exceeded its 15-second deadline, including body download.",
              )
            : new SiftError(
                "network_error",
                `Network request failed (${(e as NodeJS.ErrnoException).code || "connection error"}).`,
              ),
        ),
      );
      req.end();
    });
  }
}
