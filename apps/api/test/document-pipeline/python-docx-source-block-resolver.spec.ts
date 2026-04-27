import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { InMemoryDocumentAssetRepository } from "../../src/modules/assets/in-memory-document-asset-repository.ts";
import { PythonDocxSourceBlockResolver } from "../../src/modules/document-pipeline/python-docx-source-block-resolver.ts";

test("python docx source block resolver maps results and reference paragraphs into scoped editorial blocks", async () => {
  const rootDir = await mkdtemp(
    path.join(os.tmpdir(), "python-docx-source-block-resolver-"),
  );

  try {
    const assetRepository = new InMemoryDocumentAssetRepository();
    await assetRepository.save({
      id: "asset-original-1",
      manuscript_id: "manuscript-1",
      asset_type: "original",
      status: "active",
      storage_key: "uploads/manuscript-1/original.docx",
      mime_type:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      source_module: "upload",
      created_by: "user-1",
      version_no: 1,
      is_current: true,
      file_name: "original.docx",
      created_at: "2026-04-18T10:00:00.000Z",
      updated_at: "2026-04-18T10:00:00.000Z",
    });

    const sourcePath = path.join(rootDir, "uploads", "manuscript-1", "original.docx");
    await mkdir(path.dirname(sourcePath), { recursive: true });
    await writeFile(sourcePath, "fixture-docx");

    const resolver = new PythonDocxSourceBlockResolver({
      assetRepository,
      rootDir,
      workerRunner: async () => ({
        status: "ready",
        parser: "python_docx_ooxml",
        sections: [],
        blocks: [
          {
            kind: "paragraph",
            text: "Results",
            paragraph_index: 0,
            source_zone: "body",
            source_locator: "body:p:0",
          },
          {
            kind: "paragraph",
            text: "The intervention group improved significantly (P < 0.05).",
            paragraph_index: 1,
            source_zone: "body",
            source_locator: "body:p:1",
          },
          {
            kind: "paragraph",
            text: "References",
            paragraph_index: 2,
            source_zone: "body",
            source_locator: "body:p:2",
          },
          {
            kind: "paragraph",
            text: "1. Smith AB. Trial report. 2024.",
            paragraph_index: 3,
            source_zone: "body",
            source_locator: "body:p:3",
          },
          {
            kind: "paragraph",
            text: "基金项目：国家自然科学基金（12345678）",
            source_zone: "header",
            source_locator: "header:word/header1.xml:p:0",
            semantic_role: "funding_statement",
            confidence: 0.97,
          },
        ],
        warnings: [],
      }),
    });

    const blocks = await resolver.resolveBlocks({
      manuscriptId: "manuscript-1",
      assetId: "asset-original-1",
    });

    assert.deepEqual(blocks, [
      {
        text: "Results",
        section: "results",
        block_kind: "heading",
        source_zone: "body",
        source_locator: "body:p:0",
      },
      {
        text: "The intervention group improved significantly (P < 0.05).",
        section: "results",
        block_kind: "paragraph",
        source_zone: "body",
        source_locator: "body:p:1",
      },
      {
        text: "References",
        section: "reference",
        block_kind: "heading",
        source_zone: "body",
        source_locator: "body:p:2",
      },
      {
        text: "1. Smith AB. Trial report. 2024.",
        section: "reference",
        block_kind: "reference_entry",
        source_zone: "body",
        source_locator: "body:p:3",
      },
      {
        text: "基金项目：国家自然科学基金（12345678）",
        section: "front_matter",
        block_kind: "paragraph",
        source_zone: "header",
        source_locator: "header:word/header1.xml:p:0",
        semantic_role: "funding_statement",
        confidence: 0.97,
      },
    ]);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("python docx source block resolver converts legacy doc before extracting source blocks", async () => {
  const rootDir = await mkdtemp(
    path.join(os.tmpdir(), "python-doc-source-block-resolver-"),
  );

  try {
    const assetRepository = new InMemoryDocumentAssetRepository();
    await assetRepository.save({
      id: "asset-original-doc-1",
      manuscript_id: "manuscript-doc-1",
      asset_type: "original",
      status: "active",
      storage_key: "uploads/manuscript-doc-1/original.doc",
      mime_type: "application/msword",
      source_module: "upload",
      created_by: "user-1",
      version_no: 1,
      is_current: true,
      file_name: "original.doc",
      created_at: "2026-04-18T10:00:00.000Z",
      updated_at: "2026-04-18T10:00:00.000Z",
    });

    const sourcePath = path.join(rootDir, "uploads", "manuscript-doc-1", "original.doc");
    const convertedPath = path.join(
      rootDir,
      ".normalized-cache",
      "manuscript-doc-1",
      "asset-original-doc-1",
      "original.docx",
    );
    await mkdir(path.dirname(sourcePath), { recursive: true });
    await writeFile(sourcePath, "fixture-doc");

    let converterInput: { sourcePath: string; outputDir: string } | undefined;
    let workerSourcePath = "";
    const resolver = new PythonDocxSourceBlockResolver({
      assetRepository,
      rootDir,
      legacyDocConverter: async (input) => {
        converterInput = input;
        await mkdir(path.dirname(convertedPath), { recursive: true });
        await writeFile(convertedPath, "fixture-docx");
        return {
          status: "converted",
          outputPath: convertedPath,
        };
      },
      workerRunner: async (source) => {
        workerSourcePath = source;
        return {
          blocks: [
            {
              kind: "paragraph",
              text: "摘要：患儿均治疗10d。",
              source_zone: "body",
              source_locator: "body:p:0",
            },
          ],
        };
      },
    });

    const blocks = await resolver.resolveBlocks({
      manuscriptId: "manuscript-doc-1",
      assetId: "asset-original-doc-1",
    });

    assert.equal(converterInput?.sourcePath, sourcePath);
    assert.match(
      converterInput?.outputDir ?? "",
      /\.normalized-cache.+manuscript-doc-1.+asset-original-doc-1/u,
    );
    assert.equal(workerSourcePath, convertedPath);
    assert.deepEqual(blocks, [
      {
        text: "摘要：患儿均治疗10d。",
        section: "abstract",
        block_kind: "heading",
        source_zone: "body",
        source_locator: "body:p:0",
      },
    ]);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
