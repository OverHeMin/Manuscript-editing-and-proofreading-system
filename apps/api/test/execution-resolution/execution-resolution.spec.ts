import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryKnowledgeRepository } from "../../src/modules/knowledge/in-memory-knowledge-repository.ts";
import {
  InMemoryModelRegistryRepository,
  InMemoryModelRoutingPolicyRepository,
} from "../../src/modules/model-registry/in-memory-model-registry-repository.ts";
import { InMemoryPromptSkillRegistryRepository } from "../../src/modules/prompt-skill-registry/in-memory-prompt-skill-repository.ts";
import { InMemoryModuleTemplateRepository } from "../../src/modules/templates/in-memory-template-family-repository.ts";
import { InMemoryExecutionGovernanceRepository } from "../../src/modules/execution-governance/in-memory-execution-governance-repository.ts";
import { ExecutionGovernanceService } from "../../src/modules/execution-governance/execution-governance-service.ts";
import {
  ExecutionResolutionService,
  ExecutionResolutionModelNotFoundError,
} from "../../src/modules/execution-resolution/index.ts";

function createExecutionResolutionHarness() {
  const executionGovernanceRepository = new InMemoryExecutionGovernanceRepository();
  const moduleTemplateRepository = new InMemoryModuleTemplateRepository();
  const promptSkillRegistryRepository = new InMemoryPromptSkillRegistryRepository();
  const knowledgeRepository = new InMemoryKnowledgeRepository();
  const modelRegistryRepository = new InMemoryModelRegistryRepository();
  const modelRoutingPolicyRepository = new InMemoryModelRoutingPolicyRepository();
  const executionGovernanceService = new ExecutionGovernanceService({
    repository: executionGovernanceRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    createId: (() => {
      const ids = ["profile-1", "rule-1"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected execution governance test ids.");
        return value;
      };
    })(),
  });
  const executionResolutionService = new ExecutionResolutionService({
    executionGovernanceService,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    modelRegistryRepository,
    modelRoutingPolicyRepository,
  });

  return {
    executionGovernanceService,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    modelRegistryRepository,
    modelRoutingPolicyRepository,
    executionResolutionService,
  };
}

test("execution resolution expands the active profile into a concrete runtime bundle", async () => {
  const {
    executionGovernanceService,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    modelRegistryRepository,
    modelRoutingPolicyRepository,
    executionResolutionService,
  } = createExecutionResolutionHarness();

  await moduleTemplateRepository.save({
    id: "template-editing-1",
    template_family_id: "family-1",
    module: "editing",
    manuscript_type: "clinical_study",
    version_no: 3,
    status: "published",
    prompt: "Editing template",
  });
  await promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-editing-1",
    name: "editing_mainline",
    version: "1.1.0",
    status: "published",
    module: "editing",
    manuscript_types: ["clinical_study"],
  });
  await promptSkillRegistryRepository.saveSkillPackage({
    id: "skill-editing-1",
    name: "editing_skills",
    version: "1.0.0",
    scope: "admin_only",
    status: "published",
    applies_to_modules: ["editing"],
  });
  await knowledgeRepository.save({
    id: "knowledge-1",
    title: "Editing rule",
    canonical_text: "Approved editing knowledge item.",
    knowledge_kind: "rule",
    status: "approved",
    routing: {
      module_scope: "editing",
      manuscript_types: ["clinical_study"],
    },
  });
  await modelRegistryRepository.save({
    id: "model-editing-1",
    provider: "openai",
    model_name: "gpt-5.4",
    model_version: "2026-03-01",
    allowed_modules: ["editing", "proofreading"],
    is_prod_allowed: true,
  });
  await modelRoutingPolicyRepository.save({
    module_defaults: {
      editing: "model-editing-1",
    },
    template_overrides: {},
  });

  const createdProfile = await executionGovernanceService.createProfile("admin", {
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
    moduleTemplateId: "template-editing-1",
    promptTemplateId: "prompt-editing-1",
    skillPackageIds: ["skill-editing-1"],
    knowledgeBindingMode: "profile_plus_dynamic",
  });
  await executionGovernanceService.createKnowledgeBindingRule("admin", {
    knowledgeItemId: "knowledge-1",
    module: "editing",
    manuscriptTypes: ["clinical_study"],
    templateFamilyIds: ["family-1"],
    moduleTemplateIds: ["template-editing-1"],
    priority: 50,
    bindingPurpose: "required",
  });
  await executionGovernanceService.activateKnowledgeBindingRule("rule-1", "admin");
  await executionGovernanceService.publishProfile(createdProfile.id, "admin");

  const resolved = await executionResolutionService.resolveExecutionBundle({
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
  });

  assert.equal(resolved.profile.id, "profile-1");
  assert.equal(resolved.module_template.id, "template-editing-1");
  assert.equal(resolved.prompt_template.id, "prompt-editing-1");
  assert.deepEqual(
    resolved.skill_packages.map((record) => record.id),
    ["skill-editing-1"],
  );
  assert.equal(resolved.resolved_model.id, "model-editing-1");
  assert.deepEqual(
    resolved.knowledge_binding_rules.map((record) => record.id),
    ["rule-1"],
  );
  assert.deepEqual(
    resolved.knowledge_items.map((record) => record.id),
    ["knowledge-1"],
  );
});

test("execution resolution fails when no compatible routed model exists", async () => {
  const {
    executionGovernanceService,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    executionResolutionService,
  } = createExecutionResolutionHarness();

  await moduleTemplateRepository.save({
    id: "template-screening-1",
    template_family_id: "family-1",
    module: "screening",
    manuscript_type: "clinical_study",
    version_no: 1,
    status: "published",
    prompt: "Screening template",
  });
  await promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-screening-1",
    name: "screening_mainline",
    version: "1.0.0",
    status: "published",
    module: "screening",
    manuscript_types: ["clinical_study"],
  });
  await executionGovernanceService.createProfile("admin", {
    module: "screening",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
    moduleTemplateId: "template-screening-1",
    promptTemplateId: "prompt-screening-1",
    skillPackageIds: [],
    knowledgeBindingMode: "profile_only",
  });
  await executionGovernanceService.publishProfile("profile-1", "admin");

  await assert.rejects(
    () =>
      executionResolutionService.resolveExecutionBundle({
        module: "screening",
        manuscriptType: "clinical_study",
        templateFamilyId: "family-1",
      }),
    ExecutionResolutionModelNotFoundError,
  );
});
