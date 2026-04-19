import test from "node:test";
import assert from "node:assert/strict";
import { AuthorizationError } from "../../src/auth/permission-guard.ts";
import { createEditorialRuleApi } from "../../src/modules/editorial-rules/editorial-rule-api.ts";
import { EditorialRuleConflictService } from "../../src/modules/editorial-rules/editorial-rule-conflict-service.ts";
import { InMemoryEditorialRuleRepository } from "../../src/modules/editorial-rules/in-memory-editorial-rule-repository.ts";
import {
  EditorialRuleService,
  EditorialRuleSetNotEditableError,
} from "../../src/modules/editorial-rules/editorial-rule-service.ts";
import { InMemoryTemplateFamilyRepository } from "../../src/modules/templates/in-memory-template-family-repository.ts";
import { InMemoryVerificationOpsRepository } from "../../src/modules/verification-ops/in-memory-verification-ops-repository.ts";

const BEFORE_HEADING = "\u6458\u8981 \u76ee\u7684";
const AFTER_HEADING = "\uff08\u6458\u8981\u3000\u76ee\u7684\uff09";

function createEditorialRuleHarness() {
  const repository = new InMemoryEditorialRuleRepository();
  const templateFamilyRepository = new InMemoryTemplateFamilyRepository();
  const verificationOpsRepository = new InMemoryVerificationOpsRepository();
  const service = new EditorialRuleService({
    repository,
    templateFamilyRepository,
    verificationOpsRepository,
    createId: (() => {
      const ids = [
        "rule-set-1",
        "rule-1",
        "rule-set-2",
        "rule-2",
        "rule-set-3",
        "rule-3",
        "rule-set-4",
        "rule-4",
        "rule-set-5",
        "rule-5",
        "rule-set-6",
        "rule-6",
      ];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected an editorial rule id to be available.");
        return value;
      };
    })(),
  });
  const api = createEditorialRuleApi({
    editorialRuleService: service,
  });

  return {
    api,
    service,
    repository,
    templateFamilyRepository,
    verificationOpsRepository,
  };
}

test("rule sets are versioned, rules preserve structured actions, and earlier published versions are archived", async () => {
  const { api, templateFamilyRepository } = createEditorialRuleHarness();

  await templateFamilyRepository.save({
    id: "family-1",
    manuscript_type: "clinical_study",
    name: "Clinical study family",
    status: "active",
  });

  await assert.rejects(
    () =>
      api.createRuleSet({
        actorRole: "editor",
        input: {
          templateFamilyId: "family-1",
          module: "editing",
        },
      }),
    AuthorizationError,
  );

  const firstRuleSet = await api.createRuleSet({
    actorRole: "admin",
    input: {
      templateFamilyId: "family-1",
      module: "editing",
    },
  });

  assert.deepEqual(firstRuleSet.body, {
    id: "rule-set-1",
    template_family_id: "family-1",
    module: "editing",
    version_no: 1,
    status: "draft",
  });

  const createdRule = await api.createRule({
    actorRole: "admin",
    input: {
      ruleSetId: firstRuleSet.body.id,
      orderNo: 10,
      ruleType: "format",
      executionMode: "apply_and_inspect",
      scope: {
        sections: ["abstract"],
        block_kind: "heading",
      },
      trigger: {
        kind: "exact_text",
        text: "摘要 目的",
      },
      action: {
        kind: "replace_heading",
        to: "（摘要　目的）",
      },
      confidencePolicy: "always_auto",
      severity: "error",
      enabled: true,
      exampleBefore: "摘要 目的",
      exampleAfter: "（摘要　目的）",
      manualReviewReasonTemplate: "medical_meaning_risk",
    },
  });

  assert.equal(createdRule.body.action.kind, "replace_heading");
  assert.equal(createdRule.body.action.to, "（摘要　目的）");
  assert.equal(createdRule.body.example_before, "摘要 目的");
  assert.equal(createdRule.body.example_after, "（摘要　目的）");

  const secondRuleSet = await api.createRuleSet({
    actorRole: "admin",
    input: {
      templateFamilyId: "family-1",
      module: "editing",
    },
  });

  assert.equal(secondRuleSet.body.version_no, 2);

  const publishedFirst = await api.publishRuleSet({
    actorRole: "admin",
    ruleSetId: firstRuleSet.body.id,
  });
  const publishedSecond = await api.publishRuleSet({
    actorRole: "admin",
    ruleSetId: secondRuleSet.body.id,
  });
  const listedRuleSets = await api.listRuleSets();
  const listedRules = await api.listRules({
    ruleSetId: firstRuleSet.body.id,
  });

  assert.equal(publishedFirst.body.status, "published");
  assert.equal(publishedSecond.body.status, "published");
  assert.equal(
    listedRuleSets.body.find((record) => record.id === firstRuleSet.body.id)?.status,
    "archived",
  );
  assert.equal(
    listedRuleSets.body.find((record) => record.id === secondRuleSet.body.id)?.status,
    "published",
  );
  assert.deepEqual(listedRules.body.map((record) => record.id), ["rule-1"]);

  await assert.rejects(
    () =>
      api.createRule({
        actorRole: "admin",
        input: {
          ruleSetId: firstRuleSet.body.id,
          orderNo: 20,
          ruleType: "format",
          executionMode: "apply",
          scope: {
            sections: ["abstract"],
          },
          trigger: {
            kind: "exact_text",
            text: "摘要 结果",
          },
          action: {
            kind: "replace_heading",
            to: "（摘要　结果）",
          },
          confidencePolicy: "always_auto",
          severity: "warning",
        },
      }),
    EditorialRuleSetNotEditableError,
  );
});

test("journal-scoped rule sets preserve rule objects, selectors, and authoring payloads end-to-end", async () => {
  const { api, templateFamilyRepository } = createEditorialRuleHarness();

  await templateFamilyRepository.save({
    id: "family-1",
    manuscript_type: "clinical_study",
    name: "Clinical study family",
    status: "active",
  });
  await templateFamilyRepository.saveJournalTemplateProfile({
    id: "journal-template-1",
    template_family_id: "family-1",
    journal_key: "journal-alpha",
    journal_name: "Journal Alpha",
    status: "active",
  });

  const ruleSet = await api.createRuleSet({
    actorRole: "admin",
    input: {
      templateFamilyId: "family-1",
      journalTemplateId: "journal-template-1",
      module: "editing",
    },
  });

  const createdRule = await api.createRule({
    actorRole: "admin",
    input: {
      ruleSetId: ruleSet.body.id,
      orderNo: 10,
      ruleObject: "abstract",
      ruleType: "format",
      executionMode: "apply_and_inspect",
      scope: {
        sections: ["abstract"],
        block_kind: "heading",
      },
      selector: {
        section_selector: "abstract",
        label_selector: {
          text: BEFORE_HEADING,
        },
      },
      trigger: {
        kind: "exact_text",
        text: BEFORE_HEADING,
      },
      action: {
        kind: "replace_heading",
        to: AFTER_HEADING,
      },
      authoringPayload: {
        normalized_example: AFTER_HEADING,
        source: "manual_authoring",
      },
      confidencePolicy: "always_auto",
      severity: "error",
      enabled: true,
    },
  });
  const listedRules = await api.listRules({
    ruleSetId: ruleSet.body.id,
  });

  assert.deepEqual(ruleSet.body, {
    id: "rule-set-1",
    template_family_id: "family-1",
    journal_template_id: "journal-template-1",
    module: "editing",
    version_no: 1,
    status: "draft",
  });
  assert.equal(createdRule.body.rule_object, "abstract");
  assert.deepEqual(createdRule.body.selector, {
    section_selector: "abstract",
    label_selector: {
      text: BEFORE_HEADING,
    },
  });
  assert.deepEqual(createdRule.body.authoring_payload, {
    normalized_example: AFTER_HEADING,
    source: "manual_authoring",
  });
  assert.equal(listedRules.body[0]?.rule_object, "abstract");
  assert.deepEqual(listedRules.body[0]?.selector, {
    section_selector: "abstract",
    label_selector: {
      text: BEFORE_HEADING,
    },
  });
  assert.deepEqual(listedRules.body[0]?.authoring_payload, {
    normalized_example: AFTER_HEADING,
    source: "manual_authoring",
  });
});

test("creating a rule preserves explainability, linkage, and projection payloads for the exact abstract normalization example", async () => {
  const { api, templateFamilyRepository } = createEditorialRuleHarness();

  await templateFamilyRepository.save({
    id: "family-1",
    manuscript_type: "clinical_study",
    name: "Clinical study family",
    status: "active",
  });
  await templateFamilyRepository.saveJournalTemplateProfile({
    id: "journal-template-1",
    template_family_id: "family-1",
    journal_key: "journal-alpha",
    journal_name: "Journal Alpha",
    status: "active",
  });

  const ruleSet = await api.createRuleSet({
    actorRole: "admin",
    input: {
      templateFamilyId: "family-1",
      journalTemplateId: "journal-template-1",
      module: "editing",
    },
  });

  const createdRule = await api.createRule({
    actorRole: "admin",
    input: {
      ruleSetId: ruleSet.body.id,
      orderNo: 10,
      ruleObject: "abstract",
      ruleType: "format",
      executionMode: "apply_and_inspect",
      scope: {
        sections: ["abstract"],
        block_kind: "heading",
      },
      selector: {
        section_selector: "abstract",
        label_selector: {
          text: BEFORE_HEADING,
        },
      },
      trigger: {
        kind: "exact_text",
        text: BEFORE_HEADING,
      },
      action: {
        kind: "replace_heading",
        to: AFTER_HEADING,
      },
      authoringPayload: {
        normalized_example: AFTER_HEADING,
        common_error_text: BEFORE_HEADING,
      },
      explanationPayload: {
        rationale:
          "Abstract headings should normalize to full-width parentheses and full-width spacing.",
        applies_when: ["Chinese medical abstract heading labels require journal normalization."],
        correct_example: AFTER_HEADING,
        incorrect_example: BEFORE_HEADING,
        review_prompt: "Check whether the abstract heading uses journal punctuation and spacing.",
      },
      linkagePayload: {
        source_learning_candidate_id: "candidate-1",
        source_snapshot_asset_id: "snapshot-1",
        overrides_rule_ids: ["base-rule-abstract"],
      },
      projectionPayload: {
        projection_kind: "rule",
        summary: "Normalize abstract objective headings to the journal house style.",
        standard_example: AFTER_HEADING,
        incorrect_example: BEFORE_HEADING,
      },
      confidencePolicy: "always_auto",
      severity: "error",
      enabled: true,
      exampleBefore: BEFORE_HEADING,
      exampleAfter: AFTER_HEADING,
    },
  });
  const listedRules = await api.listRules({
    ruleSetId: ruleSet.body.id,
  });

  assert.equal(createdRule.body.example_before, BEFORE_HEADING);
  assert.equal(createdRule.body.example_after, AFTER_HEADING);
  assert.deepEqual(createdRule.body.explanation_payload, {
    rationale:
      "Abstract headings should normalize to full-width parentheses and full-width spacing.",
    applies_when: ["Chinese medical abstract heading labels require journal normalization."],
    correct_example: AFTER_HEADING,
    incorrect_example: BEFORE_HEADING,
    review_prompt: "Check whether the abstract heading uses journal punctuation and spacing.",
  });
  assert.deepEqual(createdRule.body.linkage_payload, {
    source_learning_candidate_id: "candidate-1",
    source_snapshot_asset_id: "snapshot-1",
    overrides_rule_ids: ["base-rule-abstract"],
  });
  assert.deepEqual(createdRule.body.projection_payload, {
    projection_kind: "rule",
    summary: "Normalize abstract objective headings to the journal house style.",
    standard_example: AFTER_HEADING,
    incorrect_example: BEFORE_HEADING,
  });
  assert.deepEqual(listedRules.body[0]?.explanation_payload, createdRule.body.explanation_payload);
  assert.deepEqual(listedRules.body[0]?.linkage_payload, createdRule.body.linkage_payload);
  assert.deepEqual(listedRules.body[0]?.projection_payload, createdRule.body.projection_payload);
});

test("publishing a journal-scoped rule set only archives published rule sets in the same scope", async () => {
  const { api, templateFamilyRepository } = createEditorialRuleHarness();

  await templateFamilyRepository.save({
    id: "family-1",
    manuscript_type: "clinical_study",
    name: "Clinical study family",
    status: "active",
  });
  await templateFamilyRepository.saveJournalTemplateProfile({
    id: "journal-template-1",
    template_family_id: "family-1",
    journal_key: "journal-alpha",
    journal_name: "Journal Alpha",
    status: "active",
  });
  await templateFamilyRepository.saveJournalTemplateProfile({
    id: "journal-template-2",
    template_family_id: "family-1",
    journal_key: "journal-beta",
    journal_name: "Journal Beta",
    status: "active",
  });

  const baseRuleSet = await api.createRuleSet({
    actorRole: "admin",
    input: {
      templateFamilyId: "family-1",
      module: "editing",
    },
  });
  const journalAlphaV1 = await api.createRuleSet({
    actorRole: "admin",
    input: {
      templateFamilyId: "family-1",
      journalTemplateId: "journal-template-1",
      module: "editing",
    },
  });
  const journalBetaV1 = await api.createRuleSet({
    actorRole: "admin",
    input: {
      templateFamilyId: "family-1",
      journalTemplateId: "journal-template-2",
      module: "editing",
    },
  });

  await api.publishRuleSet({
    actorRole: "admin",
    ruleSetId: baseRuleSet.body.id,
  });
  await api.publishRuleSet({
    actorRole: "admin",
    ruleSetId: journalAlphaV1.body.id,
  });
  await api.publishRuleSet({
    actorRole: "admin",
    ruleSetId: journalBetaV1.body.id,
  });

  const journalAlphaV2 = await api.createRuleSet({
    actorRole: "admin",
    input: {
      templateFamilyId: "family-1",
      journalTemplateId: "journal-template-1",
      module: "editing",
    },
  });
  await api.publishRuleSet({
    actorRole: "admin",
    ruleSetId: journalAlphaV2.body.id,
  });

  const listedRuleSets = await api.listRuleSets();
  const statusesById = new Map(
    listedRuleSets.body.map((record) => [record.id, record.status]),
  );

  assert.equal(statusesById.get(baseRuleSet.body.id), "published");
  assert.equal(statusesById.get(journalAlphaV1.body.id), "archived");
  assert.equal(statusesById.get(journalAlphaV2.body.id), "published");
  assert.equal(statusesById.get(journalBetaV1.body.id), "published");
});

test("creating a journal-scoped rule set rejects a journal template from a different template family", async () => {
  const { api, templateFamilyRepository } = createEditorialRuleHarness();

  await templateFamilyRepository.save({
    id: "family-1",
    manuscript_type: "clinical_study",
    name: "Clinical study family",
    status: "active",
  });
  await templateFamilyRepository.save({
    id: "family-2",
    manuscript_type: "review",
    name: "Review family",
    status: "active",
  });
  await templateFamilyRepository.saveJournalTemplateProfile({
    id: "journal-template-2",
    template_family_id: "family-2",
    journal_key: "review-journal",
    journal_name: "Review Journal",
    status: "active",
  });

  await assert.rejects(
    () =>
      api.createRuleSet({
        actorRole: "admin",
        input: {
          templateFamilyId: "family-1",
          journalTemplateId: "journal-template-2",
          module: "editing",
        },
      }),
    /journal template/i,
  );
});

test("conflict service classifies compatible multi-rule outcomes as merge", () => {
  const service = new EditorialRuleConflictService();

  const conflicts = service.classifyPreviewConflicts([
    {
      rule_id: "rule-table-header",
      coverage_key:
        'table::{"header_path_includes":["Treatment group","n (%)"],"semantic_target":"header_cell"}::{"kind":"table_shape","layout":"three_line_table"}',
      target_key: 'table::{"table_id":"table-1","target":"header_cell"}',
      execution_posture: "inspect_only",
      overridden_rule_ids: [],
      reason: "Header semantics rule matched.",
    },
    {
      rule_id: "rule-table-footnote",
      coverage_key:
        'table::{"note_kind":"statistical_significance","semantic_target":"footnote_item"}::{"kind":"table_shape","layout":"three_line_table"}',
      target_key: 'table::{"table_id":"table-1","target":"footnote_item"}',
      execution_posture: "inspect_only",
      overridden_rule_ids: [],
      reason: "Footnote semantics rule matched.",
    },
  ]);

  assert.deepEqual(conflicts, [
    {
      kind: "merge",
      rule_ids: ["rule-table-header", "rule-table-footnote"],
      coverage_keys: [
        'table::{"header_path_includes":["Treatment group","n (%)"],"semantic_target":"header_cell"}::{"kind":"table_shape","layout":"three_line_table"}',
        'table::{"note_kind":"statistical_significance","semantic_target":"footnote_item"}::{"kind":"table_shape","layout":"three_line_table"}',
      ],
      reason: "Rules can merge because they target different governed aspects.",
      requires_manual_review: true,
    },
  ]);
});

test("rule sets move from draft to candidate while preserving the requested release scope", async () => {
  const { api, templateFamilyRepository } = createEditorialRuleHarness();

  await templateFamilyRepository.save({
    id: "family-1",
    manuscript_type: "clinical_study",
    name: "Clinical study family",
    status: "active",
  });

  const ruleSet = await api.createRuleSet({
    actorRole: "admin",
    input: {
      templateFamilyId: "family-1",
      module: "editing",
    },
  });

  const transitioned = await (
    api as unknown as {
      transitionRuleSet: (input: {
        actorRole: "admin";
        ruleSetId: string;
        targetStatus: "candidate";
        releaseScope: {
          manuscript_types: string[];
          sections: string[];
          object_granularity: string[];
        };
      }) => Promise<{ body: Record<string, unknown> }>;
    }
  ).transitionRuleSet({
    actorRole: "admin",
    ruleSetId: ruleSet.body.id,
    targetStatus: "candidate",
    releaseScope: {
      manuscript_types: ["clinical_study"],
      sections: ["abstract"],
      object_granularity: ["heading"],
    },
  });

  assert.deepEqual(transitioned.body, {
    id: "rule-set-1",
    template_family_id: "family-1",
    module: "editing",
    version_no: 1,
    status: "candidate",
    release_scope: {
      manuscript_types: ["clinical_study"],
      sections: ["abstract"],
      object_granularity: ["heading"],
    },
  });
});

test("candidate rule sets cannot enter canary without candidate validation evidence", async () => {
  const { api, templateFamilyRepository } = createEditorialRuleHarness();

  await templateFamilyRepository.save({
    id: "family-1",
    manuscript_type: "clinical_study",
    name: "Clinical study family",
    status: "active",
  });

  const ruleSet = await api.createRuleSet({
    actorRole: "admin",
    input: {
      templateFamilyId: "family-1",
      module: "editing",
    },
  });

  const transitionRuleSet = (
    api as unknown as {
      transitionRuleSet: (input: {
        actorRole: "admin";
        ruleSetId: string;
        targetStatus: "candidate" | "canary";
      }) => Promise<{ body: Record<string, unknown> }>;
    }
  ).transitionRuleSet;

  await transitionRuleSet({
    actorRole: "admin",
    ruleSetId: ruleSet.body.id,
    targetStatus: "candidate",
  });

  await assert.rejects(
    () =>
      transitionRuleSet({
        actorRole: "admin",
        ruleSetId: ruleSet.body.id,
        targetStatus: "canary",
      }),
    /candidate validation/i,
  );
});

test("canary rule sets cannot promote to active without online execution regression evidence", async () => {
  const { api, templateFamilyRepository, verificationOpsRepository } =
    createEditorialRuleHarness();

  await templateFamilyRepository.save({
    id: "family-1",
    manuscript_type: "clinical_study",
    name: "Clinical study family",
    status: "active",
  });

  const ruleSet = await api.createRuleSet({
    actorRole: "admin",
    input: {
      templateFamilyId: "family-1",
      module: "editing",
    },
  });

  const transitionRuleSet = (
    api as unknown as {
      transitionRuleSet: (input: {
        actorRole: "admin";
        ruleSetId: string;
        targetStatus: "candidate" | "canary" | "active";
        candidateValidationRunId?: string;
        candidateValidationEvidencePackId?: string;
      }) => Promise<{ body: Record<string, unknown> }>;
    }
  ).transitionRuleSet;

  await transitionRuleSet({
    actorRole: "admin",
    ruleSetId: ruleSet.body.id,
    targetStatus: "candidate",
  });
  await seedEvaluationGateEvidence(verificationOpsRepository, {
    runId: "candidate-validation-run-1",
    evidencePackId: "candidate-validation-pack-1",
    recommendationId: "candidate-validation-rec-1",
  });
  await transitionRuleSet({
    actorRole: "admin",
    ruleSetId: ruleSet.body.id,
    targetStatus: "canary",
    candidateValidationRunId: "candidate-validation-run-1",
    candidateValidationEvidencePackId: "candidate-validation-pack-1",
  });

  await assert.rejects(
    () =>
      transitionRuleSet({
        actorRole: "admin",
        ruleSetId: ruleSet.body.id,
        targetStatus: "active",
      }),
    /online execution regression/i,
  );
});

test("canary rule sets cannot promote to active when release comparison is degraded", async () => {
  const {
    api,
    service,
    templateFamilyRepository,
    verificationOpsRepository,
  } = createEditorialRuleHarness();

  (
    service as unknown as {
      activationMetricsService?: {
        buildReleaseComparison: (ruleSetId: string) => Promise<{
          status: "degraded";
          recommendation: "hold";
          compared_rule_set_id: string;
          baseline_rule_set_id: string;
          baseline_metrics: {
            rule_set_id: string;
            totals: Record<string, number>;
            rates: Record<string, number>;
          };
          candidate_metrics: {
            rule_set_id: string;
            totals: Record<string, number>;
            rates: Record<string, number>;
          };
          reasons: string[];
        }>;
      };
    }
  ).activationMetricsService = {
    buildReleaseComparison: async (ruleSetId) => ({
      status: "degraded",
      recommendation: "hold",
      compared_rule_set_id: ruleSetId,
      baseline_rule_set_id: "rule-set-active-1",
      baseline_metrics: {
        rule_set_id: "rule-set-active-1",
        totals: {
          governed_hit_count: 18,
          false_positive_count: 2,
          human_confirmation_count: 11,
          accept_change_only_count: 4,
          evidence_only_archive_count: 0,
          routed_rule_candidate_count: 3,
          routed_knowledge_candidate_count: 1,
          routed_prompt_candidate_count: 0,
          writeback_created_count: 4,
          writeback_applied_count: 4,
        },
        rates: {
          false_positive_rate: 0.11,
          human_confirmation_rate: 0.61,
          evidence_only_archive_rate: 0,
          writeback_success_rate: 1,
        },
      },
      candidate_metrics: {
        rule_set_id: ruleSetId,
        totals: {
          governed_hit_count: 20,
          false_positive_count: 6,
          human_confirmation_count: 9,
          accept_change_only_count: 3,
          evidence_only_archive_count: 1,
          routed_rule_candidate_count: 4,
          routed_knowledge_candidate_count: 1,
          routed_prompt_candidate_count: 1,
          writeback_created_count: 5,
          writeback_applied_count: 3,
        },
        rates: {
          false_positive_rate: 0.3,
          human_confirmation_rate: 0.45,
          evidence_only_archive_rate: 0.05,
          writeback_success_rate: 0.6,
        },
      },
      reasons: ["False-positive rate regressed versus baseline."],
    }),
  };

  await templateFamilyRepository.save({
    id: "family-1",
    manuscript_type: "clinical_study",
    name: "Clinical study family",
    status: "active",
  });

  const ruleSet = await api.createRuleSet({
    actorRole: "admin",
    input: {
      templateFamilyId: "family-1",
      module: "editing",
    },
  });

  const transitionRuleSet = (
    api as unknown as {
      transitionRuleSet: (input: {
        actorRole: "admin";
        ruleSetId: string;
        targetStatus: "candidate" | "canary" | "active";
        candidateValidationRunId?: string;
        candidateValidationEvidencePackId?: string;
        onlineRegressionRunId?: string;
        onlineRegressionEvidencePackId?: string;
      }) => Promise<{ body: Record<string, unknown> }>;
    }
  ).transitionRuleSet;

  await transitionRuleSet({
    actorRole: "admin",
    ruleSetId: ruleSet.body.id,
    targetStatus: "candidate",
  });
  await seedEvaluationGateEvidence(verificationOpsRepository, {
    runId: "candidate-validation-run-3",
    evidencePackId: "candidate-validation-pack-3",
    recommendationId: "candidate-validation-rec-3",
  });
  await transitionRuleSet({
    actorRole: "admin",
    ruleSetId: ruleSet.body.id,
    targetStatus: "canary",
    candidateValidationRunId: "candidate-validation-run-3",
    candidateValidationEvidencePackId: "candidate-validation-pack-3",
  });
  await seedEvaluationGateEvidence(verificationOpsRepository, {
    runId: "online-regression-run-2",
    evidencePackId: "online-regression-pack-2",
    recommendationId: "online-regression-rec-2",
  });

  await assert.rejects(
    () =>
      transitionRuleSet({
        actorRole: "admin",
        ruleSetId: ruleSet.body.id,
        targetStatus: "active",
        onlineRegressionRunId: "online-regression-run-2",
        onlineRegressionEvidencePackId: "online-regression-pack-2",
      }),
    /False-positive rate regressed versus baseline\./i,
  );
});

test("rolling back an active rule set restores the previous same-scope baseline", async () => {
  const { api, repository, templateFamilyRepository, verificationOpsRepository } =
    createEditorialRuleHarness();

  await templateFamilyRepository.save({
    id: "family-1",
    manuscript_type: "clinical_study",
    name: "Clinical study family",
    status: "active",
  });

  await repository.saveRuleSet({
    id: "baseline-rule-set",
    template_family_id: "family-1",
    module: "editing",
    version_no: 1,
    status: "published",
  });

  const ruleSet = await api.createRuleSet({
    actorRole: "admin",
    input: {
      templateFamilyId: "family-1",
      module: "editing",
    },
  });

  const transitionRuleSet = (
    api as unknown as {
      transitionRuleSet: (input: {
        actorRole: "admin";
        ruleSetId: string;
        targetStatus: "candidate" | "canary" | "active" | "rolled_back";
        candidateValidationRunId?: string;
        candidateValidationEvidencePackId?: string;
        onlineRegressionRunId?: string;
        onlineRegressionEvidencePackId?: string;
      }) => Promise<{ body: Record<string, unknown> }>;
    }
  ).transitionRuleSet;

  await transitionRuleSet({
    actorRole: "admin",
    ruleSetId: ruleSet.body.id,
    targetStatus: "candidate",
  });
  await seedEvaluationGateEvidence(verificationOpsRepository, {
    runId: "candidate-validation-run-2",
    evidencePackId: "candidate-validation-pack-2",
    recommendationId: "candidate-validation-rec-2",
  });
  await transitionRuleSet({
    actorRole: "admin",
    ruleSetId: ruleSet.body.id,
    targetStatus: "canary",
    candidateValidationRunId: "candidate-validation-run-2",
    candidateValidationEvidencePackId: "candidate-validation-pack-2",
  });
  await seedEvaluationGateEvidence(verificationOpsRepository, {
    runId: "online-regression-run-1",
    evidencePackId: "online-regression-pack-1",
    recommendationId: "online-regression-rec-1",
  });
  await transitionRuleSet({
    actorRole: "admin",
    ruleSetId: ruleSet.body.id,
    targetStatus: "active",
    onlineRegressionRunId: "online-regression-run-1",
    onlineRegressionEvidencePackId: "online-regression-pack-1",
  });
  await transitionRuleSet({
    actorRole: "admin",
    ruleSetId: ruleSet.body.id,
    targetStatus: "rolled_back",
  });

  const listedRuleSets = await api.listRuleSets();
  const statusesById = new Map(
    listedRuleSets.body.map((record) => [record.id, record.status]),
  );

  assert.equal(statusesById.get("baseline-rule-set"), "active");
  assert.equal(statusesById.get(ruleSet.body.id), "rolled_back");
});

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
