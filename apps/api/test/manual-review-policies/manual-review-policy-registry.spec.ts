import test from "node:test";
import assert from "node:assert/strict";
import { AuthorizationError } from "../../src/auth/permission-guard.ts";
import { InMemoryManualReviewPolicyRepository } from "../../src/modules/manual-review-policies/in-memory-manual-review-policy-repository.ts";
import {
  ManualReviewPolicyService,
  ManualReviewPolicyValidationError,
} from "../../src/modules/manual-review-policies/manual-review-policy-service.ts";

function createManualReviewPolicyHarness() {
  const repository = new InMemoryManualReviewPolicyRepository();
  const ids = ["policy-1", "policy-2", "policy-3"];

  const service = new ManualReviewPolicyService({
    repository,
    createId: () => {
      const value = ids.shift();
      assert.ok(value, "Expected a manual review policy id to be available.");
      return value;
    },
  });

  return {
    repository,
    service,
  };
}

test("only admin can create and activate manual review policies, and newer activation archives the previous active policy in scope", async () => {
  const { repository, service } = createManualReviewPolicyHarness();

  await assert.rejects(
    () =>
      service.createPolicy("editor", {
        module: "editing",
        manuscriptType: "clinical_study",
        templateFamilyId: "family-1",
        name: "Editing review policy v1",
        minConfidenceThreshold: 0.8,
        highRiskForceReview: true,
        conflictForceReview: true,
        insufficientKnowledgeForceReview: true,
      }),
    AuthorizationError,
  );

  const first = await service.createPolicy("admin", {
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
    name: "Editing review policy v1",
    minConfidenceThreshold: 0.8,
    highRiskForceReview: true,
    conflictForceReview: true,
    insufficientKnowledgeForceReview: true,
    moduleBlocklistRules: ["block-abstract"],
  });
  const second = await service.createPolicy("admin", {
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
    name: "Editing review policy v2",
    minConfidenceThreshold: 0.9,
    highRiskForceReview: true,
    conflictForceReview: false,
    insufficientKnowledgeForceReview: true,
    moduleBlocklistRules: ["block-abstract", "block-conclusion"],
  });

  assert.equal(first.status, "draft");
  assert.equal(first.version, 1);
  assert.equal(second.status, "draft");
  assert.equal(second.version, 2);

  await service.activatePolicy(first.id, "admin");
  const activatedSecond = await service.activatePolicy(second.id, "admin");
  const reloadedFirst = await repository.findById(first.id);

  assert.equal(activatedSecond.status, "active");
  assert.equal(reloadedFirst?.status, "archived");
});

test("manual review policies list by scope and resolve the active policy for that scope", async () => {
  const { service } = createManualReviewPolicyHarness();

  const editingDraft = await service.createPolicy("admin", {
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
    name: "Editing review policy v1",
    minConfidenceThreshold: 0.75,
    highRiskForceReview: true,
    conflictForceReview: true,
    insufficientKnowledgeForceReview: false,
  });
  await service.activatePolicy(editingDraft.id, "admin");

  await service.createPolicy("admin", {
    module: "proofreading",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
    name: "Proofreading review policy",
    minConfidenceThreshold: 0.6,
    highRiskForceReview: false,
    conflictForceReview: false,
    insufficientKnowledgeForceReview: true,
  });

  const scoped = await service.listPoliciesForScope({
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
  });
  const active = await service.getActivePolicyForScope({
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
  });

  assert.deepEqual(
    scoped.map((record) => record.id),
    [editingDraft.id],
  );
  assert.equal(active.id, editingDraft.id);
});

test("manual review policy service rejects invalid confidence thresholds", async () => {
  const { service } = createManualReviewPolicyHarness();

  await assert.rejects(
    () =>
      service.createPolicy("admin", {
        module: "editing",
        manuscriptType: "clinical_study",
        templateFamilyId: "family-1",
        name: "Broken review policy",
        minConfidenceThreshold: 1.2,
        highRiskForceReview: true,
        conflictForceReview: true,
        insufficientKnowledgeForceReview: true,
      }),
    ManualReviewPolicyValidationError,
  );
});
