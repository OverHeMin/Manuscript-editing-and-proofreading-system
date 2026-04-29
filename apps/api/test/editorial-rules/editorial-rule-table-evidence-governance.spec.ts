import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryEditorialRuleRepository } from "../../src/modules/editorial-rules/in-memory-editorial-rule-repository.ts";
import {
  EditorialRuleService,
  EditorialRuleSetStatusTransitionError,
} from "../../src/modules/editorial-rules/editorial-rule-service.ts";
import type { TableEvidenceRevision } from "../../src/modules/table-evidence/table-evidence-record.ts";
import { InMemoryTemplateFamilyRepository } from "../../src/modules/templates/in-memory-template-family-repository.ts";
import { InMemoryVerificationOpsRepository } from "../../src/modules/verification-ops/in-memory-verification-ops-repository.ts";

function createTableEvidenceGovernanceHarness(input?: {
  assertConfirmedRevision?: (
    revisionId: string,
  ) => Promise<TableEvidenceRevision>;
}) {
  const repository = new InMemoryEditorialRuleRepository();
  const templateFamilyRepository = new InMemoryTemplateFamilyRepository();
  const verificationOpsRepository = new InMemoryVerificationOpsRepository();
  const assertConfirmedRevision =
    input?.assertConfirmedRevision ??
    (async () => ({ id: "rev-confirmed" }) as TableEvidenceRevision);
  const service = new EditorialRuleService({
    repository,
    templateFamilyRepository,
    verificationOpsRepository,
    tableEvidenceService: {
      assertConfirmedRevision,
    },
    createId: (() => {
      const ids = [
        "rule-set-1",
        "rule-1",
        "rule-set-2",
        "rule-2",
        "rule-set-3",
        "rule-3",
      ];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected an editorial rule governance id.");
        return value;
      };
    })(),
  });

  return {
    repository,
    templateFamilyRepository,
    verificationOpsRepository,
    service,
  };
}

test("publishing a rule set rejects linked table evidence revisions that are not confirmed", async () => {
  const harness = createTableEvidenceGovernanceHarness({
    assertConfirmedRevision: async (revisionId) => {
      assert.equal(revisionId, "rev-pending");
      throw new Error("revision is pending");
    },
  });
  await seedTemplateFamily(harness.templateFamilyRepository);
  const ruleSet = await createRuleSetWithLinkedTableEvidence(
    harness.service,
    "rev-pending",
  );

  await assert.rejects(
    () => harness.service.publishRuleSet("admin", ruleSet.id),
    (error) => {
      assert.ok(error instanceof EditorialRuleSetStatusTransitionError);
      assert.equal(
        (error as { failure_code?: string }).failure_code,
        "table_evidence_revision_not_confirmed",
      );
      return true;
    },
  );
});

test("publishing a rule set accepts linked table evidence revisions after confirmation", async () => {
  const checkedRevisionIds: string[] = [];
  const harness = createTableEvidenceGovernanceHarness({
    assertConfirmedRevision: async (revisionId) => {
      checkedRevisionIds.push(revisionId);
      return { id: revisionId } as TableEvidenceRevision;
    },
  });
  await seedTemplateFamily(harness.templateFamilyRepository);
  const ruleSet = await createRuleSetWithLinkedTableEvidence(harness.service, [
    " rev-confirmed ",
    "rev-confirmed",
  ]);

  const published = await harness.service.publishRuleSet("admin", ruleSet.id);

  assert.equal(published.status, "published");
  assert.deepEqual(checkedRevisionIds, ["rev-confirmed"]);
});

test("publishing a rule set rejects blank linked table evidence revision ids before lookup", async () => {
  const checkedRevisionIds: string[] = [];
  const harness = createTableEvidenceGovernanceHarness({
    assertConfirmedRevision: async (revisionId) => {
      checkedRevisionIds.push(revisionId);
      return { id: revisionId } as TableEvidenceRevision;
    },
  });
  await seedTemplateFamily(harness.templateFamilyRepository);
  const ruleSet = await createRuleSetWithLinkedTableEvidence(harness.service, [
    "   ",
  ]);

  await assert.rejects(
    () => harness.service.publishRuleSet("admin", ruleSet.id),
    (error) => {
      assert.ok(error instanceof EditorialRuleSetStatusTransitionError);
      assert.equal(
        (error as { failure_code?: string }).failure_code,
        "table_evidence_revision_id_invalid",
      );
      return true;
    },
  );
  assert.deepEqual(checkedRevisionIds, []);
});

test("activating a canary rule set rejects linked table evidence revisions that are not confirmed", async () => {
  const harness = createTableEvidenceGovernanceHarness({
    assertConfirmedRevision: async (revisionId) => {
      assert.equal(revisionId, "rev-pending");
      throw new Error("revision is pending");
    },
  });
  await seedTemplateFamily(harness.templateFamilyRepository);
  const ruleSet = await createRuleSetWithLinkedTableEvidence(
    harness.service,
    "rev-pending",
  );
  await harness.service.transitionRuleSet("admin", {
    ruleSetId: ruleSet.id,
    targetStatus: "candidate",
  });
  await seedEvaluationGateEvidence(harness.verificationOpsRepository, {
    runId: "candidate-run-1",
    evidencePackId: "candidate-pack-1",
    recommendationId: "candidate-rec-1",
  });
  await harness.service.transitionRuleSet("admin", {
    ruleSetId: ruleSet.id,
    targetStatus: "canary",
    candidateValidationRunId: "candidate-run-1",
    candidateValidationEvidencePackId: "candidate-pack-1",
  });
  await seedEvaluationGateEvidence(harness.verificationOpsRepository, {
    runId: "online-run-1",
    evidencePackId: "online-pack-1",
    recommendationId: "online-rec-1",
  });

  await assert.rejects(
    () =>
      harness.service.transitionRuleSet("admin", {
        ruleSetId: ruleSet.id,
        targetStatus: "active",
        onlineRegressionRunId: "online-run-1",
        onlineRegressionEvidencePackId: "online-pack-1",
      }),
    (error) => {
      assert.ok(error instanceof EditorialRuleSetStatusTransitionError);
      assert.equal(
        (error as { failure_code?: string }).failure_code,
        "table_evidence_revision_not_confirmed",
      );
      return true;
    },
  );
});

test("rolling back an active rule set rejects an unconfirmed linked table evidence revision on the restore target", async () => {
  const checkedRevisionIds: string[] = [];
  const harness = createTableEvidenceGovernanceHarness({
    assertConfirmedRevision: async (revisionId) => {
      checkedRevisionIds.push(revisionId);
      throw new Error("revision is pending");
    },
  });
  await seedTemplateFamily(harness.templateFamilyRepository);
  await seedRollbackRuleSetsWithLinkedTableEvidence(harness.repository, {
    revisionIds: ["rev-rollback-pending"],
  });

  await assert.rejects(
    () =>
      harness.service.transitionRuleSet("admin", {
        ruleSetId: "active-rule-set",
        targetStatus: "rolled_back",
      }),
    (error) => {
      assert.ok(error instanceof EditorialRuleSetStatusTransitionError);
      assert.equal(
        (error as { failure_code?: string }).failure_code,
        "table_evidence_revision_not_confirmed",
      );
      assert.deepEqual((error as { failures?: unknown }).failures, [
        {
          code: "table_evidence_revision_not_confirmed",
          revision_id: "rev-rollback-pending",
        },
      ]);
      return true;
    },
  );
  assert.deepEqual(checkedRevisionIds, ["rev-rollback-pending"]);
});

test("rolling back an active rule set restores a confirmed linked table evidence target", async () => {
  const checkedRevisionIds: string[] = [];
  const harness = createTableEvidenceGovernanceHarness({
    assertConfirmedRevision: async (revisionId) => {
      checkedRevisionIds.push(revisionId);
      return { id: revisionId } as TableEvidenceRevision;
    },
  });
  await seedTemplateFamily(harness.templateFamilyRepository);
  await seedRollbackRuleSetsWithLinkedTableEvidence(harness.repository, {
    revisionIds: [" rev-rollback-confirmed ", "rev-rollback-confirmed"],
  });

  const rolledBack = await harness.service.transitionRuleSet("admin", {
    ruleSetId: "active-rule-set",
    targetStatus: "rolled_back",
  });
  const restored = await harness.repository.findRuleSetById("rollback-target");

  assert.equal(rolledBack.status, "rolled_back");
  assert.equal(restored?.status, "active");
  assert.deepEqual(checkedRevisionIds, ["rev-rollback-confirmed"]);
});

async function seedTemplateFamily(
  repository: InMemoryTemplateFamilyRepository,
): Promise<void> {
  await repository.save({
    id: "family-1",
    manuscript_type: "clinical_study",
    name: "Clinical study family",
    status: "active",
  });
}

async function createRuleSetWithLinkedTableEvidence(
  service: EditorialRuleService,
  revisionIds: string[] | string,
) {
  const ruleSet = await service.createRuleSet("admin", {
    templateFamilyId: "family-1",
    module: "editing",
  });
  await service.createRule("admin", {
    ruleSetId: ruleSet.id,
    orderNo: 10,
    ruleObject: "table",
    ruleType: "format",
    executionMode: "inspect",
    scope: {
      sections: ["results"],
    },
    selector: {
      semantic_target: "header_cell",
    },
    trigger: {
      kind: "table_header",
    },
    action: {
      kind: "inspect_table_header",
    },
    linkagePayload: {
      table_evidence_revision_ids: Array.isArray(revisionIds)
        ? revisionIds
        : [revisionIds],
    },
    confidencePolicy: "manual_only",
    severity: "warning",
  });
  return ruleSet;
}

async function seedRollbackRuleSetsWithLinkedTableEvidence(
  repository: InMemoryEditorialRuleRepository,
  input: {
    revisionIds: string[];
  },
): Promise<void> {
  await repository.saveRuleSet({
    id: "rollback-target",
    template_family_id: "family-1",
    module: "editing",
    version_no: 1,
    status: "archived",
  });
  await repository.saveRule({
    id: "rollback-target-rule",
    rule_set_id: "rollback-target",
    order_no: 10,
    rule_object: "table",
    rule_type: "format",
    execution_mode: "inspect",
    scope: {
      sections: ["results"],
    },
    selector: {},
    trigger: {
      kind: "table_header",
    },
    action: {
      kind: "inspect_table_header",
    },
    authoring_payload: {},
    linkage_payload: {
      table_evidence_revision_ids: input.revisionIds,
    },
    confidence_policy: "manual_only",
    severity: "warning",
    enabled: true,
  });
  await repository.saveRuleSet({
    id: "active-rule-set",
    template_family_id: "family-1",
    module: "editing",
    version_no: 2,
    status: "active",
    rollback_rule_set_id: "rollback-target",
  });
}

async function seedEvaluationGateEvidence(
  repository: InMemoryVerificationOpsRepository,
  input: {
    runId: string;
    evidencePackId: string;
    recommendationId: string;
  },
): Promise<void> {
  await repository.saveEvaluationRun({
    id: input.runId,
    suite_id: "suite-1",
    run_item_count: 0,
    status: "passed",
    evidence_ids: [],
    started_at: "2026-04-19T09:00:00.000Z",
    finished_at: "2026-04-19T09:05:00.000Z",
  });
  await repository.saveEvaluationEvidencePack({
    id: input.evidencePackId,
    experiment_run_id: input.runId,
    summary_status: "recommended",
    created_at: "2026-04-19T09:06:00.000Z",
  });
  await repository.saveEvaluationPromotionRecommendation({
    id: input.recommendationId,
    experiment_run_id: input.runId,
    evidence_pack_id: input.evidencePackId,
    status: "recommended",
    created_at: "2026-04-19T09:07:00.000Z",
  });
}
