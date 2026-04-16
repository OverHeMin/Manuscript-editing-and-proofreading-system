import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryAuditService } from "../../src/audit/audit-service.ts";
import { AiGatewayService } from "../../src/modules/ai-gateway/ai-gateway-service.ts";
import { DocumentAssetService } from "../../src/modules/assets/document-asset-service.ts";
import { InMemoryDocumentAssetRepository } from "../../src/modules/assets/in-memory-document-asset-repository.ts";
import { InMemoryEditorialRuleRepository } from "../../src/modules/editorial-rules/in-memory-editorial-rule-repository.ts";
import { InMemoryExecutionGovernanceRepository } from "../../src/modules/execution-governance/in-memory-execution-governance-repository.ts";
import { ExecutionGovernanceService } from "../../src/modules/execution-governance/execution-governance-service.ts";
import { InMemoryJobRepository } from "../../src/modules/jobs/in-memory-job-repository.ts";
import { InMemoryKnowledgeRepository } from "../../src/modules/knowledge/in-memory-knowledge-repository.ts";
import { createManuscriptApi } from "../../src/modules/manuscripts/manuscript-api.ts";
import { ManuscriptLifecycleService } from "../../src/modules/manuscripts/manuscript-lifecycle-service.ts";
import { InMemoryManuscriptRepository } from "../../src/modules/manuscripts/in-memory-manuscript-repository.ts";
import {
  InMemoryModelRegistryRepository,
  InMemoryModelRoutingPolicyRepository,
} from "../../src/modules/model-registry/in-memory-model-registry-repository.ts";
import { ModelRegistryService } from "../../src/modules/model-registry/model-registry-service.ts";
import { InMemoryPromptSkillRegistryRepository } from "../../src/modules/prompt-skill-registry/in-memory-prompt-skill-repository.ts";
import { resolveGovernedModuleContext } from "../../src/modules/shared/governed-module-context-resolver.ts";
import {
  InMemoryModuleTemplateRepository,
  InMemoryTemplateFamilyRepository,
} from "../../src/modules/templates/in-memory-template-family-repository.ts";

const BEFORE_HEADING = "\u6458\u8981 \u76ee\u7684";
const BASE_AFTER_HEADING = "\uff08\u6458\u8981\u3000\u76ee\u7684\uff09";
const JOURNAL_AFTER_HEADING = "\uff08\u6458\u8981\u3000\u76ee\u7684\uff09\uff1a";

function createSelectionHarness(
  issuedIds = ["manuscript-1", "asset-1", "job-1"],
) {
  const manuscriptRepository = new InMemoryManuscriptRepository();
  const assetRepository = new InMemoryDocumentAssetRepository();
  const jobRepository = new InMemoryJobRepository();
  const templateFamilyRepository = new InMemoryTemplateFamilyRepository();

  const createId = () => {
    const value = issuedIds.shift();
    assert.ok(value, "Expected a fixture id to be available.");
    return value;
  };

  const manuscriptService = new ManuscriptLifecycleService({
    manuscriptRepository,
    assetRepository,
    jobRepository,
    templateFamilyRepository,
    now: () => new Date("2026-04-07T10:00:00.000Z"),
    createId,
  });
  const assetService = new DocumentAssetService({
    assetRepository,
    manuscriptRepository,
    now: () => new Date("2026-04-07T10:05:00.000Z"),
    createId: () => "derived-asset-unused",
  });
  const api = createManuscriptApi({
    manuscriptService,
    assetService,
  });

  return {
    api,
    manuscriptRepository,
    templateFamilyRepository,
  };
}

async function createGovernedSelectionHarness() {
  const manuscriptRepository = new InMemoryManuscriptRepository();
  const assetRepository = new InMemoryDocumentAssetRepository();
  const jobRepository = new InMemoryJobRepository();
  const templateFamilyRepository = new InMemoryTemplateFamilyRepository();
  const moduleTemplateRepository = new InMemoryModuleTemplateRepository();
  const promptSkillRegistryRepository = new InMemoryPromptSkillRegistryRepository();
  const knowledgeRepository = new InMemoryKnowledgeRepository();
  const editorialRuleRepository = new InMemoryEditorialRuleRepository();
  const executionGovernanceRepository = new InMemoryExecutionGovernanceRepository();

  const manuscriptService = new ManuscriptLifecycleService({
    manuscriptRepository,
    assetRepository,
    jobRepository,
    templateFamilyRepository,
    now: () => new Date("2026-04-07T11:00:00.000Z"),
    createId: (() => {
      const ids = ["unused-manuscript-id", "unused-asset-id", "unused-job-id"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected a governed selection id to be available.");
        return value;
      };
    })(),
  });
  const assetService = new DocumentAssetService({
    assetRepository,
    manuscriptRepository,
    now: () => new Date("2026-04-07T11:05:00.000Z"),
    createId: () => "unused-derived-asset-id",
  });
  const api = createManuscriptApi({
    manuscriptService,
    assetService,
  });

  const executionGovernanceService = new ExecutionGovernanceService({
    repository: executionGovernanceRepository,
    editorialRuleRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    createId: (() => {
      const ids = ["profile-1"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected an execution governance id to be available.");
        return value;
      };
    })(),
  });

  const modelRepository = new InMemoryModelRegistryRepository();
  const routingPolicyRepository = new InMemoryModelRoutingPolicyRepository();
  const modelRegistryService = new ModelRegistryService({
    repository: modelRepository,
    routingPolicyRepository,
    createId: (() => {
      const ids = ["model-1"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected a model id to be available.");
        return value;
      };
    })(),
  });
  const aiGatewayService = new AiGatewayService({
    repository: modelRepository,
    routingPolicyRepository,
    auditService: new InMemoryAuditService(),
    now: () => new Date("2026-04-07T11:10:00.000Z"),
  });

  await modelRegistryService.createModelEntry("admin", {
    provider: "openai",
    modelName: "gpt-5-default",
    modelVersion: "2026-04",
    allowedModules: ["screening", "editing", "proofreading"],
    isProdAllowed: true,
  });
  await modelRegistryService.updateRoutingPolicy("admin", {
    systemDefaultModelId: "model-1",
    moduleDefaults: {
      editing: "model-1",
    },
  });

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

  await manuscriptRepository.save({
    id: "manuscript-1",
    title: "Journal override fixture",
    manuscript_type: "clinical_study",
    status: "uploaded",
    created_by: "user-1",
    current_screening_asset_id: undefined,
    current_editing_asset_id: undefined,
    current_proofreading_asset_id: undefined,
    current_template_family_id: "family-1",
    current_journal_template_id: undefined,
    created_at: "2026-04-07T11:00:00.000Z",
    updated_at: "2026-04-07T11:00:00.000Z",
  });

  await moduleTemplateRepository.save({
    id: "template-editing-1",
    template_family_id: "family-1",
    module: "editing",
    manuscript_type: "clinical_study",
    version_no: 1,
    status: "published",
    prompt: "Editing template",
  });
  await promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-editing-1",
    name: "editing_mainline",
    version: "1.0.0",
    status: "published",
    module: "editing",
    manuscript_types: ["clinical_study"],
  });

  await editorialRuleRepository.saveRuleSet({
    id: "base-rule-set",
    template_family_id: "family-1",
    module: "editing",
    version_no: 1,
    status: "published",
  });
  await editorialRuleRepository.saveRuleSet({
    id: "journal-rule-set",
    template_family_id: "family-1",
    journal_template_id: "journal-template-1",
    module: "editing",
    version_no: 1,
    status: "published",
  });
  await editorialRuleRepository.saveRule({
    id: "base-rule-abstract",
    rule_set_id: "base-rule-set",
    order_no: 10,
    rule_object: "abstract",
    rule_type: "format",
    execution_mode: "apply_and_inspect",
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
      to: BASE_AFTER_HEADING,
    },
    authoring_payload: {},
    confidence_policy: "always_auto",
    severity: "error",
    enabled: true,
  });
  await editorialRuleRepository.saveRule({
    id: "base-rule-discussion",
    rule_set_id: "base-rule-set",
    order_no: 20,
    rule_object: "discussion",
    rule_type: "content",
    execution_mode: "inspect",
    scope: {
      sections: ["discussion"],
    },
    selector: {},
    trigger: {
      kind: "structural_presence",
      field: "discussion",
    },
    action: {
      kind: "emit_finding",
      message: "Discussion section should be present.",
    },
    authoring_payload: {},
    confidence_policy: "manual_only",
    severity: "warning",
    enabled: true,
  });
  await editorialRuleRepository.saveRule({
    id: "journal-rule-abstract",
    rule_set_id: "journal-rule-set",
    order_no: 5,
    rule_object: "abstract",
    rule_type: "format",
    execution_mode: "apply_and_inspect",
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
      to: JOURNAL_AFTER_HEADING,
    },
    authoring_payload: {},
    confidence_policy: "always_auto",
    severity: "error",
    enabled: true,
  });

  await executionGovernanceRepository.saveProfile({
    id: "profile-1",
    module: "editing",
    manuscript_type: "clinical_study",
    template_family_id: "family-1",
    module_template_id: "template-editing-1",
    rule_set_id: "base-rule-set",
    prompt_template_id: "prompt-editing-1",
    skill_package_ids: [],
    knowledge_binding_mode: "profile_only",
    status: "active",
    version: 1,
  });

  return {
    api,
    manuscriptRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    executionGovernanceService,
    aiGatewayService,
  };
}

test("upload still auto-binds the base template family when exactly one active family matches", async () => {
  const { api, templateFamilyRepository } = createSelectionHarness();

  await templateFamilyRepository.save({
    id: "family-1",
    manuscript_type: "clinical_study",
    name: "Clinical study family",
    status: "active",
  });

  const uploadResponse = await api.upload({
    title: "Clinical study upload",
    manuscriptType: "clinical_study",
    createdBy: "user-1",
    fileName: "clinical-study.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    storageKey: "uploads/clinical-study.docx",
  });

  assert.equal(uploadResponse.status, 201);
  assert.equal(
    uploadResponse.body.manuscript.current_template_family_id,
    "family-1",
  );
  assert.equal(
    uploadResponse.body.manuscript.current_journal_template_id,
    undefined,
  );
  assert.equal(
    uploadResponse.body.manuscript.governed_execution_context_summary
      ?.journal_template_selection_state,
    "base_family_only",
  );
});

test("operators can set or clear the journal template selection and mismatched journal families are rejected", async () => {
  const { api, templateFamilyRepository } = createSelectionHarness();

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
    id: "journal-template-1",
    template_family_id: "family-1",
    journal_key: "journal-alpha",
    journal_name: "Journal Alpha",
    status: "active",
  });
  await templateFamilyRepository.saveJournalTemplateProfile({
    id: "journal-template-2",
    template_family_id: "family-2",
    journal_key: "journal-beta",
    journal_name: "Journal Beta",
    status: "active",
  });

  const uploadResponse = await api.upload({
    title: "Template selection upload",
    manuscriptType: "clinical_study",
    createdBy: "user-1",
    fileName: "template-selection.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    storageKey: "uploads/template-selection.docx",
  });

  const selectedResponse = await api.updateTemplateSelection({
    manuscriptId: uploadResponse.body.manuscript.id,
    journalTemplateId: "journal-template-1",
  });
  assert.equal(selectedResponse.status, 200);
  assert.equal(
    selectedResponse.body.current_journal_template_id,
    "journal-template-1",
  );

  const clearedResponse = await api.updateTemplateSelection({
    manuscriptId: uploadResponse.body.manuscript.id,
    journalTemplateId: null,
  });
  assert.equal(clearedResponse.status, 200);
  assert.equal(clearedResponse.body.current_journal_template_id, undefined);

  await assert.rejects(
    () =>
      api.updateTemplateSelection({
        manuscriptId: uploadResponse.body.manuscript.id,
        journalTemplateId: "journal-template-2",
      }),
    /template family/i,
  );
});

test("operators can correct the base template family as a secondary action and the journal template stays optional", async () => {
  const { api, templateFamilyRepository } = createSelectionHarness();

  await templateFamilyRepository.save({
    id: "family-clinical-1",
    manuscript_type: "clinical_study",
    name: "Clinical study family",
    status: "active",
  });
  await templateFamilyRepository.save({
    id: "family-review-1",
    manuscript_type: "review",
    name: "Review family",
    status: "active",
  });

  const uploadResponse = await api.upload({
    title: "Clinical study upload",
    manuscriptType: undefined,
    createdBy: "user-1",
    fileName: "clinical-study.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    storageKey: "uploads/clinical-study.docx",
  });

  assert.equal(uploadResponse.status, 201);
  assert.equal(
    uploadResponse.body.manuscript.current_template_family_id,
    "family-clinical-1",
  );
  assert.equal(uploadResponse.body.manuscript.manuscript_type, "clinical_study");
  assert.equal(
    uploadResponse.body.manuscript.manuscript_type_detection_summary?.final_type,
    "clinical_study",
  );

  const correctedResponse = await api.updateTemplateSelection({
    manuscriptId: uploadResponse.body.manuscript.id,
    templateFamilyId: "family-review-1",
    journalTemplateId: null,
  });

  assert.equal(correctedResponse.status, 200);
  assert.equal(correctedResponse.body.current_template_family_id, "family-review-1");
  assert.equal(correctedResponse.body.current_journal_template_id, undefined);
  assert.equal(correctedResponse.body.manuscript_type, "review");
  assert.equal(
    correctedResponse.body.manuscript_type_detection_summary?.detected_type,
    "clinical_study",
  );
  assert.equal(
    correctedResponse.body.manuscript_type_detection_summary?.final_type,
    "review",
  );
  assert.equal(
    correctedResponse.body.governed_execution_context_summary?.base_template_family_id,
    "family-review-1",
  );
  assert.equal(
    correctedResponse.body.governed_execution_context_summary
      ?.journal_template_selection_state,
    "base_family_only",
  );
});

test("governed module resolution uses the selected journal template to overlay journal rules on top of the base rule source", async () => {
  const harness = await createGovernedSelectionHarness();

  await harness.api.updateTemplateSelection({
    manuscriptId: "manuscript-1",
    journalTemplateId: "journal-template-1",
  });

  const journalContext = await resolveGovernedModuleContext({
    manuscriptId: "manuscript-1",
    module: "editing",
    jobId: "job-1",
    actorId: "editor-1",
    actorRole: "editor",
    manuscriptRepository: harness.manuscriptRepository,
    moduleTemplateRepository: harness.moduleTemplateRepository,
    executionGovernanceService: harness.executionGovernanceService,
    promptSkillRegistryRepository: harness.promptSkillRegistryRepository,
    knowledgeRepository: harness.knowledgeRepository,
    aiGatewayService: harness.aiGatewayService,
  });

  assert.equal(journalContext.manuscript.current_journal_template_id, "journal-template-1");
  assert.equal(journalContext.ruleSet.id, "journal-rule-set");
  assert.deepEqual(
    journalContext.rules.map((rule) => rule.id),
    ["journal-rule-abstract", "base-rule-discussion"],
  );
  assert.equal(
    journalContext.rules[0]?.action.to,
    JOURNAL_AFTER_HEADING,
  );

  await harness.api.updateTemplateSelection({
    manuscriptId: "manuscript-1",
    journalTemplateId: null,
  });

  const baseContext = await resolveGovernedModuleContext({
    manuscriptId: "manuscript-1",
    module: "editing",
    jobId: "job-2",
    actorId: "editor-1",
    actorRole: "editor",
    manuscriptRepository: harness.manuscriptRepository,
    moduleTemplateRepository: harness.moduleTemplateRepository,
    executionGovernanceService: harness.executionGovernanceService,
    promptSkillRegistryRepository: harness.promptSkillRegistryRepository,
    knowledgeRepository: harness.knowledgeRepository,
    aiGatewayService: harness.aiGatewayService,
  });

  assert.equal(baseContext.manuscript.current_journal_template_id, undefined);
  assert.equal(baseContext.ruleSet.id, "base-rule-set");
  assert.deepEqual(
    baseContext.rules.map((rule) => rule.id),
    ["base-rule-abstract", "base-rule-discussion"],
  );
  assert.equal(baseContext.rules[0]?.action.to, BASE_AFTER_HEADING);
});
