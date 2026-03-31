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
        manuscriptType: "review",
        createdBy: "forged-user",
        fileName: "inline-content.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileContentBase64: "SGVsbG8gV29ybGQ=",
      }),
    });
    const uploaded = (await response.json()) as {
      manuscript: { id: string; created_by: string };
      asset: { storage_key: string; file_name?: string };
      job: { requested_by: string };
    };

    assert.equal(response.status, 201);
    assert.equal(uploaded.manuscript.created_by, "dev-user");
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
