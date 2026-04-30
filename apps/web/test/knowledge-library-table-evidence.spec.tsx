import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

const {
  KnowledgeLibraryRichContentEditor,
  createKnowledgeLibraryContentBlockForAction,
  appendKnowledgeLibraryTableEvidenceBlock,
  getKnowledgeLibraryUploadedTableEvidenceSelections,
  handleKnowledgeLibraryTableEvidenceSelection,
} = await import(
  "../src/features/knowledge-library/knowledge-library-rich-content-editor.tsx"
);
const { replaceKnowledgeRevisionContentBlocks } = await import(
  "../src/features/knowledge-library/knowledge-library-api.ts"
);

test("knowledge library rich content editor exposes Word table evidence entry instead of legacy guaranteed paste wording", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeLibraryRichContentEditor blocks={[]} onChange={() => undefined} />,
  );

  assert.match(markup, /Word 表格证据/u);
  assert.doesNotMatch(markup, /保证级粘贴/u);
  assert.match(markup, /data-block-action="add-table-evidence"/u);
  assert.doesNotMatch(markup, /data-block-action="add-table"/u);
});

test("knowledge library rich content editor opens the DOCX upload and preview area when table evidence is available", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeLibraryRichContentEditor
      blocks={[]}
      onChange={() => undefined}
      tableEvidenceClient={{ request: async () => ({ status: 200, body: {} }) }}
    />,
  );

  assert.match(markup, /data-table-evidence-upload-input="true"/u);
  assert.match(markup, /data-table-evidence-client-state="available"/u);
  assert.match(markup, /Word 表格证据上传预览区/u);
  assert.match(markup, /预览确认区会在上传并选择表格后显示在这里/u);
});

test("knowledge library rich content editor does not create new ordinary table blocks", () => {
  assert.equal(
    createKnowledgeLibraryContentBlockForAction({
      blocks: [],
      action: "add-table",
      currentRevisionId: "knowledge-revision-1",
    }),
    null,
  );

  assert.equal(
    createKnowledgeLibraryContentBlockForAction({
      blocks: [],
      action: "add-table-evidence",
      currentRevisionId: "knowledge-revision-1",
    }),
    null,
  );
});

test("knowledge library upload response exposes every parsed table as a selectable revision", () => {
  const selections = getKnowledgeLibraryUploadedTableEvidenceSelections({
    sourceFile: {
      id: "file-1",
      storage_key: "table-evidence/file-1.docx",
      file_name: "tables.docx",
      mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      byte_length: 17,
      sha256: "hash",
      uploaded_by: "user-1",
      uploaded_at: "2026-04-29T00:00:00.000Z",
    },
    asset: buildTableEvidenceAsset("asset-1", "rev-1"),
    assets: [
      buildTableEvidenceAsset("asset-1", "rev-1"),
      buildTableEvidenceAsset("asset-2", "rev-2"),
    ],
    revisions: [
      buildTableEvidenceRevision("rev-1", "asset-1", "table-1"),
      buildTableEvidenceRevision("rev-2", "asset-2", "table-2"),
    ],
    tables: [buildTableSourceSnapshot("table-1"), buildTableSourceSnapshot("table-2")],
  });

  assert.deepEqual(
    selections.map((selection) => ({
      assetId: selection.asset.id,
      revisionId: selection.revision.id,
      tableId: selection.table.table_id,
    })),
    [
      { assetId: "asset-1", revisionId: "rev-1", tableId: "table-1" },
      { assetId: "asset-2", revisionId: "rev-2", tableId: "table-2" },
    ],
  );
});

test("knowledge library rich content editor appends table evidence block from a picked revision and binds it to the knowledge revision", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const client = {
    async request<TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) {
      requests.push(input);
      return {
        status: 200,
        body: {
          id: "binding-1",
          table_evidence_asset_id: "asset-1",
          table_evidence_revision_id: "table-revision-1",
          target_type: "knowledge_revision",
          target_id: "knowledge-revision-1",
          binding_role: "source_evidence",
          created_at: "2026-04-29T00:00:00.000Z",
        } as TResponse,
      };
    },
  };

  const nextBlocks = await appendKnowledgeLibraryTableEvidenceBlock({
    blocks: [],
    currentRevisionId: "knowledge-revision-1",
    client,
    selection: {
      assetId: "asset-1",
      revisionId: "table-revision-1",
      revisionStatus: "confirmed",
      confirmedTablePackage: {
        authority: "authoritative",
      } as never,
    },
  });

  assert.deepEqual(requests, [
    {
      method: "POST",
      url: "/api/v1/table-evidence/bindings",
      body: {
        revisionId: "table-revision-1",
        targetType: "knowledge_revision",
        targetId: "knowledge-revision-1",
        bindingRole: "source_evidence",
      },
    },
  ]);
  assert.equal(nextBlocks.length, 1);
  assert.equal(nextBlocks[0]?.block_type, "table_evidence_block");
  assert.equal(nextBlocks[0]?.revision_id, "knowledge-revision-1");
  assert.deepEqual(nextBlocks[0]?.content_payload, {
    table_evidence_asset_id: "asset-1",
    table_evidence_revision_id: "table-revision-1",
    binding_id: "binding-1",
    revision_status: "confirmed",
    confirmed_table_package: {
      authority: "authoritative",
    },
  });
});

function buildTableEvidenceAsset(id: string, activeRevisionId: string) {
  return {
    id,
    title: id,
    source_file_asset_id: "file-1",
    source_file_name: "tables.docx",
    source_kind: "docx_upload" as const,
    parser: "python_docx_ooxml" as const,
    parser_version: "table-evidence-v1",
    active_revision_id: activeRevisionId,
    fidelity_status: "pending" as const,
    created_by: "user-1",
    created_at: "2026-04-29T00:00:00.000Z",
    updated_at: "2026-04-29T00:00:00.000Z",
  };
}

function buildTableEvidenceRevision(id: string, assetId: string, tableId: string) {
  return {
    id,
    table_evidence_asset_id: assetId,
    revision_no: 1,
    source_snapshot: buildTableSourceSnapshot(tableId),
    correction_patch: { patch_id: `patch-${id}`, operations: [] },
    fidelity_report: {
      status: "pending" as const,
      failure_codes: [],
      unsupported_fact_groups: [],
      required_confirmations: [],
      invisible_chars_confirmed: false,
      special_symbols_confirmed: false,
    },
    confirmation_status: "pending" as const,
    created_at: "2026-04-29T00:00:00.000Z",
  };
}

function buildTableSourceSnapshot(tableId: string) {
  return {
    snapshot_id: `source-${tableId}`,
    table_id: tableId,
    source_file_asset_id: "file-1",
    parser: "python_docx_ooxml" as const,
    parser_version: "table-evidence-v1",
    row_count: 1,
    column_count: 1,
    notes: [],
    object_evidence: [],
    warnings: [],
    grid_cells: [],
  };
}

test("knowledge library rich content editor inserts pending table evidence without attempting a backend bind", async () => {
  const requests: unknown[] = [];
  const client = {
    async request<TResponse>(input: unknown) {
      requests.push(input);
      return { status: 200, body: {} as TResponse };
    },
  };

  const nextBlocks = await appendKnowledgeLibraryTableEvidenceBlock({
    blocks: [],
    currentRevisionId: "knowledge-revision-1",
    client,
    selection: {
      assetId: "asset-1",
      revisionId: "table-revision-pending",
      revisionStatus: "pending",
    },
  });

  assert.deepEqual(requests, []);
  assert.equal(nextBlocks.length, 1);
  assert.deepEqual(nextBlocks[0]?.content_payload, {
    table_evidence_asset_id: "asset-1",
    table_evidence_revision_id: "table-revision-pending",
    revision_status: "pending",
  });
});

test("knowledge library table evidence UI selection handler catches binding failures without inserting a block", async () => {
  const errors: string[] = [];
  const changes: unknown[] = [];
  const client = {
    async request<TResponse>() {
      throw new Error("binding service unavailable");
      return { status: 500, body: {} as TResponse };
    },
  };

  await handleKnowledgeLibraryTableEvidenceSelection({
    blocks: [],
    currentRevisionId: "knowledge-revision-1",
    client,
    selection: {
      assetId: "asset-1",
      revisionId: "table-revision-1",
      revisionStatus: "confirmed",
      confirmedTablePackage: {
        authority: "authoritative",
      } as never,
    },
    onChange: (nextBlocks) => changes.push(nextBlocks),
    onError: (message) => errors.push(message),
  });

  assert.deepEqual(changes, []);
  assert.deepEqual(errors, ["binding service unavailable"]);
});

test("knowledge library table evidence selection inserts a local draft block before backend binding is possible", async () => {
  const requests: unknown[] = [];
  const errors: string[] = [];
  const changes: KnowledgeContentBlockViewModel[][] = [];
  const client = {
    async request<TResponse>(input: unknown) {
      requests.push(input);
      return { status: 200, body: {} as TResponse };
    },
  };

  await handleKnowledgeLibraryTableEvidenceSelection({
    blocks: [
      {
        id: "block-1",
        revision_id: "draft-revision",
        block_type: "text_block",
        order_no: 0,
        status: "active",
        content_payload: { text: "" },
      },
    ],
    client,
    selection: {
      assetId: "asset-1",
      revisionId: "table-revision-1",
      revisionStatus: "confirmed",
      confirmedTablePackage: {
        authority: "authoritative",
      } as never,
    },
    onChange: (nextBlocks) => changes.push(nextBlocks),
    onError: (message) => errors.push(message),
  });

  assert.deepEqual(requests, []);
  assert.deepEqual(errors, []);
  assert.equal(changes.length, 1);
  assert.equal(changes[0]?.[1]?.revision_id, "local-draft");
  assert.deepEqual(changes[0]?.[1]?.content_payload, {
    table_evidence_asset_id: "asset-1",
    table_evidence_revision_id: "table-revision-1",
    revision_status: "confirmed",
    confirmed_table_package: {
      authority: "authoritative",
    },
  });

  const nextBlocks = await appendKnowledgeLibraryTableEvidenceBlock({
    blocks: [],
    currentRevisionId: "local-draft",
    client,
    selection: {
      assetId: "asset-1",
      revisionId: "table-revision-1",
      revisionStatus: "confirmed",
      confirmedTablePackage: {
        authority: "authoritative",
      } as never,
    },
  });
  assert.equal(nextBlocks[0]?.revision_id, "local-draft");
  assert.equal(nextBlocks[0]?.content_payload.binding_id, undefined);
  assert.deepEqual(requests, []);
});

test("knowledge library rich content editor renders existing table evidence blocks with localized revision status", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeLibraryRichContentEditor
      blocks={[
        {
          id: "block-1",
          revision_id: "knowledge-revision-1",
          block_type: "table_evidence_block",
          order_no: 0,
          status: "active",
          content_payload: {
            table_evidence_asset_id: "asset-1",
            table_evidence_revision_id: "table-revision-1",
            binding_id: "binding-1",
            revision_status: "pending",
          },
        },
      ]}
      onChange={() => undefined}
    />,
  );

  assert.match(markup, /data-block-type="table_evidence_block"/u);
  assert.match(markup, /asset-1/u);
  assert.match(markup, /table-revision-1/u);
  assert.match(markup, /binding-1/u);
  assert.match(markup, /待确认/u);
  assert.doesNotMatch(markup, />pending</u);
  assert.doesNotMatch(markup, /表格内容（支持直接粘贴 Excel \/ WPS）/u);
});

test("replace knowledge revision content blocks sends table evidence payload as-is without table semantics", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const client = {
    async request<TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) {
      requests.push(input);
      return { status: 200, body: {} as TResponse };
    },
  };

  await replaceKnowledgeRevisionContentBlocks(client, "knowledge-revision-1", {
    blocks: [
      {
        id: "block-1",
        revision_id: "knowledge-revision-1",
        block_type: "table_evidence_block",
        order_no: 0,
        status: "active",
        content_payload: {
          table_evidence_asset_id: "asset-1",
          table_evidence_revision_id: "table-revision-1",
          nested: { keep: true },
        },
        table_semantics: {
          exact_capture_authoritative: true,
        },
      },
    ],
  });

  assert.deepEqual(requests[0]?.body, {
    blocks: [
      {
        blockType: "table_evidence_block",
        orderNo: 0,
        contentPayload: {
          table_evidence_asset_id: "asset-1",
          table_evidence_revision_id: "table-revision-1",
          nested: { keep: true },
        },
      },
    ],
  });
});
