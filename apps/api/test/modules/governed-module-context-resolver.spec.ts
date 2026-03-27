import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryAuditService } from "../../src/audit/audit-service.ts";
import { AiGatewayService } from "../../src/modules/ai-gateway/ai-gateway-service.ts";
import { InMemoryExecutionGovernanceRepository } from "../../src/modules/execution-governance/in-memory-execution-governance-repository.ts";
import { ExecutionGovernanceService } from "../../src/modules/execution-governance/execution-governance-service.ts";
import { InMemoryKnowledgeRepository } from "../../src/modules/knowledge/in-memory-knowledge-repository.ts";
import { InMemoryManuscriptRepository } from "../../src/modules/manuscripts/in-memory-manuscript-repository.ts";
import {
  InMemoryModelRegistryRepository,
  InMemoryModelRoutingPolicyRepository,
} from "../../src/modules/model-registry/in-memory-model-registry-repository.ts";
import { ModelRegistryService } from "../../src/modules/model-registry/model-registry-service.ts";
import { InMemoryPromptSkillRegistryRepository } from "../../src/modules/prompt-skill-registry/in-memory-prompt-skill-repository.ts";
import { resolveGovernedModuleContext } from "../../src/modules/shared/governed-module-context-resolver.ts";
import { InMemoryModuleTemplateRepository } from "../../src/modules/templates/in-memory-template-family-repository.ts";
import { ActiveExecutionProfileNotFoundError } from "../../src/modules/execution-governance/execution-governance-service.ts";

async function createResolverHarness() {
  const manuscriptRepository = new InMemoryManuscriptRepository();
  const moduleTemplateRepository = new InMemoryModuleTemplateRepository();
  const promptSkillRegistryRepository = new InMemoryPromptSkillRegistryRepository();
  const knowledgeRepository = new InMemoryKnowledgeRepository();
  const executionGovernanceRepository = new InMemoryExecutionGovernanceRepository();
  const executionGovernanceService = new ExecutionGovernanceService({
    repository: executionGovernanceRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    createId: (() => {
      const ids = ["profile-1", "rule-1", "profile-2", "rule-2"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected an execution governance id to be available.");
        return value;
      };
    })(),
  });
  const modelRepository = new InMemoryModelRegistryRepository();
  const routingPolicyRepository = new InMemoryModelRoutingPolicyRepository();
  const auditService = new InMemoryAuditService();
  const modelRegistryService = new ModelRegistryService({
    repository: modelRepository,
    routingPolicyRepository,
    createId: (() => {
      const ids = ["model-1", "model-2"];
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
    auditService,
    now: () => new Date("2026-03-28T12:00:00.000Z"),
  });

  await manuscriptRepository.save({
    id: "manuscript-1",
    title: "Governed Editing Fixture",
    manuscript_type: "clinical_study",
    status: "uploaded",
    created_by: "user-1",
    current_screening_asset_id: undefined,
    current_editing_asset_id: undefined,
    current_proofreading_asset_id: undefined,
    current_template_family_id: "family-1",
    created_at: "2026-03-28T11:30:00.000Z",
    updated_at: "2026-03-28T11:30:00.000Z",
  });
  await moduleTemplateRepository.save({
    id: "template-editing-1",
    template_family_id: "family-1",
    module: "editing",
    manuscript_type: "clinical_study",
    version_no: 2,
    status: "published",
    prompt: "Editing template",
  });
  await promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-editing-1",
    name: "editing_mainline",
    version: "1.2.0",
    status: "published",
    module: "editing",
    manuscript_types: ["clinical_study"],
  });
  await promptSkillRegistryRepository.saveSkillPackage({
    id: "skill-editing-1",
    name: "editing_skills",
    version: "2.0.0",
    scope: "admin_only",
    status: "published",
    applies_to_modules: ["editing"],
  });
  await knowledgeRepository.save({
    id: "knowledge-bound-1",
    title: "Bound rule",
    canonical_text: "Always normalize trial terminology.",
    knowledge_kind: "rule",
    status: "approved",
    routing: {
      module_scope: "editing",
      manuscript_types: ["clinical_study"],
    },
  });
  await knowledgeRepository.save({
    id: "knowledge-dynamic-1",
    title: "Dynamic rule",
    canonical_text: "Keep abbreviations consistent.",
    knowledge_kind: "checklist",
    status: "approved",
    routing: {
      module_scope: "editing",
      manuscript_types: ["clinical_study"],
    },
    template_bindings: ["template-editing-1"],
  });
  await executionGovernanceRepository.saveProfile({
    id: "profile-1",
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
  await executionGovernanceRepository.saveKnowledgeBindingRule({
    id: "rule-1",
    knowledge_item_id: "knowledge-bound-1",
    module: "editing",
    manuscript_types: ["clinical_study"],
    template_family_ids: ["family-1"],
    module_template_ids: ["template-editing-1"],
    priority: 10,
    binding_purpose: "required",
    status: "active",
  });

  const systemModel = await modelRegistryService.createModelEntry("admin", {
    provider: "openai",
    modelName: "gpt-5-default",
    modelVersion: "2026-03",
    allowedModules: ["screening", "editing", "proofreading"],
    isProdAllowed: true,
  });
  await modelRegistryService.updateRoutingPolicy("admin", {
    systemDefaultModelId: systemModel.id,
    moduleDefaults: {
      editing: systemModel.id,
    },
  });

  return {
    manuscriptRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    executionGovernanceRepository,
    executionGovernanceService,
    aiGatewayService,
  };
}

test("resolver returns the active execution profile with frozen template, prompt, skill, knowledge, and model context", async () => {
  const harness = await createResolverHarness();

  const context = await resolveGovernedModuleContext({
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

  assert.equal(context.executionProfile.id, "profile-1");
  assert.equal(context.promptTemplate.id, "prompt-editing-1");
  assert.equal(context.skillPackages[0]?.id, "skill-editing-1");
  assert.deepEqual(
    context.knowledgeSelections.map((selection) => selection.knowledgeItem.id),
    ["knowledge-bound-1", "knowledge-dynamic-1"],
  );
  assert.equal(context.knowledgeSelections[0]?.matchSource, "binding_rule");
  assert.equal(context.knowledgeSelections[1]?.matchSource, "template_binding");
  assert.equal(context.modelSelection.model.id, "model-1");
});

test("resolver fails when no active execution profile exists for the module scope", async () => {
  const harness = await createResolverHarness();

  await harness.executionGovernanceRepository.saveProfile({
    id: "profile-archived",
    module: "screening",
    manuscript_type: "clinical_study",
    template_family_id: "family-1",
    module_template_id: "template-editing-1",
    prompt_template_id: "prompt-editing-1",
    skill_package_ids: ["skill-editing-1"],
    knowledge_binding_mode: "profile_only",
    status: "archived",
    version: 1,
  });

  await assert.rejects(
    () =>
      resolveGovernedModuleContext({
        manuscriptId: "manuscript-1",
        module: "screening",
        jobId: "job-2",
        actorId: "screener-1",
        actorRole: "screener",
        manuscriptRepository: harness.manuscriptRepository,
        moduleTemplateRepository: harness.moduleTemplateRepository,
        executionGovernanceService: harness.executionGovernanceService,
        promptSkillRegistryRepository: harness.promptSkillRegistryRepository,
        knowledgeRepository: harness.knowledgeRepository,
        aiGatewayService: harness.aiGatewayService,
      }),
    ActiveExecutionProfileNotFoundError,
  );
});
