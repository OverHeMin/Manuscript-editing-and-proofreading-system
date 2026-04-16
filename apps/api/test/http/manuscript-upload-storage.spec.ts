import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  loginAsDemoUser,
  startWorkbenchServer,
  stopServer,
} from "./support/workbench-runtime.ts";

test("manuscript upload accepts inline file content, stores it locally, and persists the generated storage key", async () => {
  const uploadRootDir = await mkdtemp(path.join(os.tmpdir(), "medsys-upload-"));
  const { server, baseUrl } = await startWorkbenchServer({
    uploadRootDir,
  });

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.user");
    const response = await fetch(`${baseUrl}/api/v1/manuscripts/upload`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Inline content upload",
        createdBy: "forged-user",
        fileName: "inline-content.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileContentBase64: "SGVsbG8gV29ybGQ=",
      }),
    });
    const uploaded = (await response.json()) as {
      manuscript: {
        id: string;
        created_by: string;
        manuscript_type: string;
        manuscript_type_detection_summary?: {
          detected_type: string;
          final_type: string;
          source: string;
          confidence: number;
          confidence_level: string;
          requires_operator_review: boolean;
        };
        governed_execution_context_summary?: {
          observation_status: string;
          base_template_family_id?: string;
          journal_template_selection_state: string;
        };
      };
      asset: { storage_key: string; file_name?: string };
      job: { requested_by: string };
    };

    assert.equal(response.status, 201);
    assert.equal(uploaded.manuscript.created_by, "dev-user");
    assert.equal(uploaded.manuscript.manuscript_type, "review");
    assert.deepEqual(uploaded.manuscript.manuscript_type_detection_summary, {
      detected_type: "review",
      final_type: "review",
      source: "heuristic",
      confidence: 0.52,
      confidence_level: "low",
      requires_operator_review: true,
    });
    assert.ok(uploaded.manuscript.governed_execution_context_summary);
    assert.equal(
      uploaded.manuscript.governed_execution_context_summary
        ?.journal_template_selection_state,
      "base_family_only",
    );
    assert.equal(uploaded.job.requested_by, "dev-user");
    assert.equal(uploaded.asset.file_name, "inline-content.docx");
    assert.match(uploaded.asset.storage_key, /^uploads\/\d{4}\/\d{2}\/\d{2}\//);

    const storedPath = path.join(
      uploadRootDir,
      ...uploaded.asset.storage_key.split("/"),
    );
    const storedContent = await readFile(storedPath, "utf8");
    assert.equal(storedContent, "Hello World");
  } finally {
    await stopServer(server);
    await rm(uploadRootDir, { recursive: true, force: true });
  }
});

test("batch manuscript upload rejects requests beyond the guarded upload limit", async () => {
  const uploadRootDir = await mkdtemp(path.join(os.tmpdir(), "medsys-upload-batch-"));
  const { server, baseUrl } = await startWorkbenchServer({
    uploadRootDir,
  });

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.user");
    const response = await fetch(`${baseUrl}/api/v1/manuscripts/upload-batch`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        createdBy: "forged-user",
        items: Array.from({ length: 11 }, (_, index) => ({
          title: `Inline content upload ${index + 1}`,
          fileName: `inline-content-${index + 1}.docx`,
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          fileContentBase64: "SGVsbG8gV29ybGQ=",
        })),
      }),
    });
    const errorBody = (await response.json()) as {
      error: string;
      message: string;
    };

    assert.equal(response.status, 400);
    assert.equal(errorBody.error, "invalid_request");
    assert.match(errorBody.message, /cannot exceed 10/i);
  } finally {
    await stopServer(server);
    await rm(uploadRootDir, { recursive: true, force: true });
  }
});
