import assert from "node:assert/strict";
import test from "node:test";
import {
  bindTableEvidenceRevision,
  confirmTableEvidenceRevision,
  createTableEvidenceFromDocxUpload,
  saveTableEvidenceCorrectionPatch,
} from "../src/features/table-evidence/table-evidence-api.ts";

test("table evidence API helpers post exact endpoint payloads", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const client = {
    async request<TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) {
      requests.push(input);
      return {
        status: input.url === "/api/v1/table-evidence/assets/from-docx-upload" ? 201 : 200,
        body: createResponseBody(input.url) as TResponse,
      };
    },
  };

  const uploadInput = {
    fileName: "tables.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    fileContentBase64: "ZmFrZQ==",
    actorId: "forged-user",
    actorRole: "editor",
  };
  const patchInput = {
    patch: {
      patch_id: "patch-1",
      operations: [],
    },
  };
  const confirmInput = {
    confirmations: {
      invisibleCharsConfirmed: true,
      specialSymbolsConfirmed: true,
      actorId: "forged-nested-user",
      confirmedBy: "forged-nested-operator",
    },
    actorRole: "editor",
    confirmedBy: "operator-1",
  };
  const bindingInput = {
    revisionId: "revision-1",
    tableEvidenceRevisionId: "revision-1",
    targetType: "knowledge_revision",
    targetId: "knowledge-revision-1",
    bindingRole: "source_evidence",
  };

  const uploadResponse = await createTableEvidenceFromDocxUpload(client, uploadInput);
  await saveTableEvidenceCorrectionPatch(client, "revision-1", patchInput);
  await confirmTableEvidenceRevision(client, "revision-1", confirmInput);
  await bindTableEvidenceRevision(client, bindingInput);

  assert.equal(uploadResponse.status, 201);
  assert.equal(uploadResponse.body.sourceFile.file_name, "tables.docx");
  assert.equal(uploadResponse.body.asset.id, "asset-1");
  assert.equal(uploadResponse.body.revisions[0]?.id, "revision-1");
  assert.equal(uploadResponse.body.tables[0]?.table_id, "table-1");

  assert.deepEqual(requests, [
    {
      method: "POST",
      url: "/api/v1/table-evidence/assets/from-docx-upload",
      body: {
        fileName: "tables.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileContentBase64: "ZmFrZQ==",
      },
    },
    {
      method: "POST",
      url: "/api/v1/table-evidence/revisions/revision-1/patch",
      body: patchInput,
    },
    {
      method: "POST",
      url: "/api/v1/table-evidence/revisions/revision-1/confirm",
      body: {
        confirmations: {
          invisibleCharsConfirmed: true,
          specialSymbolsConfirmed: true,
        },
      },
    },
    {
      method: "POST",
      url: "/api/v1/table-evidence/bindings",
      body: {
        revisionId: "revision-1",
        targetType: "knowledge_revision",
        targetId: "knowledge-revision-1",
        bindingRole: "source_evidence",
      },
    },
  ]);
});

function createResponseBody(url: string) {
  if (url === "/api/v1/table-evidence/assets/from-docx-upload") {
    return {
      sourceFile: {
        id: "source-file-1",
        storage_key: "table-evidence/source-file-1.docx",
        file_name: "tables.docx",
        mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        byte_length: 4,
        sha256: "hash",
        uploaded_by: "dev-knowledge-reviewer",
        uploaded_at: "2026-04-29T00:00:00.000Z",
      },
      asset: {
        id: "asset-1",
        title: "Table 1",
        source_file_asset_id: "source-file-1",
        source_file_name: "tables.docx",
        source_kind: "docx_upload",
        parser: "python_docx_ooxml",
        parser_version: "1.0.0",
        active_revision_id: "revision-1",
        fidelity_status: "pending",
        created_by: "dev-knowledge-reviewer",
        created_at: "2026-04-29T00:00:00.000Z",
        updated_at: "2026-04-29T00:00:00.000Z",
      },
      revisions: [
        {
          id: "revision-1",
          table_evidence_asset_id: "asset-1",
          revision_no: 1,
          source_snapshot: {
            snapshot_id: "snapshot-1",
            table_id: "table-1",
            source_file_asset_id: "source-file-1",
            parser: "python_docx_ooxml",
            parser_version: "1.0.0",
            row_count: 0,
            column_count: 0,
            notes: [],
            grid_cells: [],
            object_evidence: [],
            warnings: [],
          },
          correction_patch: { patch_id: "patch-1", operations: [] },
          fidelity_report: {
            status: "pending",
            failure_codes: [],
            unsupported_fact_groups: [],
            required_confirmations: [],
            invisible_chars_confirmed: false,
            special_symbols_confirmed: false,
          },
          confirmation_status: "pending",
          created_at: "2026-04-29T00:00:00.000Z",
        },
      ],
      tables: [
        {
          snapshot_id: "snapshot-1",
          table_id: "table-1",
          source_file_asset_id: "source-file-1",
          parser: "python_docx_ooxml",
          parser_version: "1.0.0",
          row_count: 0,
          column_count: 0,
          notes: [],
          grid_cells: [],
          object_evidence: [],
          warnings: [],
        },
      ],
    };
  }

  return {};
}
