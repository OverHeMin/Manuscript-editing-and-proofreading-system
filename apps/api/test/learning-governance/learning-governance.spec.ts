import test from "node:test";
import assert from "node:assert/strict";
import { AuthorizationError } from "../../src/auth/permission-guard.ts";
import { InMemoryLearningCandidateRepository } from "../../src/modules/learning/in-memory-learning-repository.ts";
import { InMemoryKnowledgeRepository, InMemoryKnowledgeReviewActionRepository } from "../../src/modules/knowledge/in-memory-knowledge-repository.ts";
import { KnowledgeService } from "../../src/modules/knowledge/knowledge-service.ts";
import { InMemoryEditorialRuleRepository } from "../../src/modules/editorial-rules/in-memory-editorial-rule-repository.ts";
import { InMemoryEditorialRuleActivationMetricsRepository } from "../../src/modules/editorial-rules/in-memory-editorial-rule-activation-metrics-repository.ts";
import { EditorialRuleActivationMetricsService } from "../../src/modules/editorial-rules/editorial-rule-activation-metrics-service.ts";
import { EditorialRuleService } from "../../src/modules/editorial-rules/editorial-rule-service.ts";
import { createLearningGovernanceApi } from "../../src/modules/learning-governance/learning-governance-api.ts";
import { InMemoryLearningGovernanceRepository } from "../../src/modules/learning-governance/in-memory-learning-governance-repository.ts";
import {
  LearningGovernanceConflictError,
  LearningGovernanceService,
} from "../../src/modules/learning-governance/learning-governance-service.ts";
import { LearningFeedbackLoopVerifier } from "../../src/modules/learning-governance/index.ts";
import { InMemoryPromptSkillRegistryRepository } from "../../src/modules/prompt-skill-registry/in-memory-prompt-skill-repository.ts";
import { PromptSkillRegistryService } from "../../src/modules/prompt-skill-registry/prompt-skill-service.ts";
import {
  InMemoryModuleTemplateRepository,
  InMemoryTemplateFamilyRepository,
} from "../../src/modules/templates/in-memory-template-family-repository.ts";
import { TemplateGovernanceService } from "../../src/modules/templates/template-governance-service.ts";

const BEFORE_HEADING = "\u6458\u8981 \u76ee\u7684";
const AFTER_HEADING = "\uff08\u6458\u8981\u3000\u76ee\u7684\uff09";

function createLearningGovernanceHarness() {
  const learningCandidateRepository = new InMemoryLearningCandidateRepository();
  const repository = new InMemoryLearningGovernanceRepository();
  const templateFamilyRepository = new InMemoryTemplateFamilyRepository();
  const moduleTemplateRepository = new InMemoryModuleTemplateRepository();
  const editorialRuleRepository = new InMemoryEditorialRuleRepository();
  const activationMetricsRepository =
    new InMemoryEditorialRuleActivationMetricsRepository();
  const knowledgeService = new KnowledgeService({
    repository: new InMemoryKnowledgeRepository(),
    reviewActionRepository: new InMemoryKnowledgeReviewActionRepository(),
    learningCandidateRepository,
    createId: (() => {
      const ids = ["knowledge-1", "review-action-1", "knowledge-2"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected a knowledge governance id to be available.");
        return value;
      };
    })(),
    now: () => new Date("2026-03-28T08:00:00.000Z"),
  });
  const templateService = new TemplateGovernanceService({
    templateFamilyRepository,
    moduleTemplateRepository,
    learningCandidateRepository,
    createId: (() => {
      const ids = ["family-1", "template-1", "template-2"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected a template governance id to be available.");
        return value;
      };
    })(),
    now: () => new Date("2026-03-28T08:00:00.000Z"),
  });
  const editorialRuleService = new EditorialRuleService({
    repository: editorialRuleRepository,
    templateFamilyRepository,
    createId: (() => {
      const ids = ["rule-set-1", "rule-1", "rule-set-2", "rule-2"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected an editorial rule governance id to be available.");
        return value;
      };
    })(),
  });
  const activationMetricsService = new EditorialRuleActivationMetricsService({
    repository: activationMetricsRepository,
    editorialRuleRepository,
    now: () => new Date("2026-03-28T08:05:00.000Z"),
  });
  const promptSkillRegistryService = new PromptSkillRegistryService({
    repository: new InMemoryPromptSkillRegistryRepository(),
    learningCandidateRepository,
    createId: (() => {
      const ids = ["skill-1", "prompt-1", "skill-2", "prompt-2"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected a prompt/skill governance id to be available.");
        return value;
      };
    })(),
  });
  const service = new LearningGovernanceService({
    repository,
    learningCandidateRepository,
    knowledgeService,
    templateService,
    editorialRuleService,
    promptSkillRegistryService,
    activationMetricsService,
    createId: (() => {
      const ids = ["writeback-1", "writeback-2", "writeback-3", "writeback-4"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected a learning governance id to be available.");
        return value;
      };
    })(),
    now: () => new Date("2026-03-28T08:05:00.000Z"),
  });
  const api = createLearningGovernanceApi({
    learningGovernanceService: service,
  });

  return {
    activationMetricsService,
    api,
    editorialRuleRepository,
    knowledgeService,
    learningCandidateRepository,
    templateFamilyRepository,
    templateService,
  };
}

test("only approved learning candidates can create writebacks and duplicate active targets are rejected", async () => {
  const { api, learningCandidateRepository } = createLearningGovernanceHarness();

  await learningCandidateRepository.save({
    id: "candidate-draft-1",
    type: "prompt_optimization_candidate",
    status: "draft",
    module: "proofreading",
    manuscript_type: "review",
    created_by: "editor-1",
    created_at: "2026-03-28T07:50:00.000Z",
    updated_at: "2026-03-28T07:51:00.000Z",
  });
  await learningCandidateRepository.save({
    id: "candidate-approved-1",
    type: "prompt_optimization_candidate",
    status: "approved",
    module: "proofreading",
    manuscript_type: "review",
    created_by: "editor-1",
    created_at: "2026-03-28T07:52:00.000Z",
    updated_at: "2026-03-28T07:53:00.000Z",
  });

  await assert.rejects(
    () =>
      api.createWriteback({
        actorRole: "admin",
        input: {
          learningCandidateId: "candidate-draft-1",
          targetType: "prompt_template",
          createdBy: "admin-1",
        },
      }),
    /approved/i,
  );

  await assert.rejects(
    () =>
      api.createWriteback({
        actorRole: "editor",
        input: {
          learningCandidateId: "candidate-approved-1",
          targetType: "prompt_template",
          createdBy: "editor-1",
        },
      }),
    AuthorizationError,
  );

  const first = await api.createWriteback({
    actorRole: "admin",
    input: {
      learningCandidateId: "candidate-approved-1",
      targetType: "prompt_template",
      createdBy: "admin-1",
    },
  });

  assert.equal(first.body.status, "draft");

  await assert.rejects(
    () =>
      api.createWriteback({
        actorRole: "admin",
        input: {
          learningCandidateId: "candidate-approved-1",
          targetType: "prompt_template",
          createdBy: "admin-1",
        },
      }),
    LearningGovernanceConflictError,
  );
});

test("admin can apply writebacks into governed draft assets and list them by candidate", async () => {
  const { api, learningCandidateRepository, templateService } =
    createLearningGovernanceHarness();

  await learningCandidateRepository.save({
    id: "candidate-approved-1",
    type: "rule_candidate",
    status: "approved",
    module: "screening",
    manuscript_type: "clinical_study",
    created_by: "editor-1",
    created_at: "2026-03-28T07:50:00.000Z",
    updated_at: "2026-03-28T07:51:00.000Z",
  });
  await learningCandidateRepository.save({
    id: "candidate-approved-2",
    type: "template_update_candidate",
    status: "approved",
    module: "editing",
    manuscript_type: "review",
    created_by: "editor-1",
    created_at: "2026-03-28T07:52:00.000Z",
    updated_at: "2026-03-28T07:53:00.000Z",
  });

  const family = await templateService.createTemplateFamily({
    manuscriptType: "review",
    name: "综述模板族",
  });

  const knowledgeWriteback = await api.createWriteback({
    actorRole: "admin",
    input: {
      learningCandidateId: "candidate-approved-1",
      targetType: "knowledge_item",
      createdBy: "admin-1",
    },
  });
  const templateWriteback = await api.createWriteback({
    actorRole: "admin",
    input: {
      learningCandidateId: "candidate-approved-2",
      targetType: "module_template",
      createdBy: "admin-1",
    },
  });

  const appliedKnowledge = await api.applyWriteback({
    actorRole: "admin",
    input: {
      writebackId: knowledgeWriteback.body.id,
      targetType: "knowledge_item",
      appliedBy: "admin-1",
      title: "统计学报告补充规则",
      canonicalText: "临床研究需明确主要终点与统计方法。",
      knowledgeKind: "rule",
      moduleScope: "screening",
      manuscriptTypes: ["clinical_study"],
    },
  });
  const appliedTemplate = await api.applyWriteback({
    actorRole: "admin",
    input: {
      writebackId: templateWriteback.body.id,
      targetType: "module_template",
      appliedBy: "admin-1",
      templateFamilyId: family.id,
      module: "editing",
      manuscriptType: "review",
      prompt: "统一医学术语并补充结果与讨论衔接检查。",
      checklist: ["结果段完整性"],
    },
  });
  const listedCandidateOne = await api.listWritebacksByCandidate({
    learningCandidateId: "candidate-approved-1",
  });
  const listedCandidateTwo = await api.listWritebacksByCandidate({
    learningCandidateId: "candidate-approved-2",
  });

  assert.equal(appliedKnowledge.body.status, "applied");
  assert.equal(appliedKnowledge.body.created_draft_asset_id, "knowledge-1");
  assert.equal(appliedTemplate.body.status, "applied");
  assert.equal(appliedTemplate.body.created_draft_asset_id, "template-1");
  assert.equal(listedCandidateOne.body.length, 1);
  assert.equal(listedCandidateTwo.body.length, 1);
});

test("knowledge reviewers can write back knowledge candidates as revision-governed drafts without approving them", async () => {
  const { api, knowledgeService, learningCandidateRepository } =
    createLearningGovernanceHarness();

  await learningCandidateRepository.save({
    id: "candidate-knowledge-approved-1",
    type: "knowledge_candidate",
    status: "approved",
    module: "proofreading",
    manuscript_type: "clinical_study",
    title: "Table footnote guidance",
    proposal_text: "Create governed knowledge from reviewed table handling.",
    created_by: "proofreader-1",
    created_at: "2026-04-28T08:00:00.000Z",
    updated_at: "2026-04-28T08:00:00.000Z",
  });

  const writeback = await api.createWriteback({
    actorRole: "knowledge_reviewer",
    input: {
      learningCandidateId: "candidate-knowledge-approved-1",
      targetType: "knowledge_item",
      createdBy: "knowledge-reviewer-1",
    },
  });

  const applied = await api.applyWriteback({
    actorRole: "knowledge_reviewer",
    input: {
      writebackId: writeback.body.id,
      targetType: "knowledge_item",
      appliedBy: "knowledge-reviewer-1",
      title: "临床研究表注处理",
      canonicalText: "临床研究表格的表注应置于表下，并解释统计缩写。",
      summary: "从人工校对确认的表注处理经验回流。",
      knowledgeKind: "reference",
      moduleScope: "proofreading",
      manuscriptTypes: ["clinical_study"],
      sections: ["tables"],
      riskTags: ["table_quality"],
      disciplineTags: ["clinical_study"],
      evidenceLevel: "expert_opinion",
      sourceType: "internal_case",
      aliases: ["表注规范"],
      bindings: [
        {
          bindingKind: "section",
          bindingTargetId: "tables",
          bindingTargetLabel: "表格",
        },
      ],
    },
  });

  assert.equal(applied.body.status, "applied");
  assert.equal(applied.body.created_draft_asset_id, "knowledge-1");

  const detail = await knowledgeService.getKnowledgeAsset("knowledge-1");
  assert.equal(detail.asset.current_approved_revision_id, undefined);
  assert.equal(detail.selected_revision.status, "draft");
  assert.equal(
    detail.selected_revision.source_learning_candidate_id,
    "candidate-knowledge-approved-1",
  );
  assert.equal(detail.selected_revision.title, "临床研究表注处理");
  assert.deepEqual(detail.selected_revision.routing.sections, ["tables"]);
  assert.deepEqual(
    detail.selected_revision.bindings.map((binding) => ({
      kind: binding.binding_kind,
      target: binding.binding_target_id,
      label: binding.binding_target_label,
    })),
    [
      {
        kind: "section",
        target: "tables",
        label: "表格",
      },
    ],
  );
});

test("approved rule candidates can write back into editorial rule drafts with candidate provenance", async () => {
  const {
    activationMetricsService,
    api,
    editorialRuleRepository,
    learningCandidateRepository,
    templateFamilyRepository,
  } = createLearningGovernanceHarness();

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
  await editorialRuleRepository.saveRuleSet({
    id: "existing-rule-set-1",
    template_family_id: "family-1",
    journal_template_id: "journal-template-1",
    module: "editing",
    version_no: 9,
    status: "active",
  });
  await editorialRuleRepository.saveRule({
    id: "existing-rule-1",
    rule_set_id: "existing-rule-set-1",
    order_no: 10,
    rule_object: "abstract",
    rule_type: "format",
    execution_mode: "apply_and_inspect",
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
    authoring_payload: {
      normalized_example: AFTER_HEADING,
    },
    confidence_policy: "always_auto",
    severity: "error",
    enabled: true,
  });
  await learningCandidateRepository.save({
    id: "candidate-approved-rule",
    type: "rule_candidate",
    status: "approved",
    module: "editing",
    manuscript_type: "clinical_study",
    suggested_rule_object: "abstract",
    suggested_template_family_id: "family-1",
    suggested_journal_template_id: "journal-template-1",
    candidate_payload: {
      scope: {
        sections: ["abstract"],
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
      authoring_payload: {
        normalized_example: AFTER_HEADING,
      },
      explanation_payload: {
        rationale:
          "Abstract headings should normalize to full-width parentheses and full-width spacing.",
      },
      projection_payload: {
        projection_kind: "rule",
        summary: "Normalize abstract headings to the journal style.",
        standard_example: AFTER_HEADING,
        incorrect_example: BEFORE_HEADING,
      },
      related_rule_ids: ["existing-rule-1"],
      example_before: BEFORE_HEADING,
      example_after: AFTER_HEADING,
      confidence_policy: "always_auto",
      severity: "error",
      execution_mode: "apply_and_inspect",
      rule_type: "format",
    },
    created_by: "editor-1",
    created_at: "2026-03-28T07:54:00.000Z",
    updated_at: "2026-03-28T07:55:00.000Z",
  });

  const writeback = await api.createWriteback({
    actorRole: "admin",
    input: {
      learningCandidateId: "candidate-approved-rule",
      targetType: "editorial_rule_draft",
      createdBy: "admin-1",
    },
  });
  const applied = await api.applyWriteback({
    actorRole: "admin",
    input: {
      writebackId: writeback.body.id,
      targetType: "editorial_rule_draft",
      appliedBy: "admin-1",
    },
  });
  const createdRuleSet = await editorialRuleRepository.findRuleSetById("rule-set-1");
  const createdRules = await editorialRuleRepository.listRulesByRuleSetId("rule-set-1");

  assert.equal(applied.body.status, "applied");
  assert.equal(applied.body.created_draft_asset_id, "rule-1");
  assert.deepEqual(createdRuleSet, {
    id: "rule-set-1",
    template_family_id: "family-1",
    journal_template_id: "journal-template-1",
    module: "editing",
    version_no: 10,
    status: "draft",
  });
  assert.equal(createdRules[0]?.rule_object, "abstract");
  assert.equal(
    createdRules[0]?.linkage_payload?.source_learning_candidate_id,
    "candidate-approved-rule",
  );
  assert.equal(createdRules[0]?.example_before, BEFORE_HEADING);
  assert.equal(createdRules[0]?.example_after, AFTER_HEADING);

  const recordedMetrics =
    await activationMetricsService.getRuleMetrics("existing-rule-1");
  assert.equal(recordedMetrics.totals.writeback_created_count, 1);
  assert.equal(recordedMetrics.totals.writeback_applied_count, 1);
});

test("learning feedback verifier proves residual confirmation to activated knowledge with coverage gain", () => {
  const verifier = new LearningFeedbackLoopVerifier();

  const result = verifier.evaluate({
    residualIssue: {
      id: "residual-1",
      status: "candidate_created",
      learningCandidateId: "candidate-1",
      signalBreakdown: {
        promotion_evidence: {
          source: "proofreading_confirmation",
        },
      },
    },
    learningCandidate: {
      id: "candidate-1",
      status: "approved",
    },
    writeback: {
      id: "writeback-1",
      status: "applied",
      targetType: "knowledge_item",
      createdDraftAssetId: "knowledge-1",
    },
    laterProofreadingContext: {
      knowledgeItemIds: ["knowledge-1"],
      ruleIds: ["rule-1"],
    },
    goldSetCoverage: {
      beforeHitCount: 1,
      afterHitCount: 2,
    },
  });

  assert.equal(result.status, "closed");
  assert.deepEqual(result.stageStatus, {
    detected: true,
    humanConfirmed: true,
    candidateCreated: true,
    approved: true,
    activated: true,
  });
  assert.equal(result.coverageDelta, 1);
  assert.deepEqual(result.activatedKnowledgeItemIds, ["knowledge-1"]);
  assert.deepEqual(result.failedGateIds, []);
});

test("learning feedback verifier blocks rejected candidates and requires no-regression explanation without coverage gain", () => {
  const verifier = new LearningFeedbackLoopVerifier();

  const rejected = verifier.evaluate({
    residualIssue: {
      id: "residual-2",
      status: "candidate_created",
      learningCandidateId: "candidate-2",
    },
    learningCandidate: {
      id: "candidate-2",
      status: "rejected",
    },
    writeback: {
      id: "writeback-2",
      status: "applied",
      targetType: "knowledge_item",
      createdDraftAssetId: "knowledge-2",
    },
    laterProofreadingContext: {
      knowledgeItemIds: ["knowledge-2"],
      ruleIds: [],
    },
    goldSetCoverage: {
      beforeHitCount: 1,
      afterHitCount: 1,
    },
  });

  assert.equal(rejected.status, "blocked");
  assert.equal(rejected.stageStatus.activated, false);
  assert.ok(rejected.failedGateIds.includes("candidate_rejected"));

  const explainedNoRegression = verifier.evaluate({
    residualIssue: {
      id: "residual-3",
      status: "candidate_created",
      learningCandidateId: "candidate-3",
    },
    learningCandidate: {
      id: "candidate-3",
      status: "approved",
    },
    writeback: {
      id: "writeback-3",
      status: "applied",
      targetType: "knowledge_item",
      createdDraftAssetId: "knowledge-3",
    },
    laterProofreadingContext: {
      knowledgeItemIds: ["knowledge-3"],
      ruleIds: [],
    },
    goldSetCoverage: {
      beforeHitCount: 1,
      afterHitCount: 1,
      noRegressionExplanation:
        "The activated knowledge targets a manual-only issue not present in this gold-set shard.",
    },
  });

  assert.equal(explainedNoRegression.status, "closed");
  assert.equal(explainedNoRegression.coverageDelta, 0);
  assert.equal(
    explainedNoRegression.noRegressionExplanation,
    "The activated knowledge targets a manual-only issue not present in this gold-set shard.",
  );
  assert.deepEqual(explainedNoRegression.failedGateIds, []);
});
