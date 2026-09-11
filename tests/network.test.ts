import test from "node:test";
import assert from "node:assert/strict";
import {
  PublicTransport,
  resolveDestination,
  validateConnection,
} from "../src/network.js";
import https from "node:https";
import { PassThrough } from "node:stream";
import { EventEmitter } from "node:events";
import { gzipSync } from "node:zlib";

test("DNS mixed/private answers and rebinding socket destinations fail closed", async () => {
  await assert.rejects(
    resolveDestination("fixture.example", (async () => [
      { address: "93.184.215.14", family: 4 },
      { address: "10.0.0.1", family: 4 },
    ]) as any),
    /DNS returned/,
  );
  assert.throws(
    () => validateConnection("93.184.215.14", "10.0.0.1"),
    /destination/,
  );
  assert.throws(
    () => validateConnection("93.184.215.14", "1.1.1.1"),
    /destination/,
  );
  assert.doesNotThrow(() =>
    validateConnection("93.184.215.14", "93.184.215.14"),
  );
});
test("redirect scope is rechecked before a second request, including private destinations", async () => {
  for (const location of [
    "http://127.0.0.1/secret",
    "https://other.example/docs",
    "https://example.com/admin",
  ]) {
    const transport = new PublicTransport();
    let calls = 0;
    (transport as any).request = async () => {
      calls++;
      return {
        status: 302,
        headers: { location },
        body: "",
        url: "https://example.com/docs",
      };
    };
    await assert.rejects(
      transport.fetch("https://example.com/docs", {
        signal: AbortSignal.timeout(1000),
        allowed: (u) => u === "https://example.com/docs",
      }),
    );
    assert.equal(calls, 1);
  }
});
test("production body pipeline enforces decompressed size and pins lookup address", async (t) => {
  let observed = false;
  t.mock.method(
    https,
    "request",
    (_u: any, options: any, callback: Function) => {
      options.lookup("ignored", { all: false }, (_e: any, address: string) => {
        assert.equal(address, "93.184.215.14");
        observed = true;
      });
      const req: any = new EventEmitter();
      req.destroy = () => {};
      req.end = () =>
        queueMicrotask(() => {
          const res: any = new PassThrough();
          res.socket = { remoteAddress: "93.184.215.14" };
          res.statusCode = 200;
          res.headers = {
            "content-type": "text/html",
            "content-encoding": "gzip",
          };
          callback(res);
          res.end(gzipSync(Buffer.alloc(2 * 1024 * 1024 + 1, 65)));
        });
      return req;
    },
  );
  await assert.rejects(
    new PublicTransport().fetch("https://93.184.215.14/docs", {
      signal: AbortSignal.timeout(1000),
      allowed: () => true,
    }),
    /2 MB/,
  );
  assert.equal(observed, true);
});
