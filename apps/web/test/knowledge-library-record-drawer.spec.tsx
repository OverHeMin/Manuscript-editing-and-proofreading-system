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

test("knowledge library record drawer renders compact Chinese revision and editor framing", () => {
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

  assert.match(markup, /记录抽屉/);
  assert.match(markup, /打开审核台/);
  assert.match(markup, /贡献账号/);
  assert.match(markup, /版本时间线/);
  assert.match(markup, /记录编辑区/);
  assert.match(markup, /editor\.zh/);
});

test("knowledge library rich content editor renders text, table, and image blocks with add actions", () => {
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

  assert.match(markup, /Rich Content/);
  assert.match(markup, /Add Text Block/);
  assert.match(markup, /Add Table Block/);
  assert.match(markup, /Add Image Block/);
  assert.match(markup, /Text Block/);
  assert.match(markup, /Table Block/);
  assert.match(markup, /Image Block/);
  assert.match(markup, /Primary endpoint/);
  assert.match(markup, /endpoint-figure\.png/);
  assert.match(markup, /knowledge\/rich-space\/endpoint-figure\.png/);
});
