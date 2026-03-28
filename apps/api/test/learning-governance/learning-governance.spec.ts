import test from "node:test";
import assert from "node:assert/strict";
import { AuthorizationError } from "../../src/auth/permission-guard.ts";
import { InMemoryLearningCandidateRepository } from "../../src/modules/learning/in-memory-learning-repository.ts";
import { InMemoryKnowledgeRepository, InMemoryKnowledgeReviewActionRepository } from "../../src/modules/knowledge/in-memory-knowledge-repository.ts";
import { KnowledgeService } from "../../src/modules/knowledge/knowledge-service.ts";
import { createLearningGovernanceApi } from "../../src/modules/learning-governance/learning-governance-api.ts";
import { InMemoryLearningGovernanceRepository } from "../../src/modules/learning-governance/in-memory-learning-governance-repository.ts";
import {
  LearningGovernanceConflictError,
  LearningGovernanceService,
} from "../../src/modules/learning-governance/learning-governance-service.ts";
import { InMemoryPromptSkillRegistryRepository } from "../../src/modules/prompt-skill-registry/in-memory-prompt-skill-repository.ts";
import { PromptSkillRegistryService } from "../../src/modules/prompt-skill-registry/prompt-skill-service.ts";
import {
  InMemoryModuleTemplateRepository,
  InMemoryTemplateFamilyRepository,
} from "../../src/modules/templates/in-memory-template-family-repository.ts";
import { TemplateGovernanceService } from "../../src/modules/templates/template-governance-service.ts";

function createLearningGovernanceHarness() {
  const learningCandidateRepository = new InMemoryLearningCandidateRepository();
  const repository = new InMemoryLearningGovernanceRepository();
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
    templateFamilyRepository: new InMemoryTemplateFamilyRepository(),
    moduleTemplateRepository: new InMemoryModuleTemplateRepository(),
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
    promptSkillRegistryService,
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
    api,
    learningCandidateRepository,
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
