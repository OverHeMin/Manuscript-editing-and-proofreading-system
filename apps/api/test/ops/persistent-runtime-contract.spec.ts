import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  resolvePersistentRuntimeContract,
} from "../../src/ops/persistent-runtime-contract.ts";

test("persistent runtime contract rejects demo-only local app env", () => {
  assert.throws(
    () =>
      resolvePersistentRuntimeContract({
        APP_ENV: "local",
      }),
    /persistent.*app_env/i,
  );
});

test("persistent runtime contract resolves the required persistent defaults", () => {
  const contract = resolvePersistentRuntimeContract({
    APP_ENV: "development",
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
  });

  assert.deepEqual(contract, {
    appEnv: "development",
    port: 3001,
    host: "0.0.0.0",
    allowedOrigins: [],
    databaseUrl: "postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
    uploadRootDir: path.resolve(process.cwd(), ".local-data", "uploads", "development"),
    uploadRootSource: "default",
    dependencies: {
      database: {
        mode: "required",
      },
      uploadRoot: {
        mode: "required",
      },
      onlyOffice: {
        mode: "validated_when_configured",
      },
      redis: {
        mode: "smoke_only",
      },
      objectStorage: {
        mode: "smoke_only",
      },
      libreOffice: {
        mode: "validated_when_configured",
      },
    },
  });
});

test("persistent runtime contract records explicit upload root overrides", () => {
  const contract = resolvePersistentRuntimeContract({
    APP_ENV: "production",
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
    UPLOAD_ROOT_DIR: "  /srv/medical/uploads  ",
  });

  assert.equal(contract.uploadRootDir, "/srv/medical/uploads");
  assert.equal(contract.uploadRootSource, "explicit");
});

test("persistent runtime contract rejects staging and production placeholder onlyoffice secrets", () => {
  assert.throws(
    () =>
      resolvePersistentRuntimeContract({
        APP_ENV: "production",
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
        ONLYOFFICE_JWT_SECRET: "change-me-in-prod",
      }),
    /onlyoffice_jwt_secret/i,
  );
});

test("persistent runtime contract normalizes configured dependency urls", () => {
  const contract = resolvePersistentRuntimeContract({
    APP_ENV: "staging",
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
    API_ALLOWED_ORIGINS: "https://ops.example.com/, https://review.example.com",
    ONLYOFFICE_URL: "https://onlyoffice.internal/docs/",
    REDIS_URL: "redis://127.0.0.1:6379/0",
    OBJECT_STORAGE_ENDPOINT: "https://storage.internal/bucket/",
    LIBREOFFICE_BINARY: "  soffice  ",
  });

  assert.deepEqual(contract.allowedOrigins, [
    "https://ops.example.com",
    "https://review.example.com",
  ]);
  assert.equal(contract.dependencies.onlyOffice.url, "https://onlyoffice.internal/docs/");
  assert.equal(contract.dependencies.redis.url, "redis://127.0.0.1:6379/0");
  assert.equal(
    contract.dependencies.objectStorage.url,
    "https://storage.internal/bucket/",
  );
  assert.equal(contract.dependencies.libreOffice.binary, "soffice");
});
