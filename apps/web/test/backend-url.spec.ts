import assert from "node:assert/strict";
import test from "node:test";
import {
  isLoopbackHost,
  maybeAlignConfiguredBackendHost,
  resolveRuntimeBackendBaseUrl,
} from "../src/lib/backend-url.ts";

test("runtime backend base url keeps explicit non-loopback backends unchanged", () => {
  assert.equal(
    resolveRuntimeBackendBaseUrl({
      configuredBaseUrl: "http://10.0.0.9:3001",
      windowLocation: {
        origin: "http://192.168.0.110:4173",
        hostname: "192.168.0.110",
      },
    }),
    "http://10.0.0.9:3001/",
  );
});

test("runtime backend base url aligns loopback-configured hosts to the current LAN host", () => {
  assert.equal(
    resolveRuntimeBackendBaseUrl({
      configuredBaseUrl: "http://127.0.0.1:3001",
      windowLocation: {
        origin: "http://192.168.0.110:4173",
        hostname: "192.168.0.110",
      },
    }),
    "http://192.168.0.110:3001/",
  );
  assert.equal(
    maybeAlignConfiguredBackendHost("http://192.168.0.110:3001", {
      origin: "http://127.0.0.1:4173",
      hostname: "127.0.0.1",
    }),
    "http://127.0.0.1:3001/",
  );
});

test("loopback host detection recognizes common local origins", () => {
  assert.equal(isLoopbackHost("localhost"), true);
  assert.equal(isLoopbackHost("127.0.0.1"), true);
  assert.equal(isLoopbackHost("[::1]"), true);
  assert.equal(isLoopbackHost("0.0.0.0"), true);
  assert.equal(isLoopbackHost("192.168.0.110"), false);
});
