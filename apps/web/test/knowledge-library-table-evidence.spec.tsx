import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

const {
  KnowledgeLibraryRichContentEditor,
  createKnowledgeLibraryContentBlockForAction,
  appendKnowledgeLibraryTableEvidenceBlock,
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

test("knowledge library table evidence selection requires a real knowledge revision before binding", async () => {
  const requests: unknown[] = [];
  const errors: string[] = [];
  const changes: unknown[] = [];
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
    },
    onChange: (nextBlocks) => changes.push(nextBlocks),
    onError: (message) => errors.push(message),
  });

  assert.deepEqual(requests, []);
  assert.deepEqual(changes, []);
  assert.deepEqual(errors, ["请先保存草稿后再添加 Word 表格证据"]);

  await assert.rejects(
    () =>
      appendKnowledgeLibraryTableEvidenceBlock({
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
      }),
    /请先保存草稿后再添加 Word 表格证据/u,
  );
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
