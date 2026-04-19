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
          },
          {
            kind: "paragraph",
            text: "The intervention group improved significantly (P < 0.05).",
            paragraph_index: 1,
          },
          {
            kind: "paragraph",
            text: "References",
            paragraph_index: 2,
          },
          {
            kind: "paragraph",
            text: "1. Smith AB. Trial report. 2024.",
            paragraph_index: 3,
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
      },
      {
        text: "The intervention group improved significantly (P < 0.05).",
        section: "results",
        block_kind: "paragraph",
      },
      {
        text: "References",
        section: "reference",
        block_kind: "heading",
      },
      {
        text: "1. Smith AB. Trial report. 2024.",
        section: "reference",
        block_kind: "reference_entry",
      },
    ]);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
