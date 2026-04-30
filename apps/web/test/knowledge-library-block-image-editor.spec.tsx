import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

const {
  KnowledgeLibraryBlockImageEditor,
  buildImageUnderstanding,
  getImageUploadGuardMessage,
} = await import(
  "../src/features/knowledge-library/knowledge-library-block-image-editor.tsx"
);

test("image block editor builds a visual symbol snapshot for object-type evidence", () => {
  assert.deepEqual(
    buildImageUnderstanding({
      upload_id: "upload-1",
      source_kind: "inline_symbol_image",
      normalized_candidate_symbol: "χ²",
      candidate_confidence: 0.92,
      local_context: "统计方法段落",
      nearby_text: "采用 χ² 检验比较组间差异。",
      review_state: "pending_review",
      caption: "作者用图片代替卡方符号",
    }),
    {
      snapshot_type: "visual_symbol_snapshot",
      source_kind: "inline_symbol_image",
      normalized_candidate_symbol: "χ²",
      candidate_confidence: 0.92,
      local_context: "统计方法段落",
      nearby_text: "采用 χ² 检验比较组间差异。",
      review_state: "pending_review",
      caption: "作者用图片代替卡方符号",
      image_id: "upload-1",
    },
  );
});

test("image block editor renders visual symbol guidance and structured fields", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeLibraryBlockImageEditor
      block={{
        id: "block-1",
        revision_id: "revision-1",
        block_type: "image_block",
        order_no: 2,
        status: "active",
        content_payload: {
          file_name: "chi-square.png",
          mime_type: "image/png",
          byte_length: 1024,
          storage_key: "knowledge/rich-space/chi-square.png",
          caption: "作者用图片代替卡方符号",
          source_kind: "inline_symbol_image",
          normalized_candidate_symbol: "χ²",
          candidate_confidence: 0.92,
          local_context: "统计方法段落",
          nearby_text: "采用 χ² 检验比较组间差异。",
          review_state: "pending_review",
        },
      }}
      onChange={() => {}}
      onUploadImage={async () => undefined}
    />,
  );

  assert.match(markup, /视觉符号快照/u);
  assert.match(markup, /证据类型/u);
  assert.match(markup, /候选符号/u);
  assert.match(markup, /邻近文本/u);
  assert.match(markup, /对象型问题/u);
  assert.match(markup, /χ²/u);
});

test("image block editor directs DOCX uploads to Word table evidence", () => {
  assert.equal(
    getImageUploadGuardMessage({
      name: "table.docx",
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
    "这是 Word 文档。请点击“Word 表格证据”上传 .docx，系统会解析表格并打开预览确认区。",
  );

  assert.equal(
    getImageUploadGuardMessage({ name: "figure.png", type: "image/png" }),
    null,
  );
});
