import test from "node:test";
import assert from "node:assert/strict";
import { EditingService } from "../../src/modules/editing/editing-service.ts";
import { getBareModulePromptSkeleton } from "../../src/modules/shared/bare-module-prompt-skeletons.ts";
import { ModuleTemplateFamilyNotConfiguredError } from "../../src/modules/shared/module-run-support.ts";
import type {
  ExecuteMainlineAiInput,
  MainlineAiRuntimeExecutor,
} from "../../src/modules/shared/mainline-ai-runtime-executor.ts";
import { seedMedicalQualityFixture } from "../shared/medical-quality-fixture.ts";

test("editing bare mode succeeds without a current template family while governed mode still fails", async () => {
  const harness = await seedMedicalQualityFixture();
  const manuscript = await harness.manuscriptRepository.findById("manuscript-1");
  assert.ok(manuscript);
  await harness.manuscriptRepository.save({
    ...manuscript,
    current_template_family_id: undefined,
    current_journal_template_id: "journal-template-1",
  });
  const editingExecutor: MainlineAiRuntimeExecutor = {
    async executeJson<T>(_input: ExecuteMainlineAiInput): Promise<T> {
      return {
        summary: "AI editing plan for bare mode.",
        replacements: [
          {
            targetText: "摘要 目的",
            replacementText: "（摘要 目的）",
            reason: "Normalize abstract heading punctuation.",
          },
        ],
        manualReviewItems: ["Verify the rewritten heading against the journal template."],
      } as T;
    },
    async executeMarkdown() {
      throw new Error("Editing runs should request structured JSON.");
    },
  };

  let nextJobId = 0;
  const editingService = new EditingService({
    manuscriptRepository: harness.manuscriptRepository,
    assetRepository: harness.assetRepository,
    templateFamilyRepository: harness.templateFamilyRepository,
    moduleTemplateRepository: harness.moduleTemplateRepository,
    promptSkillRegistryRepository: harness.promptSkillRegistryRepository,
    knowledgeRepository: harness.knowledgeRepository,
    executionGovernanceService: harness.executionGovernanceService,
    executionTrackingService: harness.executionTrackingService,
    jobRepository: harness.jobRepository,
    documentAssetService: harness.documentAssetService,
    aiGatewayService: harness.aiGatewayService,
    sandboxProfileService: harness.sandboxProfileService,
    agentProfileService: harness.agentProfileService,
    agentRuntimeService: harness.agentRuntimeService,
    runtimeBindingService: harness.runtimeBindingService,
    toolPermissionPolicyService: harness.toolPermissionPolicyService,
    agentExecutionService: harness.agentExecutionService,
    agentExecutionOrchestrationService: {
      async dispatchBestEffort() {
        return undefined;
      },
    } as never,
    documentStructureService: {
      async extract() {
        return {
          manuscript_id: "manuscript-1",
          asset_id: harness.originalAssetId,
          file_name: "editing-bare.docx",
          status: "ready",
          parser: "python_docx",
          sections: [],
          metadata_candidates: [
            {
              candidate_id: "author_line:body:p:0",
              slot_key: "author_line",
              raw_text: "张三, 李四",
              normalized_text: "张三, 李四",
              source_zone: "title_area",
              source_locator: "body:p:0",
              semantic_role: "author_line",
              confidence: 0.95,
              recommended_action: "move_to_target",
            },
            {
              candidate_id: "affiliation_line:body:p:1",
              slot_key: "affiliation_line",
              raw_text: "上海交通大学医学院附属瑞金医院心内科",
              normalized_text: "上海交通大学医学院附属瑞金医院心内科",
              source_zone: "title_area",
              source_locator: "body:p:1",
              semantic_role: "affiliation_line",
              confidence: 0.92,
              recommended_action: "move_to_target",
            },
          ],
          tables: [],
          objects: [
            {
              object_id: "object-1",
              object_kind: "image",
              container_kind: "paragraph",
              source_zone: "body",
              source_locator: "body:p:2",
              original_tag: "drawing",
              relationship_id: "rId5",
              evidence_text: "卡方检验符号图片",
              intended_target: "χ²",
            },
          ],
          warnings: [],
        };
      },
    },
    mainlineAiRuntimeExecutor: editingExecutor,
    editorialDocxTransformService: {
      async applyDeterministicRules() {
        return {
          appliedRuleIds: [],
          appliedChanges: [],
          tableInspectionFindings: [],
          skippedAiReplacements: [
            {
              replacementId: "ai-replacement-1",
              reason: "anchor_not_precise",
              targetText: "摘要 目的",
            },
          ],
        };
      },
    } as never,
    createId: () => `job-editing-bare-${++nextJobId}`,
    now: () => new Date("2026-04-16T10:35:00.000Z"),
  } as never);

  await assert.rejects(
    () =>
      editingService.run({
        manuscriptId: "manuscript-1",
        parentAssetId: harness.originalAssetId,
        requestedBy: "editor-1",
        actorRole: "editor",
        storageKey: "runs/manuscript-1/editing/governed.docx",
        fileName: "editing-governed.docx",
      }),
    ModuleTemplateFamilyNotConfiguredError,
  );

  const result = await editingService.run({
    manuscriptId: "manuscript-1",
    parentAssetId: harness.originalAssetId,
    requestedBy: "editor-1",
    actorRole: "editor",
    storageKey: "runs/manuscript-1/editing/bare.docx",
    fileName: "editing-bare.docx",
    executionMode: "bare",
  });

  const bareSkeleton = getBareModulePromptSkeleton("editing");
  assert.equal(result.asset.asset_type, "edited_docx");
  assert.equal(result.template_id, bareSkeleton.templateId);
  assert.equal(result.model_id, "model-1");
  assert.equal(result.job.payload?.executionMode, "bare");
  assert.deepEqual(result.job.payload?.appliedRuleIds, []);
  const editingPayload = result.job.payload as
    | {
        editingPlan?: {
          summary?: string;
          replacements?: Array<{
            targetText?: string;
            replacementText?: string;
            reason?: string;
          }>;
          manualReviewItems?: unknown[];
        };
        skippedAiReplacements?: Array<{
          replacementId?: string;
          reason?: string;
          targetText?: string;
        }>;
        editingCompletionGateSummary?: {
          verdict?: string;
          high_risk_object_items?: Array<{
            summary?: string;
            detail?: string;
            location_text?: string;
          }>;
        };
      }
    | undefined;

  assert.ok(
    editingPayload?.editingPlan,
    "Expected editing bare runs to persist an AI replacement plan.",
  );
  assert.equal(
    editingPayload.editingPlan?.summary,
    "AI editing plan for bare mode.",
  );
  assert.deepEqual(editingPayload.editingPlan?.replacements, [
    {
      targetText: "摘要 目的",
      replacementText: "（摘要 目的）",
      reason: "Normalize abstract heading punctuation.",
    },
  ]);
  assert.deepEqual(editingPayload.editingPlan?.manualReviewItems, [
    "Verify the rewritten heading against the journal template.",
  ]);
  assert.deepEqual(editingPayload.skippedAiReplacements, [
    {
      replacementId: "ai-replacement-1",
      reason: "anchor_not_precise",
      targetText: "摘要 目的",
    },
  ]);
  assert.equal(
    editingPayload.editingCompletionGateSummary?.verdict,
    "blocked_by_high_risk_objects",
  );
  assert.deepEqual(
    editingPayload.editingCompletionGateSummary?.high_risk_object_items?.map((item) => ({
      summary: item.summary,
      detail: item.detail,
      location_text: item.location_text,
    })),
    [
      {
        summary: "高风险对象待人工确认：图片对象",
        detail:
          "原始对象：图片对象 / drawing / rId5；提取证据：卡方检验符号图片；意图目标：χ²；降级原因：object_type_not_safe",
        location_text: "body:p:2",
      },
    ],
  );
});

test("editing slot governance persists slot states and replays manual resolutions on rerun", async () => {
  const harness = await seedMedicalQualityFixture();
  const manuscript = await harness.manuscriptRepository.findById("manuscript-1");
  assert.ok(manuscript);
  await harness.manuscriptRepository.save({
    ...manuscript,
    current_journal_template_id: "journal-template-1",
    editing_slot_governance_summary: {
      observation_status: "reported",
      journal_template_id: "journal-template-1",
      target_model_version_id: "journal-template-1-v1",
      target_model_version_no: 1,
      generated_at: "2026-04-16T10:00:00.000Z",
      unresolved_required_count: 0,
      blocking_slot_keys: [],
      slots: [],
      manual_resolutions: [
        {
          slot_key: "classification_code",
          resolution_kind: "manual_entry",
          resolved_text: "R541.4",
          note: "Operator confirmed the classification code from the journal checklist.",
          applied_by: "editor-1",
          applied_at: "2026-04-16T10:00:00.000Z",
        },
      ],
    },
  });

  let nextJobId = 0;
  const editingService = new EditingService({
    manuscriptRepository: harness.manuscriptRepository,
    assetRepository: harness.assetRepository,
    templateFamilyRepository: harness.templateFamilyRepository,
    moduleTemplateRepository: harness.moduleTemplateRepository,
    promptSkillRegistryRepository: harness.promptSkillRegistryRepository,
    knowledgeRepository: harness.knowledgeRepository,
    executionGovernanceService: harness.executionGovernanceService,
    executionTrackingService: harness.executionTrackingService,
    jobRepository: harness.jobRepository,
    documentAssetService: harness.documentAssetService,
    aiGatewayService: harness.aiGatewayService,
    sandboxProfileService: harness.sandboxProfileService,
    agentProfileService: harness.agentProfileService,
    agentRuntimeService: harness.agentRuntimeService,
    runtimeBindingService: harness.runtimeBindingService,
    toolPermissionPolicyService: harness.toolPermissionPolicyService,
    agentExecutionService: harness.agentExecutionService,
    agentExecutionOrchestrationService: {
      async dispatchBestEffort() {
        return undefined;
      },
    } as never,
    manuscriptQualitySourceBlockResolver: {
      async resolveBlocks() {
        return [
          {
            text: "张三, 李四",
            section: "front_matter",
            block_kind: "paragraph",
            source_zone: "title_area",
            source_locator: "body:p:1",
          },
          {
            text: "上海交通大学医学院附属瑞金医院心内科",
            section: "front_matter",
            block_kind: "paragraph",
            source_zone: "title_area",
            source_locator: "body:p:2",
          },
        ];
      },
    },
    documentStructureService: {
      async extract() {
        return {
          manuscript_id: "manuscript-1",
          asset_id: harness.originalAssetId,
          file_name: "original.docx",
          status: "ready",
          parser: "python_docx",
          sections: [],
          metadata_candidates: [
            {
              candidate_id: "author_line:body:p:1:zhangsanlisi",
              slot_key: "author_line",
              raw_text: "张三, 李四",
              normalized_text: "张三, 李四",
              source_zone: "title_area",
              source_locator: "body:p:1",
              semantic_role: "author_line",
              confidence: 0.84,
              recommended_action: "move_to_target",
            },
            {
              candidate_id: "affiliation_line:body:p:2:ruijin",
              slot_key: "affiliation_line",
              raw_text: "上海交通大学医学院附属瑞金医院心内科",
              normalized_text: "上海交通大学医学院附属瑞金医院心内科",
              source_zone: "title_area",
              source_locator: "body:p:2",
              semantic_role: "affiliation_line",
              confidence: 0.88,
              recommended_action: "move_to_target",
            },
            {
              candidate_id: "funding_statement:header:p:0:nn",
              slot_key: "funding_statement",
              raw_text: "国家自然科学基金（12345678）",
              normalized_text: "国家自然科学基金（12345678）",
              source_zone: "header",
              source_locator: "header:word/header1.xml:p:0",
              semantic_role: "funding_statement",
              confidence: 0.97,
              recommended_action: "manual_review",
            },
          ],
          tables: [],
          warnings: [],
        };
      },
    },
    mainlineAiRuntimeExecutor: {
      async executeJson<T>() {
        return {
          summary: "AI editing plan with slot governance.",
          replacements: [],
          manualReviewItems: [],
        } as T;
      },
      async executeMarkdown() {
        throw new Error("Editing runs should request structured JSON.");
      },
    },
    editorialDocxTransformService: {
      async applyDeterministicRules() {
        return {
          appliedRuleIds: [],
          appliedChanges: [],
          tableInspectionFindings: [],
          tablePatchPlans: [],
          tablePatchResults: [],
          skippedAiReplacements: [],
        };
      },
    } as never,
    createId: () => `job-editing-slot-${++nextJobId}`,
    now: () => new Date("2026-04-16T10:35:00.000Z"),
  } as never);

  const result = await editingService.run({
    manuscriptId: "manuscript-1",
    parentAssetId: harness.originalAssetId,
    requestedBy: "editor-1",
    actorRole: "editor",
    storageKey: "runs/manuscript-1/editing/slot-governance.docx",
    fileName: "slot-governance.docx",
    executionMode: "bare",
  });

  const slotPayload = (result.job.payload as { slotGovernanceSummary?: unknown } | undefined)
    ?.slotGovernanceSummary as
    | {
        unresolved_required_count?: number;
        blocking_slot_keys?: string[];
        slots?: Array<{
          slot_key?: string;
          state?: string;
          resolved_text?: string;
        }>;
      }
    | undefined;
  const editingSourceBlocks = (
    result.job.payload as { editingSourceBlocks?: Array<{ text?: string; source_locator?: string }> }
  ).editingSourceBlocks;
  assert.ok(slotPayload);
  assert.deepEqual(
    editingSourceBlocks?.map((block) => ({
      text: block.text,
      source_locator: block.source_locator,
    })),
    [
      {
        text: "张三, 李四",
        source_locator: "body:p:1",
      },
      {
        text: "上海交通大学医学院附属瑞金医院心内科",
        source_locator: "body:p:2",
      },
    ],
  );
  assert.equal(slotPayload.unresolved_required_count, 1);
  assert.deepEqual(slotPayload.blocking_slot_keys, ["author_line"]);
  assert.deepEqual(
    slotPayload.slots?.map((slot) => ({
      slot_key: slot.slot_key,
      state: slot.state,
      resolved_text: slot.resolved_text,
    })),
    [
      {
        slot_key: "author_line",
        state: "low_confidence_pending_review",
        resolved_text: undefined,
      },
      {
        slot_key: "affiliation_line",
        state: "resolved_auto",
        resolved_text: "上海交通大学医学院附属瑞金医院心内科",
      },
      {
        slot_key: "funding_statement",
        state: "recognized_misplaced",
        resolved_text: "国家自然科学基金（12345678）",
      },
      {
        slot_key: "classification_code",
        state: "resolved_manual",
        resolved_text: "R541.4",
      },
      {
        slot_key: "document_code",
        state: "missing",
        resolved_text: undefined,
      },
    ],
  );

  const savedManuscript = await harness.manuscriptRepository.findById("manuscript-1");
  assert.equal(
    savedManuscript?.editing_slot_governance_summary?.slots.find(
      (slot) => slot.slot_key === "classification_code",
    )?.state,
    "resolved_manual",
  );
  assert.equal(
    savedManuscript?.editing_slot_governance_summary?.manual_resolutions?.[0]?.resolved_text,
    "R541.4",
  );
});

test("editing slot governance manual resolutions can be saved before rerun", async () => {
  const harness = await seedMedicalQualityFixture();
  const manuscript = await harness.manuscriptRepository.findById("manuscript-1");
  assert.ok(manuscript);
  await harness.manuscriptRepository.save({
    ...manuscript,
    editing_slot_governance_summary: {
      observation_status: "reported",
      journal_template_id: "journal-template-1",
      target_model_version_id: "journal-template-1-v1",
      target_model_version_no: 1,
      generated_at: "2026-04-16T10:00:00.000Z",
      unresolved_required_count: 1,
      blocking_slot_keys: ["author_line"],
      slots: [
        {
          slot_key: "author_line",
          label: "作者署名",
          required: true,
          enabled: true,
          zone: "front_matter",
          anchor: "after_title",
          completion_gate: "block_on_unresolved",
          state: "conflicted_candidates",
          resolution_reason: "识别到 2 个冲突候选，需人工裁决。",
          candidate_count: 2,
          candidates: [
            {
              candidate_id: "candidate-author-1",
              slot_key: "author_line",
              raw_text: "张三, 李四",
              normalized_text: "张三, 李四",
              source_zone: "title_area",
              source_locator: "body:p:1",
              semantic_role: "author_line",
              confidence: 0.9,
              recommended_action: "move_to_target",
            },
            {
              candidate_id: "candidate-author-2",
              slot_key: "author_line",
              raw_text: "李四, 王五",
              normalized_text: "李四, 王五",
              source_zone: "front_matter",
              source_locator: "body:p:2",
              semantic_role: "author_line",
              confidence: 0.93,
              recommended_action: "auto_place_candidate",
            },
          ],
        },
      ],
    },
  });

  const editingService = new EditingService({
    manuscriptRepository: harness.manuscriptRepository,
    assetRepository: harness.assetRepository,
    templateFamilyRepository: harness.templateFamilyRepository,
    moduleTemplateRepository: harness.moduleTemplateRepository,
    promptSkillRegistryRepository: harness.promptSkillRegistryRepository,
    knowledgeRepository: harness.knowledgeRepository,
    executionGovernanceService: harness.executionGovernanceService,
    executionTrackingService: harness.executionTrackingService,
    jobRepository: harness.jobRepository,
    documentAssetService: harness.documentAssetService,
    aiGatewayService: harness.aiGatewayService,
    sandboxProfileService: harness.sandboxProfileService,
    agentProfileService: harness.agentProfileService,
    agentRuntimeService: harness.agentRuntimeService,
    runtimeBindingService: harness.runtimeBindingService,
    toolPermissionPolicyService: harness.toolPermissionPolicyService,
    agentExecutionService: harness.agentExecutionService,
    agentExecutionOrchestrationService: {
      async dispatchBestEffort() {
        return undefined;
      },
    } as never,
    createId: () => "job-editing-slot-save-1",
    now: () => new Date("2026-04-16T11:05:00.000Z"),
  } as never);

  const result = await editingService.saveSlotManualResolution({
    manuscriptId: "manuscript-1",
    slotKey: "author_line",
    resolutionKind: "picked_candidate",
    selectedCandidateId: "candidate-author-2",
    note: "人工确认采用前置区的作者行。",
    requestedBy: "editor-1",
    actorRole: "editor",
  });

  assert.equal(result.manuscript_id, "manuscript-1");
  assert.equal(result.summary.unresolved_required_count, 0);
  assert.deepEqual(result.summary.blocking_slot_keys, []);
  assert.equal(result.summary.slots[0]?.state, "resolved_manual");
  assert.equal(result.summary.slots[0]?.resolved_text, "李四, 王五");
  assert.equal(
    result.summary.slots[0]?.manual_resolution?.selected_candidate_id,
    "candidate-author-2",
  );

  const savedManuscript = await harness.manuscriptRepository.findById("manuscript-1");
  assert.equal(
    savedManuscript?.editing_slot_governance_summary?.manual_resolutions?.[0]
      ?.resolution_kind,
    "picked_candidate",
  );
  assert.equal(
    savedManuscript?.editing_slot_governance_summary?.manual_resolutions?.[0]
      ?.selected_candidate_id,
    "candidate-author-2",
  );
});
