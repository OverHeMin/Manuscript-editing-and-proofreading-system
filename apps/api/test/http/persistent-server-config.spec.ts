import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { resolvePersistentRuntimeContract } from "../../src/ops/persistent-runtime-contract.ts";
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
    uploadRootDir: path.resolve(process.cwd(), ".local-data", "uploads", "development"),
    aiProviderRuntimeCutoverEnabled: false,
  });
});

test("persistent server config accepts an explicit upload root override", () => {
  const config = resolvePersistentServerConfig({
    APP_ENV: "production",
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
    AI_PROVIDER_MASTER_KEY: Buffer.alloc(32, 0x41).toString("base64"),
    UPLOAD_ROOT_DIR: "  /srv/medical/uploads  ",
  });

  assert.equal(config.uploadRootDir, "/srv/medical/uploads");
});

test("persistent server config rejects production placeholder onlyoffice secrets", () => {
  assert.throws(
    () =>
      resolvePersistentServerConfig({
        APP_ENV: "production",
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
        AI_PROVIDER_MASTER_KEY: Buffer.alloc(32, 0x41).toString("base64"),
        ONLYOFFICE_JWT_SECRET: "change-me-in-prod",
      }),
    /onlyoffice_jwt_secret/i,
  );
});

test("persistent server config rejects staging missing AI_PROVIDER_MASTER_KEY", () => {
  assert.throws(
    () =>
      resolvePersistentServerConfig({
        APP_ENV: "staging",
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
      }),
    /AI_PROVIDER_MASTER_KEY/i,
  );
});

test("persistent server config rejects staging placeholder AI_PROVIDER_MASTER_KEY", () => {
  assert.throws(
    () =>
      resolvePersistentServerConfig({
        APP_ENV: "staging",
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
        AI_PROVIDER_MASTER_KEY: "place_holder_key",
      }),
    /AI_PROVIDER_MASTER_KEY/i,
  );
});

test("persistent server config rejects production missing AI_PROVIDER_MASTER_KEY", () => {
  assert.throws(
    () =>
      resolvePersistentServerConfig({
        APP_ENV: "production",
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
      }),
    /AI_PROVIDER_MASTER_KEY/i,
  );
});

test("persistent server config rejects production placeholder AI_PROVIDER_MASTER_KEY", () => {
  assert.throws(
    () =>
      resolvePersistentServerConfig({
        APP_ENV: "production",
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
        AI_PROVIDER_MASTER_KEY: "place_holder_key",
      }),
    /AI_PROVIDER_MASTER_KEY/i,
  );
});

test("persistent server config resolves development when AI_PROVIDER_MASTER_KEY defined", () => {
  const config = resolvePersistentServerConfig({
    APP_ENV: "development",
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
    AI_PROVIDER_MASTER_KEY: Buffer.alloc(32, 0x41).toString("base64"),
  });

  assert.deepEqual(config.appEnv, "development");
});

test("persistent runtime contract exposes a dedicated AI provider runtime cutover flag", () => {
  const disabled = resolvePersistentRuntimeContract({
    APP_ENV: "development",
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
    AI_PROVIDER_MASTER_KEY: Buffer.alloc(32, 0x41).toString("base64"),
  });
  const enabled = resolvePersistentRuntimeContract({
    APP_ENV: "development",
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
    AI_PROVIDER_MASTER_KEY: Buffer.alloc(32, 0x41).toString("base64"),
    AI_PROVIDER_RUNTIME_CUTOVER: "true",
  });

  assert.equal(disabled.aiProviderRuntimeCutoverEnabled, false);
  assert.equal(enabled.aiProviderRuntimeCutoverEnabled, true);
});
