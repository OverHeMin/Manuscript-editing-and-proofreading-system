import test from "node:test";
import assert from "node:assert/strict";
import { createKnowledgeApi } from "../../src/modules/knowledge/knowledge-api.ts";
import {
  InMemoryKnowledgeRepository,
  InMemoryKnowledgeReviewActionRepository,
} from "../../src/modules/knowledge/in-memory-knowledge-repository.ts";
import { KnowledgeService } from "../../src/modules/knowledge/knowledge-service.ts";
import { EditorialRuleProjectionService } from "../../src/modules/editorial-rules/editorial-rule-projection-service.ts";
import { InMemoryEditorialRuleRepository } from "../../src/modules/editorial-rules/in-memory-editorial-rule-repository.ts";
import { InMemoryLearningCandidateRepository } from "../../src/modules/learning/in-memory-learning-repository.ts";
import { InMemoryTemplateFamilyRepository } from "../../src/modules/templates/in-memory-template-family-repository.ts";
import type { KnowledgeReviewActionRecord } from "../../src/modules/knowledge/knowledge-record.ts";

class FailingKnowledgeReviewActionRepository extends InMemoryKnowledgeReviewActionRepository {
  constructor(
    private readonly shouldFail: (record: KnowledgeReviewActionRecord) => boolean,
  ) {
    super();
  }

  override async save(record: KnowledgeReviewActionRecord): Promise<void> {
    if (this.shouldFail(record)) {
      throw new Error(`Injected review action write failure for ${record.action}.`);
    }

    await super.save(record);
  }
}

function createKnowledgeHarness(
  reviewActionRepository: InMemoryKnowledgeReviewActionRepository = new InMemoryKnowledgeReviewActionRepository(),
) {
  const repository = new InMemoryKnowledgeRepository();
  const learningCandidateRepository = new InMemoryLearningCandidateRepository();
  const issuedIds = [
    "knowledge-1",
    "review-action-1",
    "review-action-2",
    "knowledge-2",
    "review-action-3",
    "review-action-4",
    "knowledge-3",
  ];
  let fallbackId = 1;
  const nextId = () => {
    const value = issuedIds.shift();
    if (value) {
      return value;
    }

    const generated = `knowledge-generated-${fallbackId}`;
    fallbackId += 1;
    return generated;
  };
  const service = new KnowledgeService({
    repository,
    reviewActionRepository,
    learningCandidateRepository,
    now: () => new Date("2026-03-27T06:00:00.000Z"),
    createId: nextId,
  });
  const api = createKnowledgeApi({
    knowledgeService: service,
  });

  return {
    api,
    service,
    repository,
    reviewActionRepository,
    learningCandidateRepository,
  };
}

test("knowledge drafts can be created from an approved learning candidate with provenance", async () => {
  const { service, learningCandidateRepository } = createKnowledgeHarness();

  await learningCandidateRepository.save({
    id: "candidate-approved-1",
    type: "rule_candidate",
    status: "approved",
    module: "screening",
    manuscript_type: "clinical_study",
    title: "统计学报告补充规则",
    proposal_text: "补充主要终点与统计方法说明。",
    created_by: "editor-1",
    created_at: "2026-03-27T05:50:00.000Z",
    updated_at: "2026-03-27T05:55:00.000Z",
  });

  const record = await service.createDraftFromLearningCandidate("admin", {
    sourceLearningCandidateId: "candidate-approved-1",
    title: "统计学报告补充规则",
    canonicalText: "临床研究需明确主要终点与统计方法。",
    knowledgeKind: "rule",
    moduleScope: "screening",
    manuscriptTypes: ["clinical_study"],
  });

  assert.equal(record.status, "draft");
  assert.equal(record.source_learning_candidate_id, "candidate-approved-1");
});

test("create knowledge draft keeps routing fields editable before review", async () => {
  const { api } = createKnowledgeHarness();

  const response = await api.createDraft({
    title: "统计学方法报告规范",
    canonicalText: "临床研究需明确主要终点与统计学方法。",
    summary: "用于筛查统计学描述是否完整。",
    knowledgeKind: "rule",
    moduleScope: "screening",
    manuscriptTypes: ["clinical_study"],
    sections: ["methods"],
    riskTags: ["statistics"],
    disciplineTags: ["cardiology"],
    evidenceLevel: "high",
    sourceType: "guideline",
    sourceLink: "https://example.org/guideline",
    aliases: ["统计学完整性"],
    templateBindings: ["clinical-study-screening-core"],
  });

  assert.equal(response.status, 201);
  assert.deepEqual(response.body, {
    id: "knowledge-1",
    title: "统计学方法报告规范",
    canonical_text: "临床研究需明确主要终点与统计学方法。",
    summary: "用于筛查统计学描述是否完整。",
    knowledge_kind: "rule",
    status: "draft",
    routing: {
      module_scope: "screening",
      manuscript_types: ["clinical_study"],
      sections: ["methods"],
      risk_tags: ["statistics"],
      discipline_tags: ["cardiology"],
    },
    evidence_level: "high",
    source_type: "guideline",
    source_link: "https://example.org/guideline",
    aliases: ["统计学完整性"],
    template_bindings: ["clinical-study-screening-core"],
  });
});

test("knowledge reviewer approves a draft only after it enters pending review", async () => {
  const { api } = createKnowledgeHarness();

  const draft = await api.createDraft({
    title: "病例报告脱敏要求",
    canonicalText: "病例报告中的患者身份信息必须先脱敏。",
    knowledgeKind: "checklist",
    moduleScope: "any",
    manuscriptTypes: "any",
  });

  const submitted = await api.submitForReview({
    knowledgeItemId: draft.body.id,
  });
  const approved = await api.approve({
    knowledgeItemId: draft.body.id,
    actorRole: "knowledge_reviewer",
  });

  assert.equal(submitted.status, 200);
  assert.equal(submitted.body.status, "pending_review");
  assert.equal(approved.status, 200);
  assert.equal(approved.body.status, "approved");
});

test("knowledge drafts can be updated and listed before review", async () => {
  const { api } = createKnowledgeHarness();

  const draft = await api.createDraft({
    title: "初始标题",
    canonicalText: "初始正文",
    knowledgeKind: "reference",
    moduleScope: "editing",
    manuscriptTypes: ["review"],
  });

  const updated = await api.updateDraft({
    knowledgeItemId: draft.body.id,
    input: {
      title: "更新后标题",
      canonicalText: "更新后正文",
      summary: "更新摘要",
      riskTags: ["terminology"],
    },
  });
  const listed = await api.listKnowledgeItems();

  assert.equal(updated.status, 200);
  assert.equal(updated.body.title, "更新后标题");
  assert.equal(updated.body.canonical_text, "更新后正文");
  assert.equal(updated.body.summary, "更新摘要");
  assert.deepEqual(updated.body.routing.risk_tags, ["terminology"]);
  assert.equal(listed.status, 200);
  assert.equal(listed.body.length, 1);
  assert.equal(listed.body[0]?.id, draft.body.id);
});

test("knowledge items can be archived as the governed delete path", async () => {
  const { api } = createKnowledgeHarness();

  const draft = await api.createDraft({
    title: "待归档知识",
    canonicalText: "归档测试正文",
    knowledgeKind: "other",
    moduleScope: "any",
    manuscriptTypes: "any",
  });

  const archived = await api.archive({
    knowledgeItemId: draft.body.id,
  });

  assert.equal(archived.status, 200);
  assert.equal(archived.body.status, "archived");
});

test("submit for review rolls back the knowledge status when the audit write fails", async () => {
  const reviewActionRepository = new FailingKnowledgeReviewActionRepository(
    (record) => record.action === "submitted_for_review",
  );
  const { api, repository } = createKnowledgeHarness(reviewActionRepository);

  const draft = await api.createDraft({
    title: "提交送审回滚测试",
    canonicalText: "如果审计记录失败，状态不能停留在 pending_review。",
    knowledgeKind: "rule",
    moduleScope: "screening",
    manuscriptTypes: ["clinical_study"],
  });

  await assert.rejects(
    () =>
      api.submitForReview({
        knowledgeItemId: draft.body.id,
      }),
    /review action write failure/i,
  );

  const stored = await repository.findById(draft.body.id);

  assert.equal(stored?.status, "draft");
  assert.deepEqual(
    await reviewActionRepository.listByKnowledgeItemId(draft.body.id),
    [],
  );
});

test("approval rolls back the knowledge status when the audit write fails", async () => {
  const reviewActionRepository = new FailingKnowledgeReviewActionRepository(
    (record) => record.action === "approved",
  );
  const { api, repository } = createKnowledgeHarness(reviewActionRepository);

  const draft = await api.createDraft({
    title: "审批回滚测试",
    canonicalText: "如果审批审计记录失败，状态不能停留在 approved。",
    knowledgeKind: "checklist",
    moduleScope: "any",
    manuscriptTypes: "any",
  });
  await api.submitForReview({
    knowledgeItemId: draft.body.id,
  });

  await assert.rejects(
    () =>
      api.approve({
        knowledgeItemId: draft.body.id,
        actorRole: "knowledge_reviewer",
      }),
    /review action write failure/i,
  );

  const stored = await repository.findById(draft.body.id);

  assert.equal(stored?.status, "pending_review");
  assert.deepEqual(
    await reviewActionRepository.listByKnowledgeItemId(draft.body.id),
    [
      {
        id: "review-action-1",
        knowledge_item_id: draft.body.id,
        action: "submitted_for_review",
        actor_role: "user",
        created_at: "2026-03-27T06:00:00.000Z",
      },
    ],
  );
});

test("knowledge review queue lists pending items and preserves note-aware audit history", async () => {
  const { api } = createKnowledgeHarness();

  const approvedCandidate = await api.createDraft({
    title: "Pending review A",
    canonicalText: "Pending review A canonical text",
    knowledgeKind: "reference",
    moduleScope: "editing",
    manuscriptTypes: ["review"],
  });
  const rejectedCandidate = await api.createDraft({
    title: "Pending review B",
    canonicalText: "Pending review B canonical text",
    knowledgeKind: "rule",
    moduleScope: "screening",
    manuscriptTypes: ["clinical_study"],
  });

  await api.submitForReview({
    knowledgeItemId: approvedCandidate.body.id,
  });
  await api.submitForReview({
    knowledgeItemId: rejectedCandidate.body.id,
  });

  const queueBeforeDecision = await api.listPendingReviewItems();
  const approved = await api.approve({
    knowledgeItemId: approvedCandidate.body.id,
    actorRole: "knowledge_reviewer",
    reviewNote: "Approved for mini-program publishing.",
  });
  const rejected = await api.reject({
    knowledgeItemId: rejectedCandidate.body.id,
    actorRole: "knowledge_reviewer",
    reviewNote: "Please clarify the evidence source before resubmitting.",
  });
  const queueAfterDecision = await api.listPendingReviewItems();
  const approvedHistory = await api.listReviewActions({
    knowledgeItemId: approvedCandidate.body.id,
  });
  const rejectedHistory = await api.listReviewActions({
    knowledgeItemId: rejectedCandidate.body.id,
  });

  assert.equal(queueBeforeDecision.status, 200);
  assert.equal(queueBeforeDecision.body.length, 2);
  assert.equal(approved.body.status, "approved");
  assert.equal(rejected.body.status, "draft");
  assert.equal(queueAfterDecision.status, 200);
  assert.equal(queueAfterDecision.body.length, 0);
  assert.deepEqual(
    approvedHistory.body.map((record) => ({
      action: record.action,
      review_note: record.review_note,
    })),
    [
      {
        action: "submitted_for_review",
        review_note: undefined,
      },
      {
        action: "approved",
        review_note: "Approved for mini-program publishing.",
      },
    ],
  );
  assert.deepEqual(
    rejectedHistory.body.map((record) => ({
      action: record.action,
      review_note: record.review_note,
    })),
    [
      {
        action: "submitted_for_review",
        review_note: undefined,
      },
      {
        action: "rejected",
        review_note: "Please clarify the evidence source before resubmitting.",
      },
    ],
  );
});

test("generated editorial-rule projections remain traceable and refresh in place", async () => {
  const knowledgeRepository = new InMemoryKnowledgeRepository();
  const editorialRuleRepository = new InMemoryEditorialRuleRepository();
  const templateFamilyRepository = new InMemoryTemplateFamilyRepository();
  const projectionService = new EditorialRuleProjectionService({
    editorialRuleRepository,
    knowledgeRepository,
    templateFamilyRepository,
    createId: (() => {
      const ids = [
        "knowledge-rule-1",
        "knowledge-checklist-1",
        "knowledge-snippet-1",
        "knowledge-rule-2",
      ];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected a projected knowledge id to be available.");
        return value;
      };
    })(),
  });

  await templateFamilyRepository.save({
    id: "family-1",
    manuscript_type: "clinical_study",
    name: "Clinical study family",
    status: "active",
  });
  await editorialRuleRepository.saveRuleSet({
    id: "rule-set-1",
    template_family_id: "family-1",
    module: "editing",
    version_no: 1,
    status: "published",
  });
  await editorialRuleRepository.saveRule({
    id: "rule-1",
    rule_set_id: "rule-set-1",
    order_no: 10,
    rule_object: "generic",
    rule_type: "format",
    execution_mode: "apply_and_inspect",
    scope: {
      sections: ["abstract"],
    },
    selector: {},
    trigger: {
      kind: "exact_text",
      text: "摘要 目的",
    },
    action: {
      kind: "replace_heading",
      to: "（摘要　目的）",
    },
    authoring_payload: {},
    confidence_policy: "always_auto",
    severity: "error",
    enabled: true,
    example_before: "摘要 目的",
    example_after: "（摘要　目的）",
  });

  await projectionService.refreshPublishedRuleSet("rule-set-1");
  await projectionService.refreshPublishedRuleSet("rule-set-1");

  const projected = await knowledgeRepository.list();
  const projectedRuleKnowledge = projected.find(
    (record) => record.projection_source?.projection_kind === "rule",
  );

  assert.equal(projected.length, 3);
  assert.equal(
    projectedRuleKnowledge?.projection_source?.source_kind,
    "editorial_rule_projection",
  );
  assert.equal(projectedRuleKnowledge?.projection_source?.rule_set_id, "rule-set-1");
  assert.equal(projectedRuleKnowledge?.projection_source?.rule_id, "rule-1");
  assert.equal(projectedRuleKnowledge?.routing.module_scope, "editing");
  assert.deepEqual(
    projectedRuleKnowledge?.projection_source?.projection_context,
    {
      module: "editing",
      manuscript_type: "clinical_study",
      template_family_id: "family-1",
      rule_object: "generic",
      standard_example: "（摘要　目的）",
      incorrect_example: "摘要 目的",
      not_applicable_boundary: "",
    },
  );
});

test("duplicate check returns exact, high, and possible matches by asset using representative revisions", async () => {
  const { service } = createKnowledgeHarness();

  const exact = await service.createLibraryDraft({
    title: "统计学报告补充规范",
    canonicalText: "临床研究需说明主要终点与统计方法。",
    summary: "用于筛查统计学描述是否完整。",
    knowledgeKind: "rule",
    moduleScope: "screening",
    manuscriptTypes: ["clinical_study"],
    aliases: ["统计学完整性"],
    templateBindings: ["screening-core-template"],
  });
  await service.submitRevisionForReview(exact.selected_revision.id);
  await service.approveRevision(
    exact.selected_revision.id,
    "knowledge_reviewer",
    "baseline approved",
  );

  const high = await service.createLibraryDraft({
    title: "统计学报告补充规范 扩展",
    canonicalText: "临床研究需说明主要终点与统计方法，并注明分析假设。",
    summary: "用于识别统计方法表述不足。",
    knowledgeKind: "rule",
    moduleScope: "screening",
    manuscriptTypes: ["clinical_study"],
    aliases: ["统计学说明"],
    templateBindings: ["screening-core-template"],
  });
  await service.submitRevisionForReview(high.selected_revision.id);
  await service.approveRevision(
    high.selected_revision.id,
    "knowledge_reviewer",
    "baseline approved",
  );
  const highDraft = await service.createDraftRevisionFromApprovedAsset(high.asset.id);
  await service.updateRevisionDraft(highDraft.selected_revision.id, {
    title: "一个与匹配无关的更新草稿标题",
    canonicalText: "这个草稿文本故意不重叠，用于验证仍以已批准版本作为代表。",
  });

  const possible = await service.createLibraryDraft({
    title: "术语规范建议",
    canonicalText: "投稿文本应尽量统一医学术语，避免口语化表达。",
    summary: "弱相关项，仅依赖上下文维度命中。",
    knowledgeKind: "rule",
    moduleScope: "screening",
    manuscriptTypes: ["clinical_study"],
    aliases: ["统计学完整性"],
    templateBindings: ["screening-core-template"],
  });
  await service.submitRevisionForReview(possible.selected_revision.id);
  await service.approveRevision(
    possible.selected_revision.id,
    "knowledge_reviewer",
    "baseline approved",
  );

  const matches = await service.checkDuplicates({
    title: "统计学报告补充规范",
    canonicalText: "临床研究需说明主要终点与统计方法。",
    knowledgeKind: "rule",
    moduleScope: "screening",
    manuscriptTypes: ["clinical_study"],
    aliases: ["统计学完整性"],
    bindings: ["screening-core-template"],
  });

  assert.equal(matches.length, 3);

  assert.equal(matches[0]?.severity, "exact");
  assert.equal(matches[0]?.matched_asset_id, exact.asset.id);
  assert.equal(matches[0]?.matched_revision_id, exact.selected_revision.id);
  assert.equal(matches[0]?.matched_status, "approved");
  assert.ok(matches[0]?.reasons.includes("canonical_text_exact_match"));

  assert.equal(matches[1]?.severity, "high");
  assert.equal(matches[1]?.matched_asset_id, high.asset.id);
  assert.equal(matches[1]?.matched_status, "approved");
  assert.equal(matches[1]?.matched_revision_id, high.selected_revision.id);
  assert.ok(matches[1]?.reasons.includes("same_module_scope"));
  assert.ok(matches[1]?.reasons.includes("canonical_text_high_overlap"));

  assert.equal(matches[2]?.severity, "possible");
  assert.equal(matches[2]?.matched_asset_id, possible.asset.id);
  assert.equal(matches[2]?.matched_status, "approved");
  assert.ok(matches[2]?.reasons.includes("alias_overlap"));
});

test("duplicate check excludes self by current asset or current revision", async () => {
  const { service } = createKnowledgeHarness();

  const duplicate = await service.createLibraryDraft({
    title: "知情同意关键要素",
    canonicalText: "知情同意应包含风险、获益与替代方案。",
    knowledgeKind: "checklist",
    moduleScope: "screening",
    manuscriptTypes: ["clinical_study"],
  });
  await service.submitRevisionForReview(duplicate.selected_revision.id);
  await service.approveRevision(
    duplicate.selected_revision.id,
    "knowledge_reviewer",
    "approved",
  );

  const byAsset = await service.checkDuplicates({
    currentAssetId: duplicate.asset.id,
    title: "知情同意关键要素",
    canonicalText: "知情同意应包含风险、获益与替代方案。",
    knowledgeKind: "checklist",
    moduleScope: "screening",
    manuscriptTypes: ["clinical_study"],
  });
  assert.deepEqual(byAsset, []);

  const byRevision = await service.checkDuplicates({
    currentRevisionId: duplicate.selected_revision.id,
    title: "知情同意关键要素",
    canonicalText: "知情同意应包含风险、获益与替代方案。",
    knowledgeKind: "checklist",
    moduleScope: "screening",
    manuscriptTypes: ["clinical_study"],
  });
  assert.deepEqual(byRevision, []);
});
