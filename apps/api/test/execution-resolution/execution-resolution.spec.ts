import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryKnowledgeRepository } from "../../src/modules/knowledge/in-memory-knowledge-repository.ts";
import {
  InMemoryModelRoutingGovernanceRepository,
} from "../../src/modules/model-routing-governance/in-memory-model-routing-governance-repository.ts";
import { ModelRoutingGovernanceService } from "../../src/modules/model-routing-governance/model-routing-governance-service.ts";
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
  const modelRoutingGovernanceRepository =
    new InMemoryModelRoutingGovernanceRepository();
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
  const modelRoutingGovernanceService = new ModelRoutingGovernanceService({
    repository: modelRoutingGovernanceRepository,
    modelRegistryRepository,
    createId: (() => {
      const ids = [
        "governance-id-1",
        "governance-id-2",
        "governance-id-3",
        "governance-id-4",
      ];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected model routing governance test ids.");
        return value;
      };
    })(),
    now: () => new Date("2026-03-28T12:00:00.000Z"),
  });
  const executionResolutionService = new ExecutionResolutionService({
    executionGovernanceService,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    modelRegistryRepository,
    modelRoutingPolicyRepository,
    modelRoutingGovernanceService,
  });

  return {
    executionGovernanceService,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    modelRegistryRepository,
    modelRoutingPolicyRepository,
    modelRoutingGovernanceRepository,
    executionResolutionService,
  };
}

async function saveActivePolicy(input: {
  repository: InMemoryModelRoutingGovernanceRepository;
  policyId: string;
  versionId: string;
  scopeKind: "module" | "template_family";
  scopeValue: string;
  primaryModelId: string;
  fallbackModelIds?: string[];
}) {
  await input.repository.saveScope({
    id: input.policyId,
    scope_kind: input.scopeKind,
    scope_value: input.scopeValue,
    active_version_id: input.versionId,
    created_at: "2026-03-28T12:00:00.000Z",
    updated_at: "2026-03-28T12:00:00.000Z",
  });
  await input.repository.saveVersion({
    id: input.versionId,
    policy_scope_id: input.policyId,
    scope_kind: input.scopeKind,
    scope_value: input.scopeValue,
    version_no: 1,
    primary_model_id: input.primaryModelId,
    fallback_model_ids: [...(input.fallbackModelIds ?? [])],
    evidence_links: [{ kind: "evaluation_run", id: "run-1" }],
    status: "active",
    created_at: "2026-03-28T12:00:00.000Z",
    updated_at: "2026-03-28T12:00:00.000Z",
  });
}

test("execution resolution expands the active profile into a concrete runtime bundle", async () => {
  const {
    executionGovernanceService,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    modelRegistryRepository,
    modelRoutingPolicyRepository,
    modelRoutingGovernanceRepository,
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
  await saveActivePolicy({
    repository: modelRoutingGovernanceRepository,
    policyId: "policy-scope-1",
    versionId: "policy-version-1",
    scopeKind: "template_family",
    scopeValue: "family-1",
    primaryModelId: "model-editing-1",
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
  assert.equal(resolved.model_source, "template_family_policy");
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

test("execution resolution falls back through legacy template override, module default, then system default when no active governed policy exists", async () => {
  const {
    executionGovernanceService,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    modelRegistryRepository,
    modelRoutingPolicyRepository,
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
  await modelRegistryRepository.save({
    id: "model-system-1",
    provider: "openai",
    model_name: "gpt-5-system",
    model_version: "2026-03-01",
    allowed_modules: ["screening"],
    is_prod_allowed: true,
  });
  await modelRegistryRepository.save({
    id: "model-module-1",
    provider: "openai",
    model_name: "gpt-5-module",
    model_version: "2026-03-01",
    allowed_modules: ["screening"],
    is_prod_allowed: true,
  });
  await modelRegistryRepository.save({
    id: "model-template-1",
    provider: "openai",
    model_name: "gpt-5-template",
    model_version: "2026-03-01",
    allowed_modules: ["screening"],
    is_prod_allowed: true,
  });

  await modelRoutingPolicyRepository.save({
    system_default_model_id: "model-system-1",
    module_defaults: {
      screening: "model-module-1",
    },
    template_overrides: {
      "template-screening-1": "model-template-1",
    },
  });

  const templateResolved = await executionResolutionService.resolveExecutionBundle({
    module: "screening",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
  });
  assert.equal(templateResolved.resolved_model.id, "model-template-1");
  assert.equal(templateResolved.model_source, "legacy_template_override");

  await modelRoutingPolicyRepository.save({
    system_default_model_id: "model-system-1",
    module_defaults: {
      screening: "model-module-1",
    },
    template_overrides: {},
  });

  const moduleResolved = await executionResolutionService.resolveExecutionBundle({
    module: "screening",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
  });
  assert.equal(moduleResolved.resolved_model.id, "model-module-1");
  assert.equal(moduleResolved.model_source, "legacy_module_default");

  await modelRoutingPolicyRepository.save({
    system_default_model_id: "model-system-1",
    module_defaults: {},
    template_overrides: {},
  });

  const systemResolved = await executionResolutionService.resolveExecutionBundle({
    module: "screening",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
  });
  assert.equal(systemResolved.resolved_model.id, "model-system-1");
  assert.equal(systemResolved.model_source, "legacy_system_default");
});
