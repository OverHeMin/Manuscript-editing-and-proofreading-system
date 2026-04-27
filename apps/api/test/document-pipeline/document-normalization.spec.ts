import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DocumentAssetService } from "../../src/modules/assets/document-asset-service.ts";
import { InMemoryDocumentAssetRepository } from "../../src/modules/assets/in-memory-document-asset-repository.ts";
import {
  DocumentNormalizationService,
  DocumentNormalizationWorkflowService,
  LocalDocumentNormalizationConverter,
} from "../../src/modules/document-pipeline/document-normalization-service.ts";
import { InMemoryJobRepository } from "../../src/modules/jobs/in-memory-job-repository.ts";
import { ManuscriptLifecycleService } from "../../src/modules/manuscripts/manuscript-lifecycle-service.ts";
import { InMemoryManuscriptRepository } from "../../src/modules/manuscripts/in-memory-manuscript-repository.ts";

function createDocumentPipelineHarness(libreOfficeAvailable: boolean) {
  const manuscriptRepository = new InMemoryManuscriptRepository();
  const assetRepository = new InMemoryDocumentAssetRepository();
  const jobRepository = new InMemoryJobRepository();
  const issuedIds = [
    "manuscript-1",
    "asset-original-1",
    "job-upload-1",
    "asset-normalized-1",
  ];
  const nextId = () => {
    const value = issuedIds.shift();
    assert.ok(value, "Expected a test id to be available.");
    return value;
  };

  const manuscriptService = new ManuscriptLifecycleService({
    manuscriptRepository,
    assetRepository,
    jobRepository,
    now: () => new Date("2026-03-27T02:00:00.000Z"),
    createId: nextId,
  });
  const assetService = new DocumentAssetService({
    manuscriptRepository,
    assetRepository,
    now: () => new Date("2026-03-27T02:05:00.000Z"),
    createId: nextId,
  });
  const normalizationService = new DocumentNormalizationService();
  const converterCalls: Array<{
    sourceStorageKey: string;
    targetStorageKey: string;
    sourceType?: string;
  }> = [];
  const workflowService = new DocumentNormalizationWorkflowService({
    normalizationService,
    assetService,
    toolingStatus: {
      libreOfficeAvailable,
    },
    converter: libreOfficeAvailable
      ? {
          async convert(input) {
            converterCalls.push(input);
            return {
              status: "completed",
              targetStorageKey: input.targetStorageKey,
              audit: {
                backend: "libreoffice",
                status: "completed",
                sourceStorageKey: input.sourceStorageKey,
                targetStorageKey: input.targetStorageKey,
                sourceSha256: "source-hash",
                normalizedSha256: "normalized-hash",
                command: "fake-soffice",
                args: ["--headless", "--convert-to", "docx"],
                stdoutSummary: "converted",
                stderrSummary: "",
                outputPath: input.targetStorageKey,
              },
            };
          },
        }
      : undefined,
  });

  return {
    manuscriptService,
    workflowService,
    assetRepository,
    converterCalls,
  };
}

test("docx normalization materializes a normalized_docx asset and exposes a ready preview only after asset creation", async () => {
  const { manuscriptService, workflowService, assetRepository, converterCalls } =
    createDocumentPipelineHarness(true);
  const uploadResult = await manuscriptService.upload({
    title: "Docx Intake",
    manuscriptType: "review",
    createdBy: "user-docx",
    fileName: "docx-intake.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    storageKey: "uploads/docx-intake.docx",
  });

  const normalizationResult = await workflowService.normalize({
    manuscriptId: uploadResult.manuscript.id,
    sourceAssetId: uploadResult.asset.id,
    fileName: uploadResult.asset.file_name ?? "docx-intake.docx",
    mimeType: uploadResult.asset.mime_type,
    storageKey: uploadResult.asset.storage_key,
    createdBy: "user-docx",
    sourceJobId: uploadResult.job.id,
  });

  assert.equal(normalizationResult.preview.status, "ready");
  assert.equal(
    normalizationResult.preview.source_asset_id,
    normalizationResult.normalized_asset?.id,
  );
  assert.equal(normalizationResult.normalized_asset?.asset_type, "normalized_docx");
  assert.equal(
    normalizationResult.normalized_asset?.parent_asset_id,
    uploadResult.asset.id,
  );

  const allAssets = await assetRepository.listByManuscriptId(uploadResult.manuscript.id);
  const normalizedAsset = allAssets.find(
    (asset) => asset.asset_type === "normalized_docx",
  );

  assert.ok(normalizedAsset);
  assert.equal(normalizedAsset?.id, normalizationResult.normalized_asset?.id);
  assert.deepEqual(converterCalls, [
    {
      sourceStorageKey: "uploads/docx-intake.docx",
      targetStorageKey:
        "normalized/manuscript-1/asset-original-1/docx-intake.normalized.docx",
      sourceType: "docx",
    },
  ]);
  assert.deepEqual(normalizationResult.plan.conversion.audit, {
    backend: "libreoffice",
    status: "completed",
    sourceStorageKey: "uploads/docx-intake.docx",
    targetStorageKey:
      "normalized/manuscript-1/asset-original-1/docx-intake.normalized.docx",
    sourceSha256: "source-hash",
    normalizedSha256: "normalized-hash",
    command: "fake-soffice",
    args: ["--headless", "--convert-to", "docx"],
    stdoutSummary: "converted",
    stderrSummary: "",
    outputPath:
      "normalized/manuscript-1/asset-original-1/docx-intake.normalized.docx",
  });
});

test("docx file names win over legacy msword MIME values during normalization", async () => {
  const { manuscriptService, workflowService } =
    createDocumentPipelineHarness(false);
  const uploadResult = await manuscriptService.upload({
    title: "Legacy MIME",
    manuscriptType: "review",
    createdBy: "user-legacy",
    fileName: "legacy-mime.docx",
    mimeType: "application/msword",
    storageKey: "uploads/legacy-mime.docx",
  });

  const normalizationResult = await workflowService.normalize({
    manuscriptId: uploadResult.manuscript.id,
    sourceAssetId: uploadResult.asset.id,
    fileName: uploadResult.asset.file_name ?? "legacy-mime.docx",
    mimeType: uploadResult.asset.mime_type,
    storageKey: uploadResult.asset.storage_key,
    createdBy: "user-legacy",
    sourceJobId: uploadResult.job.id,
  });

  assert.equal(normalizationResult.plan.source_type, "docx");
  assert.equal(normalizationResult.plan.conversion.status, "not_required");
  assert.equal(normalizationResult.preview.status, "ready");
  assert.equal(normalizationResult.normalized_asset?.asset_type, "normalized_docx");
});

test("doc normalization without libreoffice keeps preview pending and does not create a normalized_docx asset", async () => {
  const { manuscriptService, workflowService, assetRepository } =
    createDocumentPipelineHarness(false);
  const uploadResult = await manuscriptService.upload({
    title: "Doc Intake",
    manuscriptType: "review",
    createdBy: "user-doc",
    fileName: "doc-intake.doc",
    mimeType: "application/msword",
    storageKey: "uploads/doc-intake.doc",
  });

  const normalizationResult = await workflowService.normalize({
    manuscriptId: uploadResult.manuscript.id,
    sourceAssetId: uploadResult.asset.id,
    fileName: uploadResult.asset.file_name ?? "doc-intake.doc",
    mimeType: uploadResult.asset.mime_type,
    storageKey: uploadResult.asset.storage_key,
    createdBy: "user-doc",
    sourceJobId: uploadResult.job.id,
  });

  assert.equal(normalizationResult.preview.status, "pending_normalization");
  assert.deepEqual(normalizationResult.plan.conversion.audit, {
    backend: "libreoffice",
    status: "tool_unavailable",
    sourceStorageKey: uploadResult.asset.storage_key,
    targetStorageKey: normalizationResult.plan.derived_asset.storage_key,
  });
  assert.equal(normalizationResult.preview.source_asset_id, uploadResult.asset.id);
  assert.deepEqual(normalizationResult.preview.warnings, [
    "LibreOffice unavailable; doc to docx normalization deferred.",
  ]);
  assert.equal(normalizationResult.normalized_asset, undefined);

  const allAssets = await assetRepository.listByManuscriptId(uploadResult.manuscript.id);
  const normalizedAssets = allAssets.filter(
    (asset) => asset.asset_type === "normalized_docx",
  );

  assert.deepEqual(normalizedAssets, []);
});

test("doc normalization registers a normalized_docx asset when a converter materializes the target", async () => {
  const { manuscriptService, workflowService, assetRepository } =
    createDocumentPipelineHarness(true);
  const uploadResult = await manuscriptService.upload({
    title: "Converted Doc Intake",
    manuscriptType: "review",
    createdBy: "user-doc",
    fileName: "converted-intake.doc",
    mimeType: "application/msword",
    storageKey: "uploads/converted-intake.doc",
  });

  const normalizationResult = await workflowService.normalize({
    manuscriptId: uploadResult.manuscript.id,
    sourceAssetId: uploadResult.asset.id,
    fileName: uploadResult.asset.file_name ?? "converted-intake.doc",
    mimeType: uploadResult.asset.mime_type,
    storageKey: uploadResult.asset.storage_key,
    createdBy: "user-doc",
    sourceJobId: uploadResult.job.id,
  });

  assert.equal(normalizationResult.plan.conversion.status, "completed");
  assert.deepEqual(normalizationResult.plan.conversion.audit, {
    backend: "libreoffice",
    status: "completed",
    sourceStorageKey: uploadResult.asset.storage_key,
    targetStorageKey: normalizationResult.plan.derived_asset.storage_key,
    sourceSha256: "source-hash",
    normalizedSha256: "normalized-hash",
    command: "fake-soffice",
    args: ["--headless", "--convert-to", "docx"],
    stdoutSummary: "converted",
    stderrSummary: "",
    outputPath: normalizationResult.plan.derived_asset.storage_key,
  });
  assert.equal(normalizationResult.preview.status, "ready");
  assert.equal(normalizationResult.normalized_asset?.asset_type, "normalized_docx");
  assert.equal(
    normalizationResult.normalized_asset?.parent_asset_id,
    uploadResult.asset.id,
  );

  const allAssets = await assetRepository.listByManuscriptId(uploadResult.manuscript.id);
  assert.equal(
    allAssets.some(
      (asset) =>
        asset.asset_type === "normalized_docx" &&
        asset.parent_asset_id === uploadResult.asset.id,
    ),
    true,
  );
});

test("local normalization converter copies docx sources into the normalized asset path", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "medsys-normalize-copy-"));
  try {
    const sourceStorageKey = "uploads/source.docx";
    const targetStorageKey = "normalized/manuscript-1/asset-1/source.normalized.docx";
    await writeFile(path.join(rootDir, ...sourceStorageKey.split("/")), "docx-bytes", {
      flag: "wx",
    }).catch(async (error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") {
        throw error;
      }
      await import("node:fs/promises").then(async ({ mkdir }) => {
        await mkdir(path.dirname(path.join(rootDir, ...sourceStorageKey.split("/"))), {
          recursive: true,
        });
      });
      await writeFile(path.join(rootDir, ...sourceStorageKey.split("/")), "docx-bytes");
    });

    const converter = new LocalDocumentNormalizationConverter({
      rootDir,
      libreOfficeAvailable: false,
    });

    const result = await converter.convert({
      sourceStorageKey,
      targetStorageKey,
      sourceType: "docx",
    });

    assert.equal(result.status, "completed");
    assert.equal(result.audit.backend, "copy");
    assert.equal(result.audit.status, "completed");
    assert.equal(result.audit.sourceSha256, result.audit.normalizedSha256);
    assert.equal(result.audit.outputPath, path.join(rootDir, ...targetStorageKey.split("/")));
    assert.equal(result.targetStorageKey, targetStorageKey);
    assert.equal(
      await readFile(path.join(rootDir, ...targetStorageKey.split("/")), "utf8"),
      "docx-bytes",
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("local normalization converter runs libreoffice for doc sources and places the converted docx at the target path", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "medsys-normalize-doc-"));
  try {
    const sourceStorageKey = "uploads/source.doc";
    const targetStorageKey = "normalized/manuscript-1/asset-1/source.normalized.docx";
    const sourcePath = path.join(rootDir, ...sourceStorageKey.split("/"));
    await import("node:fs/promises").then(async ({ mkdir }) => {
      await mkdir(path.dirname(sourcePath), { recursive: true });
    });
    await writeFile(sourcePath, "legacy-doc");

    const converter = new LocalDocumentNormalizationConverter({
      rootDir,
      libreOfficeAvailable: true,
      libreOfficeBinary: "fake-soffice",
      libreOfficeVersion: "LibreOffice 7.6.0",
      runCommand: async ({ outputDir }) => {
        await writeFile(path.join(outputDir, "source.docx"), "converted-docx");
        return { exitCode: 0, stdout: "converted ok", stderr: "warning only" };
      },
    });

    const result = await converter.convert({
      sourceStorageKey,
      targetStorageKey,
      sourceType: "doc",
    });

    assert.equal(result.status, "completed");
    assert.equal(result.audit.backend, "libreoffice");
    assert.equal(result.audit.status, "completed");
    assert.equal(result.audit.command, "fake-soffice");
    assert.equal(result.audit.libreOfficeVersion, "LibreOffice 7.6.0");
    assert.deepEqual(result.audit.args?.slice(0, 4), [
      "--headless",
      "--convert-to",
      "docx",
      "--outdir",
    ]);
    assert.equal(result.audit.stdoutSummary, "converted ok");
    assert.equal(result.audit.stderrSummary, "warning only");
    assert.ok(result.audit.sourceSha256);
    assert.ok(result.audit.normalizedSha256);
    assert.equal(result.audit.sourceSha256.length, 64);
    assert.equal(result.audit.normalizedSha256.length, 64);
    assert.equal(result.audit.outputPath, path.join(rootDir, ...targetStorageKey.split("/")));
    assert.equal(result.targetStorageKey, targetStorageKey);
    assert.equal(
      await readFile(path.join(rootDir, ...targetStorageKey.split("/")), "utf8"),
      "converted-docx",
    );
    assert.equal((await stat(path.join(rootDir, ...targetStorageKey.split("/")))).isFile(), true);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("normalization plans generate unique storage keys per source asset even when file names match", async () => {
  const normalizationService = new DocumentNormalizationService();

  const firstPlan = normalizationService.planNormalization(
    {
      manuscriptId: "manuscript-keys",
      sourceAssetId: "asset-original-1",
      fileName: "submission.doc",
      mimeType: "application/msword",
      storageKey: "uploads/submission.doc",
    },
    {
      libreOfficeAvailable: true,
    },
  );
  const secondPlan = normalizationService.planNormalization(
    {
      manuscriptId: "manuscript-keys",
      sourceAssetId: "asset-original-2",
      fileName: "submission.doc",
      mimeType: "application/msword",
      storageKey: "uploads/submission.doc",
    },
    {
      libreOfficeAvailable: true,
    },
  );

  assert.notEqual(
    firstPlan.derived_asset.storage_key,
    secondPlan.derived_asset.storage_key,
  );
});
