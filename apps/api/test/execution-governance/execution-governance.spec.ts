import test from "node:test";
import assert from "node:assert/strict";
import { AuthorizationError } from "../../src/auth/permission-guard.ts";
import { InMemoryEditorialRuleRepository } from "../../src/modules/editorial-rules/index.ts";
import { InMemoryKnowledgeRepository } from "../../src/modules/knowledge/in-memory-knowledge-repository.ts";
import { InMemoryPromptSkillRegistryRepository } from "../../src/modules/prompt-skill-registry/in-memory-prompt-skill-repository.ts";
import { createExecutionGovernanceApi } from "../../src/modules/execution-governance/execution-governance-api.ts";
import {
  ExecutionProfileKnowledgeItemNotApprovedError,
  ExecutionProfileModuleTemplateNotPublishedError,
  ExecutionProfilePromptTemplateNotPublishedError,
  ExecutionProfileSkillPackageNotPublishedError,
  ExecutionGovernanceService,
} from "../../src/modules/execution-governance/execution-governance-service.ts";
import { InMemoryExecutionGovernanceRepository } from "../../src/modules/execution-governance/in-memory-execution-governance-repository.ts";
import { InMemoryModuleTemplateRepository } from "../../src/modules/templates/in-memory-template-family-repository.ts";

function createExecutionGovernanceHarness() {
  const repository = new InMemoryExecutionGovernanceRepository();
  const editorialRuleRepository = new InMemoryEditorialRuleRepository();
  const moduleTemplateRepository = new InMemoryModuleTemplateRepository();
  const promptSkillRegistryRepository = new InMemoryPromptSkillRegistryRepository();
  const knowledgeRepository = new InMemoryKnowledgeRepository();
  const service = new ExecutionGovernanceService({
    repository,
    editorialRuleRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
    createId: (() => {
      const ids = ["profile-1", "profile-2", "profile-3", "rule-1", "rule-2"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected an execution governance id to be available.");
        return value;
      };
    })(),
  });
  const api = createExecutionGovernanceApi({
    executionGovernanceService: service,
  });

  return {
    api,
    repository,
    editorialRuleRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
  };
}

test("only admin can publish an execution profile and the previous active version is archived", async () => {
  const {
    api,
    editorialRuleRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
  } =
    createExecutionGovernanceHarness();

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
  await promptSkillRegistryRepository.saveSkillPackage({
    id: "skill-editing-1",
    name: "editing_skills",
    version: "1.0.0",
    scope: "admin_only",
    status: "published",
    applies_to_modules: ["editing"],
  });
  await editorialRuleRepository.saveRuleSet({
    id: "rule-set-editing-1",
    template_family_id: "family-1",
    module: "editing",
    version_no: 1,
    status: "published",
  });

  const firstProfile = await api.createProfile({
    actorRole: "admin",
    input: {
      module: "editing",
      manuscriptType: "clinical_study",
      templateFamilyId: "family-1",
      moduleTemplateId: "template-editing-1",
      ruleSetId: "rule-set-editing-1",
      promptTemplateId: "prompt-editing-1",
      skillPackageIds: ["skill-editing-1"],
      knowledgeBindingMode: "profile_only",
    },
  });
  const secondProfile = await api.createProfile({
    actorRole: "admin",
    input: {
      module: "editing",
      manuscriptType: "clinical_study",
      templateFamilyId: "family-1",
      moduleTemplateId: "template-editing-1",
      ruleSetId: "rule-set-editing-1",
      promptTemplateId: "prompt-editing-1",
      skillPackageIds: ["skill-editing-1"],
      knowledgeBindingMode: "profile_plus_dynamic",
    },
  });

  assert.equal(firstProfile.body.version, 1);
  assert.equal(secondProfile.body.version, 2);
  assert.equal(firstProfile.body.rule_set_id, "rule-set-editing-1");
  assert.equal(secondProfile.body.rule_set_id, "rule-set-editing-1");

  await assert.rejects(
    () =>
      api.publishProfile({
        actorRole: "editor",
        profileId: firstProfile.body.id,
      }),
    AuthorizationError,
  );

  const publishedFirst = await api.publishProfile({
    actorRole: "admin",
    profileId: firstProfile.body.id,
  });
  const publishedSecond = await api.publishProfile({
    actorRole: "admin",
    profileId: secondProfile.body.id,
  });
  const listed = await api.listProfiles();

  assert.equal(publishedFirst.body.status, "active");
  assert.equal(publishedSecond.body.status, "active");
  assert.equal(
    listed.body.find((record) => record.id === firstProfile.body.id)?.status,
    "archived",
  );
  assert.equal(
    listed.body.find((record) => record.id === secondProfile.body.id)?.status,
    "active",
  );
});

test("publishing a profile requires published template, prompt, skill, and rule-set assets", async () => {
  const {
    api,
    editorialRuleRepository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
  } =
    createExecutionGovernanceHarness();

  await moduleTemplateRepository.save({
    id: "template-screening-1",
    template_family_id: "family-1",
    module: "screening",
    manuscript_type: "clinical_study",
    version_no: 1,
    status: "draft",
    prompt: "Screening template",
  });
  await promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-screening-1",
    name: "screening_mainline",
    version: "1.0.0",
    status: "draft",
    module: "screening",
    manuscript_types: ["clinical_study"],
  });
  await promptSkillRegistryRepository.saveSkillPackage({
    id: "skill-screening-1",
    name: "screening_skills",
    version: "1.0.0",
    scope: "admin_only",
    status: "draft",
    applies_to_modules: ["screening"],
  });
  await editorialRuleRepository.saveRuleSet({
    id: "rule-set-screening-1",
    template_family_id: "family-1",
    module: "screening",
    version_no: 1,
    status: "draft",
  });

  const created = await api.createProfile({
    actorRole: "admin",
    input: {
      module: "screening",
      manuscriptType: "clinical_study",
      templateFamilyId: "family-1",
      moduleTemplateId: "template-screening-1",
      ruleSetId: "rule-set-screening-1",
      promptTemplateId: "prompt-screening-1",
      skillPackageIds: ["skill-screening-1"],
      knowledgeBindingMode: "profile_only",
    },
  });

  await assert.rejects(
    () =>
      api.publishProfile({
        actorRole: "admin",
        profileId: created.body.id,
      }),
    ExecutionProfileModuleTemplateNotPublishedError,
  );

  await moduleTemplateRepository.save({
    id: "template-screening-1",
    template_family_id: "family-1",
    module: "screening",
    manuscript_type: "clinical_study",
    version_no: 1,
    status: "published",
    prompt: "Screening template",
  });

  await assert.rejects(
    () =>
      api.publishProfile({
        actorRole: "admin",
        profileId: created.body.id,
      }),
    ExecutionProfilePromptTemplateNotPublishedError,
  );

  await promptSkillRegistryRepository.savePromptTemplate({
    id: "prompt-screening-1",
    name: "screening_mainline",
    version: "1.0.0",
    status: "published",
    module: "screening",
    manuscript_types: ["clinical_study"],
  });

  await assert.rejects(
    () =>
      api.publishProfile({
        actorRole: "admin",
        profileId: created.body.id,
      }),
    ExecutionProfileSkillPackageNotPublishedError,
  );

  await promptSkillRegistryRepository.saveSkillPackage({
    id: "skill-screening-1",
    name: "screening_skills",
    version: "1.0.0",
    scope: "admin_only",
    status: "published",
    applies_to_modules: ["screening"],
  });

  await assert.rejects(
    () =>
      api.publishProfile({
        actorRole: "admin",
        profileId: created.body.id,
      }),
    /rule set/i,
  );

  await editorialRuleRepository.saveRuleSet({
    id: "rule-set-screening-1",
    template_family_id: "family-1",
    module: "screening",
    version_no: 1,
    status: "published",
  });

  const published = await api.publishProfile({
    actorRole: "admin",
    profileId: created.body.id,
  });

  assert.equal(published.body.status, "active");
});

test("publishing a profile rejects active binding rules that point to unapproved knowledge", async () => {
  const {
    api,
    editorialRuleRepository,
    repository,
    moduleTemplateRepository,
    promptSkillRegistryRepository,
    knowledgeRepository,
  } = createExecutionGovernanceHarness();

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
  await promptSkillRegistryRepository.saveSkillPackage({
    id: "skill-screening-1",
    name: "screening_skills",
    version: "1.0.0",
    scope: "admin_only",
    status: "published",
    applies_to_modules: ["screening"],
  });
  await editorialRuleRepository.saveRuleSet({
    id: "rule-set-screening-1",
    template_family_id: "family-1",
    module: "screening",
    version_no: 1,
    status: "published",
  });
  await knowledgeRepository.save({
    id: "knowledge-draft-1",
    title: "Draft-only knowledge",
    canonical_text: "Should not be publishable yet.",
    knowledge_kind: "rule",
    status: "draft",
    routing: {
      module_scope: "screening",
      manuscript_types: ["clinical_study"],
    },
  });
  await repository.saveKnowledgeBindingRule({
    id: "rule-active-1",
    knowledge_item_id: "knowledge-draft-1",
    module: "screening",
    manuscript_types: ["clinical_study"],
    template_family_ids: ["family-1"],
    module_template_ids: ["template-screening-1"],
    priority: 10,
    binding_purpose: "required",
    status: "active",
  });

  const created = await api.createProfile({
    actorRole: "admin",
    input: {
      module: "screening",
      manuscriptType: "clinical_study",
      templateFamilyId: "family-1",
      moduleTemplateId: "template-screening-1",
      ruleSetId: "rule-set-screening-1",
      promptTemplateId: "prompt-screening-1",
      skillPackageIds: ["skill-screening-1"],
      knowledgeBindingMode: "profile_plus_dynamic",
    },
  });

  await assert.rejects(
    () =>
      api.publishProfile({
        actorRole: "admin",
        profileId: created.body.id,
      }),
    ExecutionProfileKnowledgeItemNotApprovedError,
  );
});

test("knowledge binding rules are created as drafts and listed by priority", async () => {
  const { api } = createExecutionGovernanceHarness();

  const lowPriority = await api.createKnowledgeBindingRule({
    actorRole: "admin",
    input: {
      knowledgeItemId: "knowledge-1",
      module: "editing",
      manuscriptTypes: ["clinical_study"],
      priority: 5,
      bindingPurpose: "recommended",
    },
  });
  const highPriority = await api.createKnowledgeBindingRule({
    actorRole: "admin",
    input: {
      knowledgeItemId: "knowledge-2",
      module: "editing",
      manuscriptTypes: ["clinical_study"],
      priority: 50,
      bindingPurpose: "required",
    },
  });
  const listed = await api.listKnowledgeBindingRules();

  assert.equal(lowPriority.body.status, "draft");
  assert.equal(highPriority.body.status, "draft");
  assert.deepEqual(
    listed.body.map((record) => record.id),
    [highPriority.body.id, lowPriority.body.id],
  );
});
