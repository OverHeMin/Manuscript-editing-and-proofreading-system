import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryHumanReviewRepository } from "../../src/modules/human-review/in-memory-human-review-repository.ts";
import type { HumanReviewDiffRecord } from "../../src/modules/human-review/human-review-record.ts";

test("human review repository stores and updates diff decisions", async () => {
  const repository = new InMemoryHumanReviewRepository();
  await repository.saveDiffItem({
    id: "diff-1",
    module: "proofreading",
    manuscript_id: "manuscript-1",
    baseline_asset_id: "asset-base",
    working_asset_id: "asset-work",
    source: "human_added",
    content_decision: "unconfirmed",
    governance_intents: { rule_candidate: false, knowledge_candidate: false },
    apply_capability: "auto_apply_revert",
    status: "pending",
    before_text: "A",
    after_text: "B",
    created_at: "2026-04-28T00:00:00.000Z",
    updated_at: "2026-04-28T00:00:00.000Z",
  });

  const listed = await repository.listDiffItems({
    manuscriptId: "manuscript-1",
    module: "proofreading",
  });
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.content_decision, "unconfirmed");

  const updated = await repository.updateDiffItem("diff-1", {
    content_decision: "keep",
    governance_intents: { rule_candidate: true, knowledge_candidate: true },
    note: "Human reviewer confirmed keep with rule and knowledge candidates.",
    status: "confirmed",
    updated_at: "2026-04-28T00:10:00.000Z",
  });

  assert.equal(updated?.content_decision, "keep");
  assert.deepEqual(updated?.governance_intents, {
    rule_candidate: true,
    knowledge_candidate: true,
  });

  const confirmed = await repository.listDiffItems({
    manuscriptId: "manuscript-1",
    status: "confirmed",
  });
  assert.deepEqual(confirmed.map((item) => item.id), ["diff-1"]);
});

test("human review repository clones diff item objects on read and write", async () => {
  const repository = new InMemoryHumanReviewRepository();
  const sourceItem: HumanReviewDiffRecord = {
    id: "diff-clone",
    module: "editing",
    manuscript_id: "manuscript-1",
    baseline_asset_id: "asset-base",
    working_asset_id: "asset-work",
    source: "human_overrode_ai",
    content_decision: "unconfirmed",
    governance_intents: { rule_candidate: false, knowledge_candidate: true },
    apply_capability: "unsafe_needs_manual_review",
    complexity_flags: ["table_structure"],
    status: "blocks_publish",
    location: { anchor_kind: "table_cell", quote: "Original quote" },
    summary: "Complex table cell edit.",
    created_at: "2026-04-28T00:00:00.000Z",
    updated_at: "2026-04-28T00:00:00.000Z",
  };

  await repository.saveDiffItem(sourceItem);
  sourceItem.governance_intents.knowledge_candidate = false;
  sourceItem.complexity_flags!.push("locator_fallback");
  sourceItem.location!.quote = "Mutated quote";

  const firstRead = await repository.findDiffItemById("diff-clone");
  assert.equal(firstRead?.governance_intents.knowledge_candidate, true);
  assert.deepEqual(firstRead?.complexity_flags, ["table_structure"]);
  assert.equal(firstRead?.location?.quote, "Original quote");

  firstRead!.governance_intents.rule_candidate = true;
  firstRead!.complexity_flags!.push("locator_fallback");
  firstRead!.location!.quote = "Mutated from read";

  const secondRead = await repository.findDiffItemById("diff-clone");
  assert.equal(secondRead?.governance_intents.rule_candidate, false);
  assert.deepEqual(secondRead?.complexity_flags, ["table_structure"]);
  assert.equal(secondRead?.location?.quote, "Original quote");
});

test("human review repository stores candidate backflow attempts", async () => {
  const repository = new InMemoryHumanReviewRepository();
  await repository.saveBackflowAttempt({
    id: "attempt-1",
    diff_item_id: "diff-1",
    target: "rule_candidate",
    status: "failed",
    error_message: "rule service unavailable",
    created_at: "2026-04-28T00:00:00.000Z",
    updated_at: "2026-04-28T00:00:00.000Z",
  });

  const failedAttempts = await repository.listBackflowAttemptsByDiffItemId("diff-1");
  assert.equal(failedAttempts.length, 1);
  assert.equal(failedAttempts[0]?.status, "failed");

  await repository.saveBackflowAttempt({
    ...failedAttempts[0]!,
    status: "succeeded",
    learning_candidate_id: "candidate-1",
    error_message: undefined,
    updated_at: "2026-04-28T00:05:00.000Z",
  });

  const retriedAttempts = await repository.listBackflowAttemptsByDiffItemId("diff-1");
  assert.equal(retriedAttempts.length, 1);
  assert.equal(retriedAttempts[0]?.status, "succeeded");
  assert.equal(retriedAttempts[0]?.learning_candidate_id, "candidate-1");
  assert.equal(retriedAttempts[0]?.error_message, undefined);
});
