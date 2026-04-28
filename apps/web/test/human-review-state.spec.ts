import test from "node:test";
import assert from "node:assert/strict";
import {
  batchUpdateHumanReviewDiffDecisions,
  listHumanReviewDiffItems,
  publishHumanReviewFinal,
  retryHumanReviewBackflow,
  updateHumanReviewDiffDecision,
} from "../src/features/human-review/human-review-api.ts";
import type { HumanReviewDiffItemViewModel } from "../src/features/human-review/types.ts";
import {
  applyHumanReviewBatchDecision,
  filterHumanReviewDiffItems,
  summarizeHumanReviewDiffItems,
} from "../src/features/human-review/human-review-state.ts";

function createItem(
  overrides: Partial<HumanReviewDiffItemViewModel> = {},
): HumanReviewDiffItemViewModel {
  return {
    id: "diff-1",
    module: "proofreading",
    manuscript_id: "manuscript-1",
    baseline_asset_id: "asset-base",
    working_asset_id: "asset-work",
    source: "human_overrode_ai",
    content_decision: "unconfirmed",
    governance_intents: {
      rule_candidate: false,
      knowledge_candidate: false,
    },
    apply_capability: "auto_apply_revert",
    status: "pending",
    before_text: "ALT remained stable.",
    after_text: "Serum ALT remained stable.",
    created_at: "2026-04-28T00:00:00.000Z",
    updated_at: "2026-04-28T00:00:00.000Z",
    ...overrides,
  };
}

test("human review state filters unconfirmed queue items", () => {
  const items = [
    createItem({ id: "diff-1", content_decision: "unconfirmed" }),
    createItem({ id: "diff-2", content_decision: "keep", status: "confirmed" }),
  ];

  const selected = filterHumanReviewDiffItems(items, {
    status: "unconfirmed",
  });

  assert.deepEqual(
    selected.map((item) => item.id),
    ["diff-1"],
  );
});

test("human review state applies batch content and governance decisions immutably", () => {
  const selected = [
    createItem({ id: "diff-1", content_decision: "unconfirmed" }),
    createItem({ id: "diff-2", content_decision: "defer" }),
  ];

  const updated = applyHumanReviewBatchDecision(selected, {
    content_decision: "keep",
    governance_intents: {
      rule_candidate: true,
      knowledge_candidate: false,
    },
  });

  assert.deepEqual(
    updated.map((item) => item.content_decision),
    ["keep", "keep"],
  );
  assert.equal(updated[0]?.governance_intents.rule_candidate, true);
  assert.equal(selected[0]?.content_decision, "unconfirmed");
  assert.equal(selected[0]?.governance_intents.rule_candidate, false);
});

test("human review state summarizes publish blockers and backflow intents", () => {
  const summary = summarizeHumanReviewDiffItems([
    createItem({ id: "diff-unconfirmed", content_decision: "unconfirmed" }),
    createItem({ id: "diff-defer", content_decision: "defer" }),
    createItem({
      id: "diff-unsafe",
      content_decision: "keep",
      apply_capability: "unsafe_needs_manual_review",
      status: "blocks_publish",
    }),
    createItem({
      id: "diff-rule",
      content_decision: "keep",
      status: "confirmed",
      governance_intents: { rule_candidate: true, knowledge_candidate: false },
    }),
    createItem({
      id: "diff-knowledge",
      content_decision: "reject",
      status: "confirmed",
      governance_intents: { rule_candidate: false, knowledge_candidate: true },
    }),
    createItem({
      id: "diff-backflow-failed",
      content_decision: "keep",
      status: "writeback_failed",
      governance_intents: { rule_candidate: true, knowledge_candidate: true },
      backflow_error: "candidate service unavailable",
    }),
  ]);

  assert.equal(summary.total_count, 6);
  assert.equal(summary.unconfirmed_count, 1);
  assert.equal(summary.deferred_count, 1);
  assert.equal(summary.unsafe_blocking_count, 1);
  assert.equal(summary.rule_intent_count, 2);
  assert.equal(summary.knowledge_intent_count, 2);
  assert.equal(summary.backflow_failed_count, 1);
  assert.equal(summary.can_publish, false);
});

test("human review api client uses the backend human-review route contract", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const client = {
    async request<TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) {
      requests.push(input);
      return { status: 200, body: [] as TResponse };
    },
  };

  await listHumanReviewDiffItems(client, {
    manuscriptId: "manuscript-1",
    module: "proofreading",
  });
  await updateHumanReviewDiffDecision(client, {
    diffItemId: "diff-1",
    contentDecision: "keep",
    governanceIntents: { rule_candidate: true, knowledge_candidate: false },
    note: "Confirmed in OnlyOffice.",
  });
  await batchUpdateHumanReviewDiffDecisions(client, {
    updates: [
      {
        diffItemId: "diff-2",
        contentDecision: "reject",
        governanceIntents: {
          rule_candidate: false,
          knowledge_candidate: true,
        },
      },
    ],
  });
  await publishHumanReviewFinal(client, {
    manuscriptId: "manuscript-1",
    module: "proofreading",
    outputStorageKey: "runs/final.docx",
    outputFileName: "final.docx",
  });
  await retryHumanReviewBackflow(client, "diff-3");

  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "GET /api/v1/human-review/diff-items?manuscriptId=manuscript-1&module=proofreading",
      "POST /api/v1/human-review/diff-items/diff-1/decision",
      "POST /api/v1/human-review/diff-items/batch-decisions",
      "POST /api/v1/human-review/publish-final",
      "POST /api/v1/human-review/diff-items/diff-3/retry-backflow",
    ],
  );
  assert.deepEqual(requests[1]?.body, {
    contentDecision: "keep",
    governanceIntents: { rule_candidate: true, knowledge_candidate: false },
    note: "Confirmed in OnlyOffice.",
  });
  assert.deepEqual(requests[2]?.body, {
    updates: [
      {
        diffItemId: "diff-2",
        contentDecision: "reject",
        governanceIntents: {
          rule_candidate: false,
          knowledge_candidate: true,
        },
      },
    ],
  });
  assert.deepEqual(requests[3]?.body, {
    manuscriptId: "manuscript-1",
    module: "proofreading",
    outputStorageKey: "runs/final.docx",
    outputFileName: "final.docx",
  });
});
