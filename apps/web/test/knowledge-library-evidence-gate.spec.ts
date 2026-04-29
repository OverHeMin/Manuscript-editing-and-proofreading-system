import assert from "node:assert/strict";
import test from "node:test";

const { createKnowledgeLibraryEvidenceGateSummary } = await import(
  "../src/features/knowledge-library/knowledge-library-evidence-gate.ts"
);

test("knowledge library evidence gate blocks submit review when exact-capture or visual-symbol evidence is incomplete", () => {
  const summary = createKnowledgeLibraryEvidenceGateSummary({
    releaseAction: "submit_review",
    blocks: [
      {
        id: "table-1",
        revision_id: "revision-1",
        block_type: "table_block",
        order_no: 0,
        status: "active",
        content_payload: {
          capture_mode: "plain_text_grid",
          rows: [["A", "B"]],
          exact_capture_failure_codes: [
            "merged_cell_map_incomplete",
            "border_profile_incomplete",
          ],
        },
      },
      {
        id: "image-1",
        revision_id: "revision-1",
        block_type: "image_block",
        order_no: 1,
        status: "active",
        content_payload: {
          source_kind: "inline_symbol_image",
        },
      },
    ],
  });

  assert.equal(summary.itemCount, 2);
  assert.equal(summary.blockingItemCount, 2);
  assert.equal(summary.readyItemCount, 0);
  assert.equal(summary.hasBlockingIssues, true);
  assert.match(
    summary.items[0]?.detail ?? "",
    /合并单元格信息不完整.*边框轮廓不完整/u,
  );
  assert.match(summary.items[1]?.detail ?? "", /缺少结构化视觉符号证据/u);
  assert.match(summary.blockingMessage ?? "", /表格块 #1/u);
});

test("knowledge library evidence gate keeps draft save non-blocking and blocks legacy table authority flags", () => {
  const saveDraftSummary = createKnowledgeLibraryEvidenceGateSummary({
    releaseAction: "save_draft",
    blocks: [
      {
        id: "table-1",
        revision_id: "revision-1",
        block_type: "table_block",
        order_no: 0,
        status: "active",
        content_payload: {
          capture_mode: "plain_text_grid",
          rows: [["A", "B"]],
          exact_capture_failure_codes: ["run_style_incomplete"],
        },
      },
    ],
  });

  assert.equal(saveDraftSummary.hasBlockingIssues, false);
  assert.equal(saveDraftSummary.items[0]?.blocking, false);
  assert.equal(saveDraftSummary.items[0]?.statusLabel, "草稿可保存");
  assert.match(
    saveDraftSummary.items[0]?.detail ?? "",
    /当前可先存草稿，提交审核前仍需补齐/u,
  );

  const readySubmitSummary = createKnowledgeLibraryEvidenceGateSummary({
    releaseAction: "submit_review",
    blocks: [
      {
        id: "table-2",
        revision_id: "revision-1",
        block_type: "table_block",
        order_no: 0,
        status: "active",
        content_payload: {
          capture_mode: "html_table_clipboard",
          exact_capture_failure_codes: [],
        },
        table_semantics: {
          exact_capture_authoritative: true,
          exact_capture_failure_codes: [],
        },
      },
      {
        id: "image-2",
        revision_id: "revision-1",
        block_type: "image_block",
        order_no: 1,
        status: "active",
        content_payload: {
          source_kind: "inline_symbol_image",
          upload_id: "upload-image-2",
        },
        image_understanding: {
          snapshot_type: "visual_symbol_snapshot",
          source_kind: "inline_symbol_image",
          review_state: "pending_review",
          local_context: "统计方法段落中的检验名称",
          image_id: "upload-image-2",
        },
      },
    ],
  });

  assert.equal(readySubmitSummary.itemCount, 2);
  assert.equal(readySubmitSummary.hasBlockingIssues, true);
  assert.equal(readySubmitSummary.readyItemCount, 1);
  assert.equal(readySubmitSummary.blockingItemCount, 1);
  assert.equal(readySubmitSummary.items[0]?.statusLabel, "阻断提交审核");
  assert.match(readySubmitSummary.items[0]?.detail ?? "", /Word 表格证据/u);
  assert.equal(readySubmitSummary.items[1]?.statusLabel, "可提交审核");
  assert.match(readySubmitSummary.blockingMessage ?? "", /表格块 #1/u);
});

test("knowledge library evidence gate allows confirmed table evidence blocks", () => {
  const summary = createKnowledgeLibraryEvidenceGateSummary({
    releaseAction: "submit_review",
    blocks: [
      {
        id: "table-evidence-1",
        revision_id: "revision-1",
        block_type: "table_evidence_block",
        order_no: 0,
        status: "active",
        content_payload: {
          table_evidence_asset_id: "asset-1",
          table_evidence_revision_id: "table-revision-1",
          revision_status: "confirmed",
        },
      },
    ],
  });

  assert.equal(summary.itemCount, 1);
  assert.equal(summary.hasBlockingIssues, false);
  assert.equal(summary.readyItemCount, 1);
  assert.equal(summary.items[0]?.statusLabel, "可提交审核");
});

test("knowledge library evidence gate blocks unconfirmed or unloaded table evidence status", () => {
  const summary = createKnowledgeLibraryEvidenceGateSummary({
    releaseAction: "submit_review",
    blocks: [
      {
        id: "table-evidence-1",
        revision_id: "revision-1",
        block_type: "table_evidence_block",
        order_no: 0,
        status: "active",
        content_payload: {
          table_evidence_asset_id: "asset-1",
          table_evidence_revision_id: "table-revision-1",
          revision_status: "pending",
        },
      },
      {
        id: "table-evidence-2",
        revision_id: "revision-1",
        block_type: "table_evidence_block",
        order_no: 1,
        status: "active",
        content_payload: {
          table_evidence_asset_id: "asset-2",
          table_evidence_revision_id: "table-revision-2",
          revision_status: "needs_review",
        },
      },
      {
        id: "table-evidence-3",
        revision_id: "revision-1",
        block_type: "table_evidence_block",
        order_no: 2,
        status: "active",
        content_payload: {
          table_evidence_asset_id: "asset-3",
          table_evidence_revision_id: "table-revision-3",
        },
        table_semantics: {
          exact_capture_authoritative: true,
        },
      },
    ],
  });

  assert.equal(summary.itemCount, 3);
  assert.equal(summary.blockingItemCount, 3);
  assert.equal(summary.hasBlockingIssues, true);
  assert.match(summary.items[0]?.detail ?? "", /表格证据状态未确认/u);
  assert.match(summary.items[1]?.detail ?? "", /表格证据状态未确认/u);
  assert.match(summary.items[2]?.detail ?? "", /表格证据状态未确认/u);
  assert.doesNotMatch(summary.items[2]?.detail ?? "", /exact-capture/u);
  assert.match(summary.blockingMessage ?? "", /高精度证据/u);
});
