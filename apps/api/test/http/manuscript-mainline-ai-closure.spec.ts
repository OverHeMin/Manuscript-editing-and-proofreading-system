import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  loginAsDemoUser,
  startWorkbenchServer,
  stopServer,
} from "./support/workbench-runtime.ts";
import { semanticTableDocxBase64 } from "../../../../test-support/semantic-table-docx.ts";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

interface UploadedManuscriptRecord {
  manuscript: { id: string };
  asset: { id: string; storage_key: string; asset_type: string };
}

interface ModuleRunRecord {
  job: { id: string; status: string };
  asset: { id: string; asset_type: string; storage_key: string };
}

interface ExportedDocumentRecord {
  asset: { id: string; asset_type: string };
  download: {
    url: string;
    storage_key: string;
  };
}

interface DocumentAssetRecord {
  id: string;
  asset_type: string;
}

test("screening upload -> bare run -> download returns a structured markdown review report", async () => {
  const uploadRootDir = await mkdtemp(
    path.join(os.tmpdir(), "medsys-mainline-screening-"),
  );
  const { server, baseUrl } = await startWorkbenchServer({
    uploadRootDir,
  });

  try {
    const uploadCookie = await loginAsDemoUser(baseUrl, "dev.user");
    const screenerCookie = await loginAsDemoUser(baseUrl, "dev.screener");
    const uploaded = await uploadManuscript({
      baseUrl,
      cookie: uploadCookie,
      title: "Screening closure manuscript",
      fileName: "screening-closure.docx",
      fileContentBase64: semanticTableDocxBase64,
    });

    const runResponse = await fetch(`${baseUrl}/api/v1/modules/screening/run`, {
      method: "POST",
      headers: {
        Cookie: screenerCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        manuscriptId: uploaded.manuscript.id,
        parentAssetId: uploaded.asset.id,
        storageKey: `runs/${uploaded.manuscript.id}/screening/screening-report.md`,
        fileName: "screening-report.md",
        executionMode: "bare",
      }),
    });
    const runResult = (await runResponse.json()) as ModuleRunRecord;

    assert.equal(runResponse.status, 201);
    assert.equal(runResult.job.status, "completed");
    assert.equal(runResult.asset.asset_type, "screening_report");

    const downloadResponse = await fetch(
      `${baseUrl}/api/v1/document-assets/${runResult.asset.id}/download`,
      {
        headers: {
          Cookie: screenerCookie,
        },
      },
    );
    const markdown = Buffer.from(
      await downloadResponse.arrayBuffer(),
    ).toString("utf8");

    assert.equal(downloadResponse.status, 200);
    assert.ok(markdown.trim().length > 0);
    assert.match(markdown, /Summary:/u);
    assert.match(markdown, /AI screening summary for HTTP closure\./u);
    assert.match(markdown, /Primary endpoint definition is incomplete\./u);
    assert.match(markdown, /Recommended Decision: minor_revision/u);
  } finally {
    await stopServer(server);
    await rm(uploadRootDir, { recursive: true, force: true });
  }
});

test("editing upload -> bare run -> export current asset returns a changed docx", async () => {
  const uploadRootDir = await mkdtemp(
    path.join(os.tmpdir(), "medsys-mainline-editing-"),
  );
  const { server, baseUrl } = await startWorkbenchServer({
    uploadRootDir,
  });

  try {
    const uploadCookie = await loginAsDemoUser(baseUrl, "dev.user");
    const editorCookie = await loginAsDemoUser(baseUrl, "dev.editor");
    const sourceBytes = Buffer.from(semanticTableDocxBase64, "base64");
    const uploaded = await uploadManuscript({
      baseUrl,
      cookie: uploadCookie,
      title: "Editing closure manuscript",
      fileName: "editing-closure.docx",
      fileContentBase64: semanticTableDocxBase64,
    });

    const runResponse = await fetch(`${baseUrl}/api/v1/modules/editing/run`, {
      method: "POST",
      headers: {
        Cookie: editorCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        manuscriptId: uploaded.manuscript.id,
        parentAssetId: uploaded.asset.id,
        storageKey: `runs/${uploaded.manuscript.id}/editing/edited-manuscript.docx`,
        fileName: "edited-manuscript.docx",
        executionMode: "bare",
      }),
    });
    const runResult = (await runResponse.json()) as ModuleRunRecord;

    assert.equal(runResponse.status, 201);
    assert.equal(runResult.job.status, "completed");
    assert.equal(runResult.asset.asset_type, "edited_docx");

    const exportResponse = await fetch(
      `${baseUrl}/api/v1/document-pipeline/export-current-asset`,
      {
        method: "POST",
        headers: {
          Cookie: editorCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          manuscriptId: uploaded.manuscript.id,
          preferredAssetType: "edited_docx",
        }),
      },
    );
    const exported = (await exportResponse.json()) as ExportedDocumentRecord;

    assert.equal(exportResponse.status, 200);
    assert.equal(exported.asset.asset_type, "edited_docx");

    const downloadResponse = await fetch(`${baseUrl}${exported.download.url}`, {
      headers: {
        Cookie: editorCookie,
      },
    });
    const editedBytes = Buffer.from(await downloadResponse.arrayBuffer());

    assert.equal(downloadResponse.status, 200);
    assert.equal(downloadResponse.headers.get("content-type"), DOCX_MIME);
    assert.ok(editedBytes.byteLength > 0);
    assert.notDeepEqual(
      editedBytes,
      sourceBytes,
      "Expected the edited DOCX to differ from the uploaded source manuscript.",
    );
  } finally {
    await stopServer(server);
    await rm(uploadRootDir, { recursive: true, force: true });
  }
});

test("proofreading upload -> bare run creates both a review report and a downloadable manuscript", async () => {
  const uploadRootDir = await mkdtemp(
    path.join(os.tmpdir(), "medsys-mainline-proofreading-"),
  );
  const { server, baseUrl } = await startWorkbenchServer({
    uploadRootDir,
  });

  try {
    const uploadCookie = await loginAsDemoUser(baseUrl, "dev.user");
    const proofreaderCookie = await loginAsDemoUser(
      baseUrl,
      "dev.proofreader",
    );
    const sourceBytes = Buffer.from(semanticTableDocxBase64, "base64");
    const uploaded = await uploadManuscript({
      baseUrl,
      cookie: uploadCookie,
      title: "Proofreading closure manuscript",
      fileName: "proofreading-closure.docx",
      fileContentBase64: semanticTableDocxBase64,
    });

    const runResponse = await fetch(
      `${baseUrl}/api/v1/modules/proofreading/draft`,
      {
        method: "POST",
        headers: {
          Cookie: proofreaderCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          manuscriptId: uploaded.manuscript.id,
          parentAssetId: uploaded.asset.id,
          storageKey: `runs/${uploaded.manuscript.id}/proofreading/proofreading-report.md`,
          fileName: "proofreading-report.md",
          executionMode: "bare",
        }),
      },
    );
    const runResult = (await runResponse.json()) as ModuleRunRecord;

    assert.equal(runResponse.status, 201);
    assert.equal(runResult.job.status, "completed");
    assert.equal(runResult.asset.asset_type, "proofreading_draft_report");

    const assetsResponse = await fetch(
      `${baseUrl}/api/v1/manuscripts/${uploaded.manuscript.id}/assets`,
      {
        headers: {
          Cookie: proofreaderCookie,
        },
      },
    );
    const assets = (await assetsResponse.json()) as DocumentAssetRecord[];

    assert.equal(assetsResponse.status, 200);
    const reportAsset = assets.find(
      (asset) => asset.asset_type === "proofreading_draft_report",
    );
    const manuscriptAsset = assets.find(
      (asset) => asset.asset_type === "final_proof_annotated_docx",
    );

    assert.ok(reportAsset, "Expected a proofreading report asset.");
    assert.ok(
      manuscriptAsset,
      "Expected proofreading to create a downloadable manuscript asset in one run.",
    );

    const reportDownloadResponse = await fetch(
      `${baseUrl}/api/v1/document-assets/${reportAsset.id}/download`,
      {
        headers: {
          Cookie: proofreaderCookie,
        },
      },
    );
    const reportMarkdown = Buffer.from(
      await reportDownloadResponse.arrayBuffer(),
    ).toString("utf8");

    assert.equal(reportDownloadResponse.status, 200);
    assert.match(reportMarkdown, /Corrections:/u);

    const manuscriptDownloadResponse = await fetch(
      `${baseUrl}/api/v1/document-assets/${manuscriptAsset.id}/download`,
      {
        headers: {
          Cookie: proofreaderCookie,
        },
      },
    );
    const proofreadingBytes = Buffer.from(
      await manuscriptDownloadResponse.arrayBuffer(),
    );

    assert.equal(manuscriptDownloadResponse.status, 200);
    assert.equal(manuscriptDownloadResponse.headers.get("content-type"), DOCX_MIME);
    assert.ok(proofreadingBytes.byteLength > 0);
    assert.notDeepEqual(
      proofreadingBytes,
      sourceBytes,
      "Expected the proofreading manuscript to differ from the uploaded source manuscript.",
    );
  } finally {
    await stopServer(server);
    await rm(uploadRootDir, { recursive: true, force: true });
  }
});

async function uploadManuscript(input: {
  baseUrl: string;
  cookie: string;
  title: string;
  fileName: string;
  fileContentBase64: string;
}): Promise<UploadedManuscriptRecord> {
  const response = await fetch(`${input.baseUrl}/api/v1/manuscripts/upload`, {
    method: "POST",
    headers: {
      Cookie: input.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: input.title,
      fileName: input.fileName,
      mimeType: DOCX_MIME,
      fileContentBase64: input.fileContentBase64,
    }),
  });
  const uploaded = (await response.json()) as UploadedManuscriptRecord;

  assert.equal(response.status, 201);
  assert.equal(uploaded.asset.asset_type, "original");
  return uploaded;
}
