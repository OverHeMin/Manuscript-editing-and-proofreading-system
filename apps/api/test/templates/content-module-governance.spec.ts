import test from "node:test";
import assert from "node:assert/strict";
import {
  InMemoryModuleTemplateRepository,
  InMemoryTemplateFamilyRepository,
  type TemplateModule,
  TemplateGovernanceService,
} from "../../src/modules/templates/index.ts";
import { InMemoryExtractionTaskRepository } from "../../src/modules/editorial-rules/index.ts";
import type {
  ExtractionTaskCandidateRecord,
  ExtractionTaskRecord,
} from "../../src/modules/editorial-rules/extraction-task-record.ts";

function createTemplateGovernanceHarness(options: {
  issuedIds?: string[];
} = {}) {
  const templateFamilyRepository = new InMemoryTemplateFamilyRepository();
  const moduleTemplateRepository = new InMemoryModuleTemplateRepository();
  const extractionTaskRepository = new InMemoryExtractionTaskRepository();
  const issuedIds = [...(options.issuedIds ?? ["content-module-1", "template-composition-1"])];

  const service = new TemplateGovernanceService({
    templateFamilyRepository,
    moduleTemplateRepository,
    contentModuleRepository: templateFamilyRepository,
    templateCompositionRepository: templateFamilyRepository,
    extractionTaskRepository,
    createId: () => {
      const nextId = issuedIds.shift();
      assert.ok(nextId, "Expected a governed template test id.");
      return nextId;
    },
  });

  return {
    service,
    extractionTaskRepository,
  };
}

test("template governance service intakes confirmed candidates into governed content modules", async () => {
  const { service, extractionTaskRepository } = createTemplateGovernanceHarness();

  await seedExtractionCandidate(extractionTaskRepository, {
    task: {
      id: "task-1",
      task_name: "Clinical statistics intake",
      manuscript_type: "clinical_study",
      original_file_name: "original.docx",
      edited_file_name: "edited.docx",
      journal_key: "nejm",
      source_session_id: "session-1",
      status: "completed",
      candidate_count: 1,
      pending_confirmation_count: 0,
      created_at: "2026-04-13T12:00:00.000Z",
      updated_at: "2026-04-13T12:10:00.000Z",
    },
    candidate: buildCandidate({
      id: "candidate-1",
      taskId: "task-1",
      title: "统计表达校验",
      confirmationStatus: "confirmed",
      suggestedDestination: "medical_module",
      executionModules: ["editing", "proofreading"],
      sections: ["results", "discussion"],
      semanticSummary: "统一统计学显著性与效应量表达。",
    }),
  });

  const created = await service.createContentModuleDraftFromCandidate({
    taskId: "task-1",
    candidateId: "candidate-1",
    moduleClass: "medical_specialized",
  });

  assert.equal(created.module_class, "medical_specialized");
  assert.equal(created.status, "draft");
  assert.equal(created.source_task_id, "task-1");
  assert.equal(created.source_candidate_id, "candidate-1");
  assert.deepEqual(created.execution_module_scope, ["editing", "proofreading"]);
  assert.deepEqual(created.applicable_sections, ["results", "discussion"]);
  assert.equal(created.summary, "统一统计学显著性与效应量表达。");
});

test("template governance service intakes confirmed template candidates into template skeleton drafts", async () => {
  const { service, extractionTaskRepository } = createTemplateGovernanceHarness({
    issuedIds: ["template-composition-1"],
  });

  await seedExtractionCandidate(extractionTaskRepository, {
    task: {
      id: "task-2",
      task_name: "Front matter template intake",
      manuscript_type: "review",
      original_file_name: "review-original.docx",
      edited_file_name: "review-edited.docx",
      source_session_id: "session-2",
      status: "completed",
      candidate_count: 1,
      pending_confirmation_count: 0,
      created_at: "2026-04-13T12:30:00.000Z",
      updated_at: "2026-04-13T12:35:00.000Z",
    },
    candidate: buildCandidate({
      id: "candidate-2",
      taskId: "task-2",
      title: "综述前置信息模板",
      confirmationStatus: "confirmed",
      suggestedDestination: "template",
      executionModules: ["editing"],
      sections: ["front_matter"],
      semanticSummary: "形成综述稿件通用的前置信息模板骨架。",
    }),
  });

  const created = await service.createTemplateCompositionDraftFromCandidate({
    taskId: "task-2",
    candidateId: "candidate-2",
  });

  assert.equal(created.name, "综述前置信息模板");
  assert.equal(created.manuscript_type, "review");
  assert.deepEqual(created.execution_module_scope, ["editing"]);
  assert.deepEqual(created.general_module_ids, []);
  assert.deepEqual(created.medical_module_ids, []);
  assert.deepEqual(created.source_candidate_ids, ["candidate-2"]);
  assert.equal(created.status, "draft");
});

test("content module list exposes template usage counts for both ledgers", async () => {
  const { service } = createTemplateGovernanceHarness({
    issuedIds: [
      "general-module-1",
      "medical-module-1",
      "template-composition-1",
    ],
  });

  const generalModule = await service.createContentModuleDraft({
    moduleClass: "general",
    name: "参考文献格式统一",
    category: "reference",
    manuscriptTypeScope: ["review"],
    executionModuleScope: ["editing"],
    summary: "统一参考文献著录顺序与标点。",
  });
  const medicalModule = await service.createContentModuleDraft({
    moduleClass: "medical_specialized",
    name: "伦理声明核查",
    category: "ethics",
    manuscriptTypeScope: ["clinical_study"],
    executionModuleScope: ["screening", "editing"],
    summary: "检查伦理批准与知情同意表述。",
    evidenceLevel: "high",
    riskLevel: "high",
  });

  await service.createTemplateCompositionDraft({
    name: "临床研究主模板",
    manuscriptType: "clinical_study",
    generalModuleIds: [generalModule.id],
    medicalModuleIds: [medicalModule.id],
    executionModuleScope: ["screening", "editing"],
  });

  const generalModules = await service.listContentModules({
    moduleClass: "general",
  });
  const medicalModules = await service.listContentModules({
    moduleClass: "medical_specialized",
  });

  assert.equal(generalModules[0]?.template_usage_count, 1);
  assert.equal(medicalModules[0]?.template_usage_count, 1);
});

function buildCandidate(input: {
  id: string;
  taskId: string;
  title: string;
  confirmationStatus: ExtractionTaskCandidateRecord["confirmation_status"];
  suggestedDestination: ExtractionTaskCandidateRecord["suggested_destination"];
  executionModules: TemplateModule[];
  sections: string[];
  semanticSummary: string;
}): ExtractionTaskCandidateRecord {
  return {
    id: input.id,
    task_id: input.taskId,
    package_id: `${input.id}-package`,
    package_kind: "front_matter",
    title: input.title,
    confirmation_status: input.confirmationStatus,
    suggested_destination: input.suggestedDestination,
    candidate_payload: {
      package_id: `${input.id}-package`,
      package_kind: "front_matter",
      title: input.title,
      rule_object: "front_matter",
      suggested_layer: "journal_template",
      automation_posture: "guarded_auto",
      status: "draft",
      cards: {
        rule_what: {
          title: input.title,
          object: "front_matter",
          publish_layer: "journal_template",
        },
        ai_understanding: {
          summary: input.semanticSummary,
          hit_objects: ["front_matter"],
          hit_locations: input.sections,
        },
        applicability: {
          manuscript_types: ["clinical_study"],
          modules: input.executionModules,
          sections: input.sections,
          table_targets: [],
        },
        evidence: {
          examples: [],
        },
        exclusions: {
          not_applicable_when: [],
          human_review_required_when: [],
          risk_posture: "guarded_auto",
        },
      },
      preview: {
        hit_summary: input.semanticSummary,
        hits: [],
        misses: [],
        decision: {
          automation_posture: "guarded_auto",
          needs_human_review: true,
          reason: "Needs governed intake review.",
        },
      },
      semantic_draft: {
        semantic_summary: input.semanticSummary,
        hit_scope: ["front_matter"],
        applicability: input.sections,
        evidence_examples: [],
        failure_boundaries: [],
        normalization_recipe: ["Normalize this candidate into a governed asset."],
        review_policy: ["Human confirms destination before intake."],
        confirmed_fields: ["summary"],
      },
    },
    semantic_draft_payload: {
      semantic_summary: input.semanticSummary,
      hit_scope: ["front_matter"],
      applicability: input.sections,
      evidence_examples: [],
      failure_boundaries: [],
      normalization_recipe: ["Normalize this candidate into a governed asset."],
      review_policy: ["Human confirms destination before intake."],
      confirmed_fields: ["summary"],
    },
    created_at: "2026-04-13T12:00:00.000Z",
    updated_at: "2026-04-13T12:00:00.000Z",
  };
}

async function seedExtractionCandidate(
  repository: InMemoryExtractionTaskRepository,
  input: {
    task: ExtractionTaskRecord;
    candidate: ExtractionTaskCandidateRecord;
  },
): Promise<void> {
  await repository.saveTask(input.task);
  await repository.saveCandidate(input.candidate);
}
