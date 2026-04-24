import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

const {
  KnowledgeLibraryBlockTableEditor,
  buildTableBlockContentPayload,
  buildTableBlockContentPayloadFromClipboard,
  buildTableBlockTableSemantics,
  deriveTableExactCaptureFailureCodes,
} = await import(
  "../src/features/knowledge-library/knowledge-library-block-table-editor.tsx"
);

test("table block payload records non-authoritative exact-capture failure codes", () => {
  const payload = buildTableBlockContentPayload({
    previousPayload: {},
    gridText: "A\tB\n1\t2",
    clipboardTypes: ["text/plain"],
  });

  assert.deepEqual(payload.rows, [
    ["A", "B"],
    ["1", "2"],
  ]);
  assert.equal(payload.capture_mode, "plain_text_grid");
  assert.deepEqual(payload.clipboard_types, ["text/plain"]);
  assert.deepEqual(payload.exact_capture_failure_codes, [
    "missing_required_clipboard_flavor",
    "merged_cell_map_incomplete",
    "caption_or_note_position_unknown",
    "border_profile_incomplete",
    "alignment_profile_incomplete",
    "run_style_incomplete",
    "exact_capture_not_authoritative",
  ]);
});

test("table exact-capture helper clears field-completeness failures when structured facts are present", () => {
  const failures = deriveTableExactCaptureFailureCodes({
    payload: {
      rows: [["A", "B"]],
      capture_mode: "html_table_clipboard",
      capture_environment: "windows_chromium",
      source_application: "word",
      clipboard_types: ["text/html", "text/plain", "text/rtf"],
      merged_cell_state: "none",
      caption_position: "above",
      note_position: "below",
      border_profile: "顶线，表头分隔线，底线，无竖线",
      alignment_profile: "表头居中，正文右对齐",
      run_style_signals: "斜体, 上标",
    },
  });

  assert.deepEqual(failures, []);
});

test("html clipboard table intake captures structured facts and semantics", () => {
  const payload = buildTableBlockContentPayloadFromClipboard({
    previousPayload: {},
    plainText: "指标\t值\n年龄\t12",
    htmlText: [
      '<p class="MsoNormal">表 1 基线特征</p>',
      '<table style="border-top:1px solid black;border-bottom:1px solid black;border-left:none;border-right:none">',
      '<tr><th style="text-align:center;border-bottom:1px solid black"><i>指标</i></th><th style="text-align:center;border-bottom:1px solid black">值<sup>a</sup></th></tr>',
      '<tr><td>年龄</td><td style="text-align:right">12</td></tr>',
      "</table>",
      '<p class="MsoNormal">注：年龄单位为岁。</p>',
    ].join(""),
    clipboardTypes: ["text/html", "text/plain", "text/rtf"],
    captureEnvironment: "windows_chromium",
  });

  assert.equal(payload.capture_mode, "html_table_clipboard");
  assert.equal(payload.capture_environment, "windows_chromium");
  assert.equal(payload.source_application, "word");
  assert.equal(payload.caption, "表 1 基线特征");
  assert.equal(payload.caption_position, "above");
  assert.equal(payload.note, "注：年龄单位为岁。");
  assert.equal(payload.note_position, "below");
  assert.equal(payload.merged_cell_state, "none");
  assert.equal(payload.run_style_signals, "斜体, 上标");
  assert.deepEqual(payload.exact_capture_failure_codes, []);

  assert.deepEqual(buildTableBlockTableSemantics(payload), {
    snapshot_type: "table_style_snapshot",
    capture_mode: "html_table_clipboard",
    capture_environment: "windows_chromium",
    source_application: "word",
    exact_capture_authoritative: true,
    exact_capture_failure_codes: [],
    row_count: 2,
    column_count: 2,
    merged_cell_state: "none",
    merged_cells: [],
    caption: {
      text: "表 1 基线特征",
      position: "above",
    },
    note: {
      text: "注：年龄单位为岁。",
      position: "below",
    },
    header_depth: "1",
    stub_column_count: "0",
    border_profile: "顶线，表头分隔线，底线，无竖线",
    alignment_profile: "表头居中，正文左对齐/右对齐",
    run_style_signals: ["斜体", "上标"],
  });
});

test("table block editor renders exact-capture status guidance", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeLibraryBlockTableEditor
      block={{
        id: "block-1",
        revision_id: "revision-1",
        block_type: "table_block",
        order_no: 1,
        status: "active",
        content_payload: {
          rows: [["A", "B"]],
          capture_mode: "html_table_clipboard",
          capture_environment: "windows_chromium",
          source_application: "word",
          merged_cell_state: "none",
          caption_position: "above",
          note_position: "below",
          border_profile: "顶线，表头分隔线，底线，无竖线",
          alignment_profile: "表头居中，正文左对齐/右对齐",
          run_style_signals: "斜体, 上标",
        },
      }}
      onChange={() => {}}
    />,
  );

  assert.match(markup, /Exact-capture 状态/u);
  assert.match(markup, /HTML 表格采集/u);
  assert.match(markup, /Windows \+ Chrome\/Edge/u);
  assert.match(markup, /是否权威 exact-capture/u);
  assert.match(markup, /当前表格已满足 exact-capture/u);
});
