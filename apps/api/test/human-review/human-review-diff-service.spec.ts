import test from "node:test";
import assert from "node:assert/strict";
import { HumanReviewDiffService } from "../../src/modules/human-review/human-review-diff-service.ts";

function createService() {
  let id = 0;
  return new HumanReviewDiffService({
    createId: () => `diff-${++id}`,
    now: () => new Date("2026-04-28T00:00:00.000Z"),
  });
}

test("human review diff extraction records paragraph insertions", () => {
  const service = createService();

  const result = service.extractDiffItems({
    manuscriptId: "manuscript-1",
    module: "proofreading",
    baselineAssetId: "asset-base",
    workingAssetId: "asset-work",
    baselineBlocks: [],
    workingBlocks: [
      {
        key: "p1",
        kind: "paragraph",
        text: "新增人工修改。",
        block_index: 0,
      },
    ],
  });

  assert.deepEqual(
    result.items.map((item) => ({
      source: item.source,
      before: item.before_text,
      after: item.after_text,
      capability: item.apply_capability,
      status: item.status,
    })),
    [
      {
        source: "human_added",
        before: "",
        after: "新增人工修改。",
        capability: "auto_apply_revert",
        status: "pending",
      },
    ],
  );
});

test("human review diff extraction records paragraph replacement and deletion", () => {
  const service = createService();

  const result = service.extractDiffItems({
    manuscriptId: "manuscript-1",
    module: "editing",
    baselineAssetId: "asset-base",
    workingAssetId: "asset-work",
    baselineBlocks: [
      { key: "p1", kind: "paragraph", text: "ALT remained stable.", block_index: 0 },
      { key: "p2", kind: "paragraph", text: "Delete this sentence.", block_index: 1 },
    ],
    workingBlocks: [
      {
        key: "p1",
        kind: "paragraph",
        text: "Serum ALT remained stable.",
        block_index: 0,
      },
    ],
    extractionRevision: 3,
  });

  assert.deepEqual(
    result.items.map((item) => ({
      source: item.source,
      before: item.before_text,
      after: item.after_text,
      revision: item.extraction_revision,
    })),
    [
      {
        source: "human_overrode_ai",
        before: "ALT remained stable.",
        after: "Serum ALT remained stable.",
        revision: 3,
      },
      {
        source: "human_reverted_ai",
        before: "Delete this sentence.",
        after: "",
        revision: 3,
      },
    ],
  );
});

test("human review diff extraction treats simple table-cell text replacement as safe", () => {
  const service = createService();

  const result = service.extractDiffItems({
    manuscriptId: "manuscript-1",
    module: "proofreading",
    baselineAssetId: "asset-base",
    workingAssetId: "asset-work",
    baselineBlocks: [
      {
        key: "table-1:r1:c1",
        kind: "table_cell",
        text: "5 mg per dL",
        table_id: "table-1",
        row_key: "r1",
        column_key: "c1",
      },
    ],
    workingBlocks: [
      {
        key: "table-1:r1:c1",
        kind: "table_cell",
        text: "5 mg/dL",
        table_id: "table-1",
        row_key: "r1",
        column_key: "c1",
      },
    ],
  });

  assert.equal(result.items[0]?.apply_capability, "auto_apply_revert");
  assert.equal(result.items[0]?.location?.anchor_kind, "table_cell");
  assert.equal(result.items[0]?.location?.table_id, "table-1");
});

test("human review diff extraction blocks unsupported structural differences", () => {
  const service = createService();

  const result = service.extractDiffItems({
    manuscriptId: "manuscript-1",
    module: "proofreading",
    baselineAssetId: "asset-base",
    workingAssetId: "asset-work",
    baselineBlocks: [
      {
        key: "table-structure-1",
        kind: "table",
        text: "2 columns",
        block_index: 2,
      },
    ],
    workingBlocks: [
      {
        key: "table-structure-1",
        kind: "table",
        text: "3 columns",
        block_index: 2,
      },
    ],
  });

  assert.equal(result.items[0]?.apply_capability, "unsafe_needs_manual_review");
  assert.equal(result.items[0]?.status, "blocks_publish");
  assert.deepEqual(result.items[0]?.complexity_flags, ["table_structure"]);
  assert.match(result.items[0]?.summary ?? "", /manual review/u);
});
