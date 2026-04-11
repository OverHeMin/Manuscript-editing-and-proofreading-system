import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

register(new URL("./helpers/ignore-css-loader.mjs", import.meta.url), import.meta.url);

const {
  KnowledgeLibraryRichContentEditor,
} = await import("../src/features/knowledge-library/knowledge-library-rich-content-editor.tsx");

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
