import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { materializeTextAsset } from "../../src/modules/shared/text-asset-materialization.ts";

test("text asset materialization writes UTF-8 content under the configured upload root", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "medsys-text-asset-"));

  try {
    const result = await materializeTextAsset({
      rootDir,
      storageKey: "runs/manuscript-1/screening/report.md",
      content: "# Screening Report\n\nSummary: ready",
    });

    assert.equal(
      result.absolutePath,
      path.join(rootDir, "runs", "manuscript-1", "screening", "report.md"),
    );
    assert.equal(result.bytes.toString("utf8"), "# Screening Report\n\nSummary: ready");
    assert.equal(
      await readFile(result.absolutePath, "utf8"),
      "# Screening Report\n\nSummary: ready",
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("text asset materialization rejects storage keys that escape the configured root", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "medsys-text-asset-"));

  try {
    await assert.rejects(
      () =>
        materializeTextAsset({
          rootDir,
          storageKey: "../escape.md",
          content: "escape",
        }),
      /escaped the configured root/u,
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("text asset materialization leaves a readable file at the returned storage key", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "medsys-text-asset-"));

  try {
    const result = await materializeTextAsset({
      rootDir,
      storageKey: "runs/manuscript-2/proofreading/report.md",
      content: "Corrections: 2",
    });
    const fileAtStorageKey = path.join(rootDir, ...result.storageKey.split("/"));

    assert.equal(await readFile(fileAtStorageKey, "utf8"), "Corrections: 2");
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
