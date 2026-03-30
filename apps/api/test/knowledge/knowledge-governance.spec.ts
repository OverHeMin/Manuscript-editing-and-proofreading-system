import test from "node:test";
import assert from "node:assert/strict";
import { createKnowledgeApi } from "../../src/modules/knowledge/knowledge-api.ts";
import {
  InMemoryKnowledgeRepository,
  InMemoryKnowledgeReviewActionRepository,
} from "../../src/modules/knowledge/in-memory-knowledge-repository.ts";
import { KnowledgeService } from "../../src/modules/knowledge/knowledge-service.ts";
import { InMemoryLearningCandidateRepository } from "../../src/modules/learning/in-memory-learning-repository.ts";
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
  const nextId = () => {
    const value = issuedIds.shift();
    assert.ok(value, "Expected a knowledge test id to be available.");
    return value;
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
