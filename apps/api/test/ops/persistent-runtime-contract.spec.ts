import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  resolvePersistentRuntimeContract,
} from "../../src/ops/persistent-runtime-contract.ts";

const TEST_AI_PROVIDER_MASTER_KEY = Buffer.alloc(32, 0x41).toString("base64");

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
    aiProviderRuntimeCutoverEnabled: false,
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
    AI_PROVIDER_MASTER_KEY: TEST_AI_PROVIDER_MASTER_KEY,
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
        AI_PROVIDER_MASTER_KEY: TEST_AI_PROVIDER_MASTER_KEY,
        ONLYOFFICE_JWT_SECRET: "change-me-in-prod",
      }),
    /onlyoffice_jwt_secret/i,
  );
});

test("persistent runtime contract normalizes configured dependency urls", () => {
  const contract = resolvePersistentRuntimeContract({
    APP_ENV: "staging",
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
    AI_PROVIDER_MASTER_KEY: TEST_AI_PROVIDER_MASTER_KEY,
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

test("persistent runtime contract rejects staging and production placeholder object storage access keys", () => {
  assert.throws(
    () =>
      resolvePersistentRuntimeContract({
        APP_ENV: "staging",
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
        AI_PROVIDER_MASTER_KEY: TEST_AI_PROVIDER_MASTER_KEY,
        ONLYOFFICE_JWT_SECRET: "real-secret",
        OBJECT_STORAGE_ACCESS_KEY: "minioadmin",
      }),
    /object_storage_access_key/i,
  );
});

test("persistent runtime contract rejects staging and production placeholder object storage secret keys", () => {
  assert.throws(
    () =>
      resolvePersistentRuntimeContract({
        APP_ENV: "production",
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
        AI_PROVIDER_MASTER_KEY: TEST_AI_PROVIDER_MASTER_KEY,
        ONLYOFFICE_JWT_SECRET: "real-secret",
        OBJECT_STORAGE_SECRET_KEY: "minioadmin123",
      }),
    /object_storage_secret_key/i,
  );
});

test("persistent runtime contract still tolerates local object storage defaults in development", () => {
  const contract = resolvePersistentRuntimeContract({
    APP_ENV: "development",
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
    OBJECT_STORAGE_ACCESS_KEY: "minioadmin",
    OBJECT_STORAGE_SECRET_KEY: "minioadmin123",
  });

  assert.equal(contract.appEnv, "development");
  assert.equal(contract.dependencies.objectStorage.mode, "smoke_only");
});

test("persistent runtime contract accepts explicit non-placeholder object storage credentials in production", () => {
  const contract = resolvePersistentRuntimeContract({
    APP_ENV: "production",
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
    AI_PROVIDER_MASTER_KEY: TEST_AI_PROVIDER_MASTER_KEY,
    ONLYOFFICE_JWT_SECRET: "real-secret",
    OBJECT_STORAGE_ACCESS_KEY: "prod-storage-user",
    OBJECT_STORAGE_SECRET_KEY: "prod-storage-secret",
  });

  assert.equal(contract.appEnv, "production");
  assert.equal(contract.dependencies.objectStorage.mode, "smoke_only");
});
