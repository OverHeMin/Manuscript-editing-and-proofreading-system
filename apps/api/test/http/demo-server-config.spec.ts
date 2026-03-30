import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveDemoServerConfig,
} from "../../src/http/demo-server-config.ts";

test("demo server config rejects non-local app environments", () => {
  assert.throws(
    () =>
      resolveDemoServerConfig({
        APP_ENV: "production",
      }),
    /demo-only.*APP_ENV/i,
  );
});

test("demo server config rejects non-loopback hosts", () => {
  assert.throws(
    () =>
      resolveDemoServerConfig({
        APP_ENV: "local",
        API_HOST: "0.0.0.0",
      }),
    /loopback/i,
  );
});

test("demo server config rejects non-local allowed origins", () => {
  assert.throws(
    () =>
      resolveDemoServerConfig({
        APP_ENV: "local",
        API_ALLOWED_ORIGINS: "https://example.com",
      }),
    /local origin/i,
  );
});

test("demo server config resolves local defaults for demo runtime", () => {
  const config = resolveDemoServerConfig({
    APP_ENV: "local",
  });

  assert.deepEqual(config, {
    appEnv: "local",
    port: 3001,
    host: "127.0.0.1",
    allowedOrigins: ["http://127.0.0.1:4173", "http://localhost:4173"],
  });
});
