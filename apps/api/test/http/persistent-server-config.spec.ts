import test from "node:test";
import assert from "node:assert/strict";
import {
  resolvePersistentServerConfig,
} from "../../src/http/persistent-server-config.ts";

test("persistent server config rejects demo-only local app env", () => {
  assert.throws(
    () =>
      resolvePersistentServerConfig({
        APP_ENV: "local",
      }),
    /persistent.*app_env/i,
  );
});

test("persistent server config resolves non-demo defaults", () => {
  const config = resolvePersistentServerConfig({
    APP_ENV: "development",
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
  });

  assert.deepEqual(config, {
    appEnv: "development",
    port: 3001,
    host: "0.0.0.0",
    allowedOrigins: [],
    databaseUrl: "postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
    uploadRootDir: undefined,
  });
});

test("persistent server config accepts an explicit upload root override", () => {
  const config = resolvePersistentServerConfig({
    APP_ENV: "production",
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
    UPLOAD_ROOT_DIR: "  /srv/medical/uploads  ",
  });

  assert.equal(config.uploadRootDir, "/srv/medical/uploads");
});
