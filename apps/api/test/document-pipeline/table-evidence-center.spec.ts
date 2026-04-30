import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  InMemoryTableEvidenceRepository,
  LocalFileTableEvidenceRepository,
  TableEvidenceCenter,
} from "../../src/modules/document-pipeline/table-evidence-center.ts";
import type { TableEvidenceSnapshot } from "../../src/modules/document-pipeline/table-evidence-record.ts";

test("table evidence center reuses snapshot for matching asset hash and parser version", async () => {
  const rootDir = path.join(os.tmpdir(), `table-evidence-center-${Date.now()}`);
  await mkdir(rootDir, { recursive: true });
  const sourcePath = path.join(rootDir, "uploads", "sample.docx");
  await mkdir(path.dirname(sourcePath), { recursive: true });
  await writeFile(sourcePath, Buffer.from("native-docx-bytes"));

  const repository = new InMemoryTableEvidenceRepository();
  let extractCount = 0;
  const center = new TableEvidenceCenter({
    rootDir,
    parserVersion: "lossless-v1",
    assetRepository: {
      async findById() {
        return {
          id: "asset-1",
          manuscript_id: "manuscript-1",
          asset_type: "normalized_docx",
          status: "active",
          storage_key: "uploads/sample.docx",
          mime_type:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          source_module: "editing",
          created_by: "editor-1",
          version_no: 1,
          is_current: true,
          created_at: "2026-04-30T00:00:00.000Z",
          updated_at: "2026-04-30T00:00:00.000Z",
        };
      },
    },
    repository,
    worker: {
      async extract(input) {
        extractCount += 1;
        return buildSnapshot({
          manuscriptId: input.manuscriptId,
          assetId: input.assetId,
          sourceStorageKey: input.sourceStorageKey,
          docxHash: input.docxHash,
          parserVersion: input.parserVersion,
        });
      },
    },
    now: () => new Date("2026-04-30T01:00:00.000Z"),
    createId: () => "table-evidence-snapshot-1",
  });

  const first = await center.getOrCreateSnapshot({
    manuscriptId: "manuscript-1",
    assetId: "asset-1",
  });
  const second = await center.getOrCreateSnapshot({
    manuscriptId: "manuscript-1",
    assetId: "asset-1",
  });

  assert.equal(extractCount, 1);
  assert.equal(second.snapshotId, first.snapshotId);
  assert.equal(second.docxHash, first.docxHash);
});

test("table evidence center returns a failed snapshot instead of blocking when worker extraction fails", async () => {
  const rootDir = path.join(
    os.tmpdir(),
    `table-evidence-center-failure-${Date.now()}`,
  );
  await mkdir(rootDir, { recursive: true });
  const sourcePath = path.join(rootDir, "uploads", "source.docx");
  await mkdir(path.dirname(sourcePath), { recursive: true });
  await writeFile(sourcePath, Buffer.from("broken-docx"));

  const repository = new InMemoryTableEvidenceRepository();
  const center = new TableEvidenceCenter({
    rootDir,
    parserVersion: "lossless-v1",
    assetRepository: {
      async findById() {
        return {
          id: "asset-1",
          manuscript_id: "manuscript-1",
          asset_type: "original",
          status: "active",
          storage_key: "uploads/source.docx",
          mime_type:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          source_module: "screening",
          created_by: "author-1",
          version_no: 1,
          is_current: true,
          created_at: "2026-04-30T00:00:00.000Z",
          updated_at: "2026-04-30T00:00:00.000Z",
        };
      },
    },
    repository,
    worker: {
      async extract() {
        throw new Error("python worker failed");
      },
    },
    now: () => new Date("2026-04-30T01:00:00.000Z"),
    createId: () => "table-evidence-snapshot-failed",
  });

  const snapshot = await center.getOrCreateSnapshot({
    manuscriptId: "manuscript-1",
    assetId: "asset-1",
  });

  assert.equal(snapshot.status, "failed");
  assert.equal(snapshot.snapshotId, "table-evidence-snapshot-failed");
  assert.equal(snapshot.warnings[0]?.code, "worker_failed");
  assert.match(snapshot.warnings[0]?.message ?? "", /python worker failed/);
});

test("table evidence center does not cache failed worker snapshots", async () => {
  const rootDir = path.join(
    os.tmpdir(),
    `table-evidence-center-retry-${Date.now()}`,
  );
  await mkdir(rootDir, { recursive: true });
  const sourcePath = path.join(rootDir, "uploads", "source.docx");
  await mkdir(path.dirname(sourcePath), { recursive: true });
  await writeFile(sourcePath, Buffer.from("retry-docx"));

  let extractCount = 0;
  const center = new TableEvidenceCenter({
    rootDir,
    parserVersion: "lossless-v1",
    assetRepository: {
      async findById() {
        return {
          id: "asset-1",
          manuscript_id: "manuscript-1",
          asset_type: "original",
          status: "active",
          storage_key: "uploads/source.docx",
          mime_type:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          source_module: "screening",
          created_by: "author-1",
          version_no: 1,
          is_current: true,
          created_at: "2026-04-30T00:00:00.000Z",
          updated_at: "2026-04-30T00:00:00.000Z",
        };
      },
    },
    repository: new InMemoryTableEvidenceRepository(),
    worker: {
      async extract(input) {
        extractCount += 1;
        if (extractCount === 1) {
          throw new Error("temporary worker failure");
        }
        return buildSnapshot({
          manuscriptId: input.manuscriptId,
          assetId: input.assetId,
          sourceStorageKey: input.sourceStorageKey,
          docxHash: input.docxHash,
          parserVersion: input.parserVersion,
        });
      },
    },
    now: () => new Date("2026-04-30T01:00:00.000Z"),
    createId: () => `table-evidence-snapshot-${extractCount + 1}`,
  });

  const failed = await center.getOrCreateSnapshot({
    manuscriptId: "manuscript-1",
    assetId: "asset-1",
  });
  const recovered = await center.getOrCreateSnapshot({
    manuscriptId: "manuscript-1",
    assetId: "asset-1",
  });

  assert.equal(failed.status, "failed");
  assert.equal(recovered.status, "complete");
  assert.equal(extractCount, 2);
});

test("local file table evidence repository reuses snapshots across center instances", async () => {
  const rootDir = path.join(
    os.tmpdir(),
    `table-evidence-file-cache-${Date.now()}`,
  );
  await mkdir(rootDir, { recursive: true });
  const sourcePath = path.join(rootDir, "uploads", "sample.docx");
  await mkdir(path.dirname(sourcePath), { recursive: true });
  await writeFile(sourcePath, Buffer.from("native-docx-bytes"));

  let extractCount = 0;
  const buildCenter = () =>
    new TableEvidenceCenter({
      rootDir,
      parserVersion: "lossless-v1",
      assetRepository: {
        async findById() {
          return {
            id: "asset-1",
            manuscript_id: "manuscript-1",
            asset_type: "normalized_docx",
            status: "active",
            storage_key: "uploads/sample.docx",
            mime_type:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            source_module: "editing",
            created_by: "editor-1",
            version_no: 1,
            is_current: true,
            created_at: "2026-04-30T00:00:00.000Z",
            updated_at: "2026-04-30T00:00:00.000Z",
          };
        },
      },
      repository: new LocalFileTableEvidenceRepository({
        rootDir,
      }),
      worker: {
        async extract(input) {
          extractCount += 1;
          return buildSnapshot({
            manuscriptId: input.manuscriptId,
            assetId: input.assetId,
            sourceStorageKey: input.sourceStorageKey,
            docxHash: input.docxHash,
            parserVersion: input.parserVersion,
          });
        },
      },
      now: () => new Date("2026-04-30T01:00:00.000Z"),
      createId: () => "table-evidence-snapshot-1",
    });

  const first = await buildCenter().getOrCreateSnapshot({
    manuscriptId: "manuscript-1",
    assetId: "asset-1",
  });
  const second = await buildCenter().getOrCreateSnapshot({
    manuscriptId: "manuscript-1",
    assetId: "asset-1",
  });

  assert.equal(extractCount, 1);
  assert.equal(second.snapshotId, first.snapshotId);
  assert.equal(second.docxHash, first.docxHash);
});

function buildSnapshot(input: {
  manuscriptId: string;
  assetId: string;
  sourceStorageKey: string;
  docxHash: string;
  parserVersion: string;
}): TableEvidenceSnapshot {
  return {
    snapshotId: "table-evidence-snapshot-1",
    manuscriptId: input.manuscriptId,
    assetId: input.assetId,
    sourceStorageKey: input.sourceStorageKey,
    docxHash: input.docxHash,
    parserVersion: input.parserVersion,
    createdAt: "2026-04-30T01:00:00.000Z",
    status: "complete",
    tables: [],
    warnings: [],
  };
}
