import test from "node:test";
import assert from "node:assert/strict";
import { AuthorizationError } from "../../src/auth/permission-guard.ts";
import { createPromptSkillRegistryApi } from "../../src/modules/prompt-skill-registry/prompt-skill-api.ts";
import { InMemoryPromptSkillRegistryRepository } from "../../src/modules/prompt-skill-registry/in-memory-prompt-skill-repository.ts";
import { PromptSkillRegistryService } from "../../src/modules/prompt-skill-registry/prompt-skill-service.ts";

function createPromptSkillHarness() {
  const repository = new InMemoryPromptSkillRegistryRepository();
  const service = new PromptSkillRegistryService({
    repository,
    createId: (() => {
      const ids = [
        "skill-1",
        "prompt-1",
        "skill-2",
        "prompt-2",
        "skill-3",
        "prompt-3",
      ];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected a prompt/skill id to be available.");
        return value;
      };
    })(),
  });
  const api = createPromptSkillRegistryApi({
    promptSkillRegistryService: service,
  });

  return {
    api,
  };
}

test("prompt and skill packages are versioned and remain admin-only", async () => {
  const { api } = createPromptSkillHarness();

  await assert.rejects(
    () =>
      api.createSkillPackage({
        actorRole: "editor",
        input: {
          name: "document_pipeline_skills",
          version: "0.1.0",
          appliesToModules: ["screening", "editing"],
        },
      }),
    AuthorizationError,
  );

  const createdSkill = await api.createSkillPackage({
    actorRole: "admin",
    input: {
      name: "document_pipeline_skills",
      version: "0.1.0",
      appliesToModules: ["screening", "editing"],
    },
  });

  assert.equal(createdSkill.status, 201);
  assert.equal(createdSkill.body.scope, "admin_only");
  assert.equal(createdSkill.body.status, "draft");

  const createdPrompt = await api.createPromptTemplate({
    actorRole: "admin",
    input: {
      name: "proofreading_mainline",
      version: "1.0.0",
      module: "proofreading",
      manuscriptTypes: ["review"],
      rollbackTargetVersion: "0.9.0",
    },
  });

  assert.equal(createdPrompt.status, 201);
  assert.equal(createdPrompt.body.status, "draft");
  assert.equal(createdPrompt.body.module, "proofreading");
  assert.deepEqual(createdPrompt.body.manuscript_types, ["review"]);
  assert.equal(createdPrompt.body.rollback_target_version, "0.9.0");
});

test("prompt templates and skill packages can be published and archive earlier active versions", async () => {
  const { api } = createPromptSkillHarness();

  const skillV1 = await api.createSkillPackage({
    actorRole: "admin",
    input: {
      name: "screening_skills",
      version: "1.0.0",
      appliesToModules: ["screening"],
    },
  });
  const skillV2 = await api.createSkillPackage({
    actorRole: "admin",
    input: {
      name: "screening_skills",
      version: "1.1.0",
      appliesToModules: ["screening"],
    },
  });

  const publishedSkillV1 = await api.publishSkillPackage({
    actorRole: "admin",
    skillPackageId: skillV1.body.id,
  });
  const publishedSkillV2 = await api.publishSkillPackage({
    actorRole: "admin",
    skillPackageId: skillV2.body.id,
  });
  const listedSkills = await api.listSkillPackages();

  assert.equal(publishedSkillV1.body.status, "published");
  assert.equal(publishedSkillV2.body.status, "published");
  assert.equal(
    listedSkills.body.find((record) => record.id === skillV1.body.id)?.status,
    "archived",
  );
  assert.equal(
    listedSkills.body.find((record) => record.id === skillV2.body.id)?.status,
    "published",
  );

  const promptV1 = await api.createPromptTemplate({
    actorRole: "admin",
    input: {
      name: "screening_mainline",
      version: "1.0.0",
      module: "screening",
      manuscriptTypes: ["clinical_study"],
    },
  });
  const promptV2 = await api.createPromptTemplate({
    actorRole: "admin",
    input: {
      name: "screening_mainline",
      version: "1.1.0",
      module: "screening",
      manuscriptTypes: ["clinical_study"],
    },
  });

  const publishedPromptV1 = await api.publishPromptTemplate({
    actorRole: "admin",
    promptTemplateId: promptV1.body.id,
  });
  const publishedPromptV2 = await api.publishPromptTemplate({
    actorRole: "admin",
    promptTemplateId: promptV2.body.id,
  });
  const listedPrompts = await api.listPromptTemplates();

  assert.equal(publishedPromptV1.body.status, "published");
  assert.equal(publishedPromptV2.body.status, "published");
  assert.equal(
    listedPrompts.body.find((record) => record.id === promptV1.body.id)?.status,
    "archived",
  );
  assert.equal(
    listedPrompts.body.find((record) => record.id === promptV2.body.id)?.status,
    "published",
  );
});
