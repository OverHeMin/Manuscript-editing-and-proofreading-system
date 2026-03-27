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
      const ids = ["skill-1", "prompt-1"];
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
