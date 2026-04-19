import test from "node:test";
import assert from "node:assert/strict";
import { createReviewItemsApi } from "../../src/modules/review-items/review-items-api.ts";
import type {
  GovernedHitReviewItemRecord,
  ReviewItemRecord,
} from "../../src/modules/review-items/review-item-record.ts";
import type { SubmitGovernedHitInput } from "../../src/modules/review-items/review-items-service.ts";

function buildGovernedHit(
  overrides: Partial<GovernedHitReviewItemRecord> = {},
): GovernedHitReviewItemRecord {
  return {
    id: "governed-hit-1",
    source_kind: "governed_hit",
    source_status: "submitted",
    review_status: "pending",
    module: "editing",
    manuscript_id: "manuscript-1",
    manuscript_type: "clinical_study",
    snapshot_id: "snapshot-1",
    source_asset_id: "asset-1",
    title: "Submit missed governed hit for review",
    summary: "Route the governed hit through unified review first.",
    created_at: "2026-04-18T07:58:00.000Z",
    updated_at: "2026-04-18T07:58:00.000Z",
    available_actions: [
      "accept_change_only",
      "reject_as_false_positive",
      "route_to_rule_candidate",
      "route_to_knowledge_candidate",
      "route_to_prompt_candidate",
      "archive_as_evidence_only",
    ],
    feedback_category: "missed_hit",
    feedback_record_id: "feedback-1",
    recommended_route: "rule_candidate",
    harness_validation_status: "not_required",
    created_by: "editor-1",
    ...overrides,
  };
}

test("review items api lists the unified queue", async () => {
  const listCalls: Array<Record<string, unknown> | undefined> = [];
  const api = createReviewItemsApi({
    reviewItemsService: {
      async listReviewItems(input) {
        listCalls.push(input as Record<string, unknown> | undefined);
        return [buildGovernedHit()];
      },
      async submitGovernedHit() {
        throw new Error("submitGovernedHit should not be called in the list test.");
      },
      async decideReviewItem() {
        throw new Error("decideReviewItem should not be called in the list test.");
      },
    },
  });

  const response = await api.listReviewItems({
    sourceKind: "governed_hit",
    module: "editing",
    reviewStatus: "pending",
  });

  assert.equal(response.status, 200);
  assert.deepEqual(listCalls, [
    {
      sourceKind: "governed_hit",
      module: "editing",
      reviewStatus: "pending",
    },
  ]);
  assert.equal(response.body.length, 1);
  assert.equal(response.body[0]?.source_kind, "governed_hit");
  assert.equal(response.body[0]?.review_status, "pending");
});

test("review items api submits governed hits into the unified review queue", async () => {
  const submitCalls: SubmitGovernedHitInput[] = [];
  const submittedItem = buildGovernedHit({
    id: "governed-hit-2",
    feedback_category: "missing_knowledge",
    recommended_route: "knowledge_candidate",
  });

  const api = createReviewItemsApi({
    reviewItemsService: {
      async listReviewItems() {
        return [];
      },
      async submitGovernedHit(input) {
        submitCalls.push(input);
        return {
          feedback: {
            id: "feedback-2",
            manuscript_id: "manuscript-2",
            module: "proofreading",
            snapshot_id: "snapshot-2",
            feedback_type: "manual_rejection",
            created_by: "proofreader-1",
            created_at: "2026-04-18T08:00:00.000Z",
          },
          item: submittedItem,
        };
      },
      async decideReviewItem() {
        throw new Error("decideReviewItem should not be called in the submit test.");
      },
    },
  });

  const response = await api.submitGovernedHit({
    manuscriptId: "manuscript-2",
    manuscriptType: "clinical_study",
    module: "proofreading",
    snapshotId: "snapshot-2",
    sourceAssetId: "asset-2",
    feedbackCategory: "missing_knowledge",
    feedbackText: "The governed knowledge basis is still missing.",
    createdBy: "proofreader-1",
  });

  assert.equal(response.status, 201);
  assert.deepEqual(submitCalls, [
    {
      manuscriptId: "manuscript-2",
      manuscriptType: "clinical_study",
      module: "proofreading",
      snapshotId: "snapshot-2",
      sourceAssetId: "asset-2",
      feedbackCategory: "missing_knowledge",
      feedbackText: "The governed knowledge basis is still missing.",
      createdBy: "proofreader-1",
    },
  ]);
  assert.equal(response.body.feedback.id, "feedback-2");
  assert.equal(response.body.item.source_kind, "governed_hit");
  assert.equal(response.body.item.recommended_route, "knowledge_candidate");
});

test("review items api routes decisions through the review items service and returns the updated item", async () => {
  const decideCalls: Array<Record<string, unknown>> = [];
  const routedCandidate: ReviewItemRecord = {
    id: "candidate-knowledge-1",
    source_kind: "learning_candidate",
    source_status: "pending_review",
    review_status: "pending",
    status: "pending_review",
    module: "editing",
    manuscript_id: "manuscript-1",
    manuscript_type: "clinical_study",
    title: "Knowledge remediation candidate",
    summary: "Route the governed hit into knowledge review.",
    created_at: "2026-04-18T08:10:00.000Z",
    updated_at: "2026-04-18T08:10:00.000Z",
    available_actions: ["approve", "reject"],
    candidate_type: "knowledge_candidate",
    type: "knowledge_candidate",
    created_by: "reviewer-1",
  };

  const api = createReviewItemsApi({
    reviewItemsService: {
      async listReviewItems() {
        return [];
      },
      async submitGovernedHit() {
        throw new Error("submitGovernedHit should not be called in the decide test.");
      },
      async decideReviewItem(input) {
        decideCalls.push(input as Record<string, unknown>);
        return {
          action: input.action,
          item: routedCandidate,
        };
      },
    },
  });

  const response = await api.decideReviewItem({
    sourceKind: "governed_hit",
    id: "governed-hit-1",
    action: "route_to_knowledge_candidate",
    requestedBy: "reviewer-1",
    requestedByRole: "knowledge_reviewer",
    title: "Knowledge remediation candidate",
    proposalText: "Route the governed hit into knowledge review.",
  });

  assert.equal(response.status, 200);
  assert.deepEqual(decideCalls, [
    {
      sourceKind: "governed_hit",
      id: "governed-hit-1",
      action: "route_to_knowledge_candidate",
      requestedBy: "reviewer-1",
      requestedByRole: "knowledge_reviewer",
      title: "Knowledge remediation candidate",
      proposalText: "Route the governed hit into knowledge review.",
    },
  ]);
  assert.equal(response.body.action, "route_to_knowledge_candidate");
  assert.equal(response.body.item?.source_kind, "learning_candidate");
  assert.equal(response.body.item?.candidate_type, "knowledge_candidate");
});
