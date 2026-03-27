import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryAuditService } from "../../src/audit/audit-service.ts";
import { AuthorizationError } from "../../src/auth/permission-guard.ts";
import { DocumentAssetService } from "../../src/modules/assets/document-asset-service.ts";
import { InMemoryDocumentAssetRepository } from "../../src/modules/assets/in-memory-document-asset-repository.ts";
import { createScreeningApi } from "../../src/modules/screening/screening-api.ts";
import { ScreeningService } from "../../src/modules/screening/screening-service.ts";
import { createEditingApi } from "../../src/modules/editing/editing-api.ts";
import { EditingService } from "../../src/modules/editing/editing-service.ts";
import {
  createProofreadingApi,
} from "../../src/modules/proofreading/proofreading-api.ts";
import { ProofreadingService } from "../../src/modules/proofreading/proofreading-service.ts";
import { InMemoryExecutionGovernanceRepository } from "../../src/modules/execution-governance/in-memory-execution-governance-repository.ts";
import { ExecutionGovernanceService } from "../../src/modules/execution-governance/execution-governance-service.ts";
import { InMemoryExecutionTrackingRepository } from "../../src/modules/execution-tracking/in-memory-execution-tracking-repository.ts";
import { ExecutionTrackingService } from "../../src/modules/execution-tracking/execution-tracking-service.ts";
import { InMemoryJobRepository } from "../../src/modules/jobs/in-memory-job-repository.ts";
import { InMemoryKnowledgeRepository } from "../../src/modules/knowledge/in-memory-knowledge-repository.ts";
import { InMemoryManuscriptRepository } from "../../src/modules/manuscripts/in-memory-manuscript-repository.ts";
import {
  InMemoryModelRegistryRepository,
  InMemoryModelRoutingPolicyRepository,
} from "../../src/modules/model-registry/in-memory-model-registry-repository.ts";
import { ModelRegistryService } from "../../src/modules/model-registry/model-registry-service.ts";
import { InMemoryPromptSkillRegistryRepository } from "../../src/modules/prompt-skill-registry/in-memory-prompt-skill-repository.ts";
import {
  InMemoryModuleTemplateRepository,
  InMemoryTemplateFamilyRepository,
} from "../../src/modules/templates/in-memory-template-family-repository.ts";
import { AiGatewayService } from "../../src/modules/ai-gateway/ai-gateway-service.ts";

function createModuleHarness() {
  const manuscriptRepository = new InMemoryManuscriptRepository();
  const assetRepository = new InMemoryDocumentAssetRepository();
  const jobRepository = new InMemoryJobRepository();
  const knowledgeRepository = new InMemoryKnowledgeRepository();
  const templateFamilyRepository = new InMemoryTemplateFamilyRepository();
  const moduleTemplateRepository = new InMemoryModuleTemplateRepository();
  const promptSkillRegistryRepository = new InMemoryPromptSkillRegistryRepository();
  const executionGovernanceRepository = new InMemoryExecutionGovernanceRepository();
  const executionTrackingRepository = new InMemoryExecutionTrackingRepository();
  const modelRepository = new InMemoryModelRegistryRepository();
  const routingPolicyRepository = new InMemoryModelRoutingPolicyRepository();
  const auditService = new InMemoryAuditService();

  const assetIds = [
    "asset-1",
    "asset-2",
    "asset-3",
    "asset-4",
    "asset-5",
    "asset-6",
  ];
  const modelIds = ["model-1", "model-2", "model-3", "model-4", "model-5"];
  const screeningJobIds = ["job-screening-1"];
  const editingJobIds = ["job-editing-1"];
  const proofreadingJobIds = ["job-proofreading-1", "job-proofreading-2"];
  const trackingIds = [
    "snapshot-1",
    "hit-1",
    "snapshot-2",
    "hit-2",
    "snapshot-3",
    "hit-3",
    "snapshot-4",
    "hit-4",
  ];
  const nextValue = (bucket: string[], label: string) => {
    const value = bucket.shift();
    assert.ok(value, `Expected a ${label} id to be available.`);
    return value;
  };

  const documentAssetService = new DocumentAssetService({
    assetRepository,
    manuscriptRepository,
    createId: () => nextValue(assetIds, "asset"),
    now: () => new Date("2026-03-27T09:00:00.000Z"),
  });
  const modelRegistryService = new ModelRegistryService({
    repository: modelRepository,
    routingPolicyRepository,
    createId: () => nextValue(modelIds, "model"),
  });
  const aiGatewayService = new AiGatewayService({
    repository: modelRepository,
    routingPolicyRepository,
    auditService,
    now: () => new Date("2026-03-27T09:00:00.000Z"),
  });
  const executionGovernanceService = new ExecutionGovernanceService({
    repository: executionGovernanceRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
  });
  const executionTrackingService = new ExecutionTrackingService({
    repository: executionTrackingRepository,
    createId: () => nextValue(trackingIds, "execution tracking"),
    now: () => new Date("2026-03-27T09:00:00.000Z"),
  });

  const screeningApi = createScreeningApi({
    screeningService: new ScreeningService({
      manuscriptRepository,
      assetRepository,
      moduleTemplateRepository,
      promptSkillRegistryRepository,
      knowledgeRepository,
      executionGovernanceService,
      executionTrackingService,
      jobRepository,
      documentAssetService,
      aiGatewayService,
      createId: () => nextValue(screeningJobIds, "screening job"),
      now: () => new Date("2026-03-27T09:00:00.000Z"),
    }),
  });
  const editingApi = createEditingApi({
    editingService: new EditingService({
      manuscriptRepository,
      assetRepository,
      moduleTemplateRepository,
      promptSkillRegistryRepository,
      knowledgeRepository,
      executionGovernanceService,
      executionTrackingService,
      jobRepository,
      documentAssetService,
      aiGatewayService,
      createId: () => nextValue(editingJobIds, "editing job"),
      now: () => new Date("2026-03-27T09:00:00.000Z"),
    }),
  });
  const proofreadingApi = createProofreadingApi({
    proofreadingService: new ProofreadingService({
      manuscriptRepository,
      assetRepository,
      moduleTemplateRepository,
      promptSkillRegistryRepository,
      knowledgeRepository,
      executionGovernanceService,
      executionTrackingService,
      jobRepository,
      documentAssetService,
      aiGatewayService,
      createId: () => nextValue(proofreadingJobIds, "proofreading job"),
      now: () => new Date("2026-03-27T09:00:00.000Z"),
    }),
  });

  return {
    manuscriptRepository,
    assetRepository,
    jobRepository,
    knowledgeRepository,
    templateFamilyRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    executionGovernanceRepository,
    executionTrackingRepository,
    documentAssetService,
    modelRegistryService,
    screeningApi,
    editingApi,
    proofreadingApi,
  };
}

async function seedWorkflowContext() {
  const harness = createModuleHarness();

  await harness.manuscriptRepository.save({
    id: "manuscript-1",
    title: "Clinical Study Screening Fixture",
    manuscript_type: "clinical_study",
    status: "uploaded",
    created_by: "user-1",
    current_screening_asset_id: undefined,
    current_editing_asset_id: undefined,
    current_proofreading_asset_id: undefined,
    current_template_family_id: "family-1",
    created_at: "2026-03-27T08:55:00.000Z",
    updated_at: "2026-03-27T08:55:00.000Z",
  });

  await harness.templateFamilyRepository.save({
    id: "family-1",
    manuscript_type: "clinical_study",
    name: "Clinical Study Family",
    status: "active",
  });
  await harness.moduleTemplateRepository.save({
    id: "template-screening-1",
    template_family_id: "family-1",
    module: "screening",
    manuscript_type: "clinical_study",
    version_no: 1,
    status: "published",
    prompt: "Screening prompt",
  });
  await harness.moduleTemplateRepository.save({
    id: "template-editing-1",
    template_family_id: "family-1",
    module: "editing",
    manuscript_type: "clinical_study",
    version_no: 1,
    status: "published",
    prompt: "Editing prompt",
  });
  await harness.moduleTemplateRepository.save({
    id: "template-proofreading-1",
    template_family_id: "family-1",
    module: "proofreading",
    manuscript_type: "clinical_study",
    version_no: 1,
    status: "published",
    prompt: "Proofreading prompt",
  });
  await harness.promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-screening-1",
    name: "screening_mainline",
    version: "1.0.0",
    status: "published",
    module: "screening",
    manuscript_types: ["clinical_study"],
  });
  await harness.promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-editing-1",
    name: "editing_mainline",
    version: "1.0.0",
    status: "published",
    module: "editing",
    manuscript_types: ["clinical_study"],
  });
  await harness.promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-proofreading-1",
    name: "proofreading_mainline",
    version: "1.0.0",
    status: "published",
    module: "proofreading",
    manuscript_types: ["clinical_study"],
  });
  await harness.promptSkillRegistryRepository.saveSkillPackage({
    id: "skill-screening-1",
    name: "screening_skills",
    version: "1.0.0",
    scope: "admin_only",
    status: "published",
    applies_to_modules: ["screening"],
  });
  await harness.promptSkillRegistryRepository.saveSkillPackage({
    id: "skill-editing-1",
    name: "editing_skills",
    version: "1.0.0",
    scope: "admin_only",
    status: "published",
    applies_to_modules: ["editing"],
  });
  await harness.promptSkillRegistryRepository.saveSkillPackage({
    id: "skill-proofreading-1",
    name: "proofreading_skills",
    version: "1.0.0",
    scope: "admin_only",
    status: "published",
    applies_to_modules: ["proofreading"],
  });
  await harness.executionGovernanceRepository.saveProfile({
    id: "profile-screening-1",
    module: "screening",
    manuscript_type: "clinical_study",
    template_family_id: "family-1",
    module_template_id: "template-screening-1",
    prompt_template_id: "prompt-screening-1",
    skill_package_ids: ["skill-screening-1"],
    knowledge_binding_mode: "profile_plus_dynamic",
    status: "active",
    version: 1,
  });
  await harness.executionGovernanceRepository.saveProfile({
    id: "profile-editing-1",
    module: "editing",
    manuscript_type: "clinical_study",
    template_family_id: "family-1",
    module_template_id: "template-editing-1",
    prompt_template_id: "prompt-editing-1",
    skill_package_ids: ["skill-editing-1"],
    knowledge_binding_mode: "profile_plus_dynamic",
    status: "active",
    version: 1,
  });
  await harness.executionGovernanceRepository.saveProfile({
    id: "profile-proofreading-1",
    module: "proofreading",
    manuscript_type: "clinical_study",
    template_family_id: "family-1",
    module_template_id: "template-proofreading-1",
    prompt_template_id: "prompt-proofreading-1",
    skill_package_ids: ["skill-proofreading-1"],
    knowledge_binding_mode: "profile_plus_dynamic",
    status: "active",
    version: 1,
  });
  await harness.executionGovernanceRepository.saveKnowledgeBindingRule({
    id: "rule-screening-1",
    knowledge_item_id: "knowledge-screening-1",
    module: "screening",
    manuscript_types: ["clinical_study"],
    template_family_ids: ["family-1"],
    module_template_ids: ["template-screening-1"],
    priority: 10,
    binding_purpose: "required",
    status: "active",
  });
  await harness.executionGovernanceRepository.saveKnowledgeBindingRule({
    id: "rule-editing-1",
    knowledge_item_id: "knowledge-editing-1",
    module: "editing",
    manuscript_types: ["clinical_study"],
    template_family_ids: ["family-1"],
    module_template_ids: ["template-editing-1"],
    priority: 10,
    binding_purpose: "required",
    status: "active",
  });
  await harness.executionGovernanceRepository.saveKnowledgeBindingRule({
    id: "rule-proofreading-1",
    knowledge_item_id: "knowledge-proof-1",
    module: "proofreading",
    manuscript_types: ["clinical_study"],
    template_family_ids: ["family-1"],
    module_template_ids: ["template-proofreading-1"],
    priority: 10,
    binding_purpose: "required",
    status: "active",
  });

  await harness.knowledgeRepository.save({
    id: "knowledge-screening-1",
    title: "Screening rule",
    canonical_text: "Check ethics approval.",
    knowledge_kind: "rule",
    status: "approved",
    routing: {
      module_scope: "screening",
      manuscript_types: ["clinical_study"],
    },
    template_bindings: ["template-screening-1"],
  });
  await harness.knowledgeRepository.save({
    id: "knowledge-editing-1",
    title: "Editing rule",
    canonical_text: "Normalize trial terminology.",
    knowledge_kind: "rule",
    status: "approved",
    routing: {
      module_scope: "editing",
      manuscript_types: ["clinical_study"],
    },
    template_bindings: ["template-editing-1"],
  });
  await harness.knowledgeRepository.save({
    id: "knowledge-proof-1",
    title: "Proofreading rule",
    canonical_text: "Flag punctuation drift.",
    knowledge_kind: "checklist",
    status: "approved",
    routing: {
      module_scope: "proofreading",
      manuscript_types: ["clinical_study"],
    },
    template_bindings: ["template-proofreading-1"],
  });
  await harness.knowledgeRepository.save({
    id: "knowledge-draft-excluded",
    title: "Draft knowledge should not route",
    canonical_text: "Do not use draft knowledge.",
    knowledge_kind: "rule",
    status: "draft",
    routing: {
      module_scope: "screening",
      manuscript_types: ["clinical_study"],
    },
  });

  const systemModel = await harness.modelRegistryService.createModelEntry("admin", {
    provider: "openai",
    modelName: "gpt-5-safe-default",
    modelVersion: "2026-03",
    allowedModules: ["screening", "editing", "proofreading"],
    isProdAllowed: true,
  });
  const screeningModel = await harness.modelRegistryService.createModelEntry("admin", {
    provider: "openai",
    modelName: "gpt-5-screening",
    modelVersion: "2026-03",
    allowedModules: ["screening"],
    isProdAllowed: true,
  });
  const editingModel = await harness.modelRegistryService.createModelEntry("admin", {
    provider: "openai",
    modelName: "gpt-5-editing",
    modelVersion: "2026-03",
    allowedModules: ["editing"],
    isProdAllowed: true,
  });
  const proofreadingModel = await harness.modelRegistryService.createModelEntry(
    "admin",
    {
      provider: "openai",
      modelName: "gpt-5-proofreading",
      modelVersion: "2026-03",
      allowedModules: ["proofreading"],
      isProdAllowed: true,
    },
  );

  await harness.modelRegistryService.updateRoutingPolicy("admin", {
    systemDefaultModelId: systemModel.id,
    moduleDefaults: {
      screening: screeningModel.id,
      editing: editingModel.id,
      proofreading: proofreadingModel.id,
    },
  });

  const originalAsset = await harness.documentAssetService.createAsset({
    manuscriptId: "manuscript-1",
    assetType: "original",
    storageKey: "uploads/manuscript-1/original.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    createdBy: "user-1",
    fileName: "original.docx",
    sourceModule: "upload",
  });

  return {
    ...harness,
    originalAsset,
  };
}

test("screening produces a final report asset with routed template, knowledge, and model context", async () => {
  const { screeningApi, manuscriptRepository, originalAsset } =
    await seedWorkflowContext();

  const response = await screeningApi.runScreening({
    manuscriptId: "manuscript-1",
    parentAssetId: originalAsset.id,
    requestedBy: "screener-1",
    actorRole: "screener",
    storageKey: "runs/manuscript-1/screening/report.md",
    fileName: "screening-report.md",
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.asset.asset_type, "screening_report");
  assert.equal(response.body.asset.parent_asset_id, originalAsset.id);
  assert.equal(response.body.template_id, "template-screening-1");
  assert.equal(response.body.execution_profile_id, "profile-screening-1");
  assert.equal(response.body.prompt_template_id, "prompt-screening-1");
  assert.deepEqual(response.body.skill_package_ids, ["skill-screening-1"]);
  assert.equal(response.body.snapshot_id, "snapshot-1");
  assert.deepEqual(response.body.knowledge_item_ids, ["knowledge-screening-1"]);
  assert.equal(response.body.model_id, "model-2");
  assert.equal(response.body.job.module, "screening");
  assert.equal(
    (await manuscriptRepository.findById("manuscript-1"))
      ?.current_screening_asset_id,
    response.body.asset.id,
  );
});

test("module services enforce workbench permissions per module", async () => {
  const { screeningApi, editingApi, proofreadingApi, originalAsset } =
    await seedWorkflowContext();

  await assert.rejects(
    () =>
      screeningApi.runScreening({
        manuscriptId: "manuscript-1",
        parentAssetId: originalAsset.id,
        requestedBy: "user-1",
        actorRole: "user",
        storageKey: "runs/manuscript-1/screening/forbidden.md",
      }),
    AuthorizationError,
  );

  await assert.rejects(
    () =>
      editingApi.runEditing({
        manuscriptId: "manuscript-1",
        parentAssetId: originalAsset.id,
        requestedBy: "screener-1",
        actorRole: "screener",
        storageKey: "runs/manuscript-1/editing/forbidden.docx",
      }),
    AuthorizationError,
  );

  await assert.rejects(
    () =>
      proofreadingApi.createDraft({
        manuscriptId: "manuscript-1",
        parentAssetId: originalAsset.id,
        requestedBy: "editor-1",
        actorRole: "editor",
        storageKey: "runs/manuscript-1/proofreading/forbidden.md",
      }),
    AuthorizationError,
  );
});

test("editing produces a final docx asset with routed template, knowledge, and model context", async () => {
  const { editingApi, manuscriptRepository, originalAsset } =
    await seedWorkflowContext();

  const response = await editingApi.runEditing({
    manuscriptId: "manuscript-1",
    parentAssetId: originalAsset.id,
    requestedBy: "editor-1",
    actorRole: "editor",
    storageKey: "runs/manuscript-1/editing/final.docx",
    fileName: "edited.docx",
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.asset.asset_type, "edited_docx");
  assert.equal(response.body.asset.parent_asset_id, originalAsset.id);
  assert.equal(response.body.template_id, "template-editing-1");
  assert.equal(response.body.execution_profile_id, "profile-editing-1");
  assert.equal(response.body.prompt_template_id, "prompt-editing-1");
  assert.deepEqual(response.body.skill_package_ids, ["skill-editing-1"]);
  assert.equal(response.body.snapshot_id, "snapshot-1");
  assert.deepEqual(response.body.knowledge_item_ids, ["knowledge-editing-1"]);
  assert.equal(response.body.model_id, "model-3");
  assert.equal(response.body.job.module, "editing");
  assert.equal(
    (await manuscriptRepository.findById("manuscript-1"))?.current_editing_asset_id,
    response.body.asset.id,
  );
});

test("proofreading produces a draft first and only advances the final pointer after confirmation", async () => {
  const {
    proofreadingApi,
    manuscriptRepository,
    moduleTemplateRepository,
    knowledgeRepository,
    modelRegistryService,
    executionTrackingRepository,
    originalAsset,
  } =
    await seedWorkflowContext();

  const draftResponse = await proofreadingApi.createDraft({
    manuscriptId: "manuscript-1",
    parentAssetId: originalAsset.id,
    requestedBy: "proofreader-1",
    actorRole: "proofreader",
    storageKey: "runs/manuscript-1/proofreading/draft-report.md",
    fileName: "proofreading-draft.md",
  });

  assert.equal(draftResponse.status, 201);
  assert.equal(draftResponse.body.asset.asset_type, "proofreading_draft_report");
  assert.equal(draftResponse.body.template_id, "template-proofreading-1");
  assert.equal(draftResponse.body.execution_profile_id, "profile-proofreading-1");
  assert.equal(draftResponse.body.prompt_template_id, "prompt-proofreading-1");
  assert.deepEqual(draftResponse.body.skill_package_ids, ["skill-proofreading-1"]);
  assert.equal(draftResponse.body.snapshot_id, "snapshot-1");
  assert.deepEqual(draftResponse.body.knowledge_item_ids, ["knowledge-proof-1"]);
  assert.equal(draftResponse.body.model_id, "model-4");
  assert.equal(
    (await manuscriptRepository.findById("manuscript-1"))
      ?.current_proofreading_asset_id,
    undefined,
  );

  await moduleTemplateRepository.save({
    id: "template-proofreading-2",
    template_family_id: "family-1",
    module: "proofreading",
    manuscript_type: "clinical_study",
    version_no: 2,
    status: "published",
    prompt: "New proof prompt after draft review",
  });
  await knowledgeRepository.save({
    id: "knowledge-proof-2",
    title: "Late proofreading rule",
    canonical_text: "This should not replace the reviewed draft context.",
    knowledge_kind: "rule",
    status: "approved",
    routing: {
      module_scope: "proofreading",
      manuscript_types: ["clinical_study"],
    },
    template_bindings: ["template-proofreading-2"],
  });
  const newProofModel = await modelRegistryService.createModelEntry("admin", {
    provider: "openai",
    modelName: "gpt-5-proofreading-v2",
    modelVersion: "2026-04",
    allowedModules: ["proofreading"],
    isProdAllowed: true,
  });
  await modelRegistryService.updateRoutingPolicy("admin", {
    moduleDefaults: {
      proofreading: newProofModel.id,
    },
  });

  const finalResponse = await proofreadingApi.confirmFinal({
    manuscriptId: "manuscript-1",
    draftAssetId: draftResponse.body.asset.id,
    requestedBy: "proofreader-1",
    actorRole: "proofreader",
    storageKey: "runs/manuscript-1/proofreading/final.docx",
    fileName: "proofreading-final.docx",
  });

  assert.equal(finalResponse.status, 201);
  assert.equal(finalResponse.body.asset.asset_type, "final_proof_annotated_docx");
  assert.equal(finalResponse.body.asset.parent_asset_id, draftResponse.body.asset.id);
  assert.equal(finalResponse.body.job.module, "proofreading");
  assert.equal(finalResponse.body.template_id, "template-proofreading-1");
  assert.equal(finalResponse.body.execution_profile_id, "profile-proofreading-1");
  assert.equal(finalResponse.body.prompt_template_id, "prompt-proofreading-1");
  assert.deepEqual(finalResponse.body.skill_package_ids, ["skill-proofreading-1"]);
  assert.equal(finalResponse.body.snapshot_id, "snapshot-2");
  assert.deepEqual(finalResponse.body.knowledge_item_ids, ["knowledge-proof-1"]);
  assert.equal(finalResponse.body.model_id, "model-4");
  const finalSnapshot = await executionTrackingRepository.findSnapshotById(
    finalResponse.body.snapshot_id,
  );
  assert.equal(finalSnapshot?.draft_snapshot_id, draftResponse.body.snapshot_id);
  assert.equal(
    (await manuscriptRepository.findById("manuscript-1"))
      ?.current_proofreading_asset_id,
    finalResponse.body.asset.id,
  );
});
