import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

register(new URL("./helpers/ignore-css-loader.mjs", import.meta.url), import.meta.url);

const {
  KnowledgeLibraryRecordDrawer,
} = await import("../src/features/knowledge-library/knowledge-library-record-drawer.tsx");

const {
  KnowledgeLibraryRichContentEditor,
} = await import("../src/features/knowledge-library/knowledge-library-rich-content-editor.tsx");

test("knowledge library record drawer renders the selected revision context and review link", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeLibraryRecordDrawer
      detail={{
        asset: {
          id: "knowledge-1",
          status: "active",
          current_revision_id: "knowledge-1-revision-2",
          current_approved_revision_id: "knowledge-1-revision-1",
          created_at: "2026-04-08T08:00:00.000Z",
          updated_at: "2026-04-08T08:30:00.000Z",
          contributor_label: "editor.zh",
        },
        selected_revision: {
          id: "knowledge-1-revision-2",
          asset_id: "knowledge-1",
          revision_no: 2,
          status: "draft",
          title: "Primary endpoint rule draft",
          canonical_text:
            "Clinical studies must define the primary endpoint before screening sign-off.",
          knowledge_kind: "rule",
          content_blocks: [],
          routing: {
            module_scope: "screening",
            manuscript_types: ["clinical_study"],
          },
          bindings: [],
          created_at: "2026-04-08T08:30:00.000Z",
          updated_at: "2026-04-08T08:30:00.000Z",
          contributor_label: "editor.zh",
        },
        current_approved_revision: {
          id: "knowledge-1-revision-1",
          asset_id: "knowledge-1",
          revision_no: 1,
          status: "approved",
          title: "Primary endpoint rule",
          canonical_text: "Clinical studies must define the primary endpoint.",
          knowledge_kind: "rule",
          content_blocks: [],
          routing: {
            module_scope: "screening",
            manuscript_types: ["clinical_study"],
          },
          bindings: [],
          created_at: "2026-04-08T08:00:00.000Z",
          updated_at: "2026-04-08T08:10:00.000Z",
          contributor_label: "reviewer.zh",
        },
        revisions: [
          {
            id: "knowledge-1-revision-2",
            asset_id: "knowledge-1",
            revision_no: 2,
            status: "draft",
            title: "Primary endpoint rule draft",
            canonical_text:
              "Clinical studies must define the primary endpoint before screening sign-off.",
            knowledge_kind: "rule",
            content_blocks: [],
            routing: {
              module_scope: "screening",
              manuscript_types: ["clinical_study"],
            },
            bindings: [],
            created_at: "2026-04-08T08:30:00.000Z",
            updated_at: "2026-04-08T08:30:00.000Z",
            contributor_label: "editor.zh",
          },
          {
            id: "knowledge-1-revision-1",
            asset_id: "knowledge-1",
            revision_no: 1,
            status: "approved",
            title: "Primary endpoint rule",
            canonical_text: "Clinical studies must define the primary endpoint.",
            knowledge_kind: "rule",
            content_blocks: [],
            routing: {
              module_scope: "screening",
              manuscript_types: ["clinical_study"],
            },
            bindings: [],
            created_at: "2026-04-08T08:00:00.000Z",
            updated_at: "2026-04-08T08:10:00.000Z",
            contributor_label: "reviewer.zh",
          },
        ],
      }}
      selectedAssetId="knowledge-1"
      selectedRevisionId="knowledge-1-revision-2"
      reviewHash="#knowledge-review?revisionId=knowledge-1-revision-2"
      onSelectRevision={() => undefined}
    >
      <section>
        <h3>记录编辑区</h3>
      </section>
    </KnowledgeLibraryRecordDrawer>,
  );

  assert.match(markup, /knowledge-library-record-drawer/);
  assert.match(markup, /href="#knowledge-review\?revisionId=knowledge-1-revision-2"/);
  assert.match(markup, /knowledge-1-revision-2/);
  assert.match(markup, /Primary endpoint rule draft/);
  assert.match(markup, /editor\.zh/);
});

test("knowledge library rich content editor renders text, table, and image blocks with stable action hooks", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeLibraryRichContentEditor
      blocks={[
        {
          id: "block-1",
          revision_id: "knowledge-1-revision-2",
          block_type: "text_block",
          order_no: 0,
          status: "active",
          content_payload: {
            text: "Clinical studies must define the primary endpoint before screening.",
          },
        },
        {
          id: "block-2",
          revision_id: "knowledge-1-revision-2",
          block_type: "table_block",
          order_no: 1,
          status: "active",
          content_payload: {
            rows: [
              ["Field", "Rule"],
              ["Primary endpoint", "Required before screening"],
            ],
          },
        },
        {
          id: "block-3",
          revision_id: "knowledge-1-revision-2",
          block_type: "image_block",
          order_no: 2,
          status: "active",
          content_payload: {
            upload_id: "upload-1",
            file_name: "endpoint-figure.png",
            mime_type: "image/png",
            byte_length: 2048,
            storage_key: "knowledge/rich-space/endpoint-figure.png",
          },
        },
      ]}
      onChange={() => undefined}
      onUploadImage={async () => undefined}
    />,
  );

  assert.match(markup, /data-material-editor="blocks"/);
  assert.match(markup, /data-block-action="add-text"/);
  assert.match(markup, /data-block-action="add-table"/);
  assert.match(markup, /data-block-action="add-image"/);
  assert.match(markup, /data-block-type="text_block"/);
  assert.match(markup, /data-block-type="table_block"/);
  assert.match(markup, /data-block-type="image_block"/);
  assert.match(markup, /Primary endpoint/);
  assert.match(markup, /endpoint-figure\.png/);
  assert.match(markup, /knowledge\/rich-space\/endpoint-figure\.png/);
  assert.match(markup, /添加补充文字/u);
  assert.match(markup, /添加表格/u);
  assert.match(markup, /添加图片或截图/u);
  assert.match(markup, /表格支持直接粘贴 Excel \/ WPS/u);
  assert.match(markup, /上传图片或截图/u);
  assert.match(markup, /图片说明/u);
  assert.match(markup, /表格内容（支持直接粘贴 Excel \/ WPS）/u);
});
