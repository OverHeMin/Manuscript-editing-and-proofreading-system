import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  runPersistentStartupPreflight,
} from "../../src/ops/persistent-startup-preflight.ts";
import {
  resolvePersistentRuntimeContract,
} from "../../src/ops/persistent-runtime-contract.ts";

const TEST_AI_PROVIDER_MASTER_KEY = Buffer.alloc(32, 0x41).toString("base64");

test("persistent startup preflight returns ready when required checks pass", async () => {
  const contract = resolvePersistentRuntimeContract({
    APP_ENV: "development",
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
  });

  const result = await runPersistentStartupPreflight({
    contract,
    databaseProbe: async () => ({ status: "ok" }),
    ensureUploadRoot: async () => ({ status: "ok", path: contract.uploadRootDir }),
  });

  assert.deepEqual(result, {
    status: "ready",
    components: {
      runtimeContract: { status: "ok" },
      database: { status: "ok" },
      uploadRoot: { status: "ok", path: contract.uploadRootDir },
    },
  });
});

test("persistent startup preflight creates a missing upload root", async () => {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "phase10a-preflight-"));
  const uploadRootDir = path.join(rootDir, "uploads", "production");
  const contract = resolvePersistentRuntimeContract({
    APP_ENV: "production",
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
    AI_PROVIDER_MASTER_KEY: TEST_AI_PROVIDER_MASTER_KEY,
    ONLYOFFICE_JWT_SECRET: "real-secret",
    UPLOAD_ROOT_DIR: uploadRootDir,
  });

  try {
    const result = await runPersistentStartupPreflight({
      contract,
      databaseProbe: async () => ({ status: "ok" }),
    });

    assert.equal(result.status, "ready");
    assert.equal(existsSync(uploadRootDir), true);
    assert.deepEqual(result.components.uploadRoot, {
      status: "ok",
      path: uploadRootDir,
    });
  } finally {
    rmSync(rootDir, {
      recursive: true,
      force: true,
    });
  }
});

test("persistent startup preflight reports database failures as not ready", async () => {
  const contract = resolvePersistentRuntimeContract({
    APP_ENV: "staging",
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
    AI_PROVIDER_MASTER_KEY: TEST_AI_PROVIDER_MASTER_KEY,
    ONLYOFFICE_JWT_SECRET: "real-secret",
  });

  const result = await runPersistentStartupPreflight({
    contract,
    databaseProbe: async () => ({
      status: "failed",
      message: "Database is not reachable.",
    }),
    ensureUploadRoot: async () => ({ status: "ok", path: contract.uploadRootDir }),
  });

  assert.deepEqual(result, {
    status: "not_ready",
    components: {
      runtimeContract: { status: "ok" },
      database: {
        status: "failed",
        message: "Database is not reachable.",
      },
      uploadRoot: {
        status: "ok",
        path: contract.uploadRootDir,
      },
    },
  });
});

test("persistent startup preflight reports upload root failures as not ready", async () => {
  const contract = resolvePersistentRuntimeContract({
    APP_ENV: "development",
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/medical_api",
  });

  const result = await runPersistentStartupPreflight({
    contract,
    databaseProbe: async () => ({ status: "ok" }),
    ensureUploadRoot: async () => ({
      status: "failed",
      path: contract.uploadRootDir,
      message: "Upload root is not writable.",
    }),
  });

  assert.deepEqual(result, {
    status: "not_ready",
    components: {
      runtimeContract: { status: "ok" },
      database: { status: "ok" },
      uploadRoot: {
        status: "failed",
        path: contract.uploadRootDir,
        message: "Upload root is not writable.",
      },
    },
  });
});
