import assert from "node:assert/strict";
import test from "node:test";
import { createInlineUploadFields } from "../src/features/manuscript-workbench/manuscript-upload-file.ts";

test("createInlineUploadFields encodes the selected file into base64 upload fields", async () => {
  const payload = await createInlineUploadFields({
    name: "study.docx",
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    arrayBuffer: async () => new TextEncoder().encode("Hello Manuscript").buffer,
  });

  assert.deepEqual(payload, {
    fileName: "study.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    fileContentBase64: "SGVsbG8gTWFudXNjcmlwdA==",
  });
});

test("createInlineUploadFields falls back to application/octet-stream when the browser omits a mime type", async () => {
  const payload = await createInlineUploadFields({
    name: "scan-upload.bin",
    type: "",
    arrayBuffer: async () => Uint8Array.from([0, 1, 2, 250]).buffer,
  });

  assert.deepEqual(payload, {
    fileName: "scan-upload.bin",
    mimeType: "application/octet-stream",
    fileContentBase64: "AAEC+g==",
  });
});
