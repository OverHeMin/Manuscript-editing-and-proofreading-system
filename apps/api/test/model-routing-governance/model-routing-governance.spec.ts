import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryModelRegistryRepository } from "../../src/modules/model-registry/index.ts";
import {
  createModelRoutingGovernanceApi,
  InMemoryModelRoutingGovernanceRepository,
  ModelRoutingGovernanceDraftNotEditableError,
  ModelRoutingGovernanceService,
  ModelRoutingGovernanceValidationError,
  type CreateSystemSettingsModuleDefaultInput,
} from "../../src/modules/model-routing-governance/index.ts";
import type { ModelRegistryRecord } from "../../src/modules/model-registry/model-record.ts";

function createGovernanceHarness() {
  const modelRegistryRepository = new InMemoryModelRegistryRepository();
  const repository = new InMemoryModelRoutingGovernanceRepository();
  let nextIdCounter = 1;
  const nextId = () => `governance-${nextIdCounter++}`;

  const modelRoutingGovernanceService = new ModelRoutingGovernanceService({
    repository,
    modelRegistryRepository,
    createId: nextId,
    now: () => new Date("2026-04-03T08:00:00.000Z"),
  });

  return {
    api: createModelRoutingGovernanceApi({
      modelRoutingGovernanceService,
    }),
    modelRegistryRepository,
  };
}

async function seedModels(
  repository: InMemoryModelRegistryRepository,
  records: ModelRegistryRecord[],
) {
  for (const record of records) {
    await repository.save(record);
  }
}

test("model routing governance creates a draft, supports lifecycle transitions, and preserves superseded history", async () => {
  const { api, modelRegistryRepository } = createGovernanceHarness();

  await seedModels(modelRegistryRepository, [
    {
      id: "model-primary-1",
      provider: "openai",
      model_name: "gpt-5-primary",
      model_version: "2026-04",
      allowed_modules: ["screening", "editing", "proofreading"],
      is_prod_allowed: true,
    },
    {
      id: "model-primary-2",
      provider: "anthropic",
      model_name: "claude-sonnet",
      model_version: "4.1",
      allowed_modules: ["screening", "editing", "proofreading"],
      is_prod_allowed: true,
    },
    {
      id: "model-fallback-1",
      provider: "google",
      model_name: "gemini-pro",
      model_version: "2.5",
      allowed_modules: ["screening", "editing", "proofreading"],
      is_prod_allowed: true,
    },
    {
      id: "model-fallback-2",
      provider: "azure_openai",
      model_name: "gpt-4.1-mini",
      model_version: "2026-04",
      allowed_modules: ["screening", "editing", "proofreading"],
      is_prod_allowed: true,
    },
  ]);

  const createdDraft = await api.createPolicy({
    actorRole: "admin",
    input: {
      scopeKind: "template_family",
      scopeValue: "family-1",
      primaryModelId: "model-primary-1",
      fallbackModelIds: ["model-fallback-1"],
      evidenceLinks: [{ kind: "evaluation_run", id: "run-1" }],
      notes: "Initial governed routing decision.",
    },
  });

  assert.equal(createdDraft.status, 201);
  assert.equal(createdDraft.body.scope.scope_kind, "template_family");
  assert.equal(createdDraft.body.version.status, "draft");
  assert.deepEqual(createdDraft.body.version.fallback_model_ids, [
    "model-fallback-1",
  ]);
  assert.deepEqual(createdDraft.body.version.evidence_links, [
    { kind: "evaluation_run", id: "run-1" },
  ]);

  const updatedDraft = await api.updateDraftVersion({
    actorRole: "admin",
    versionId: createdDraft.body.version.id,
    input: {
      fallbackModelIds: ["model-fallback-1", "model-fallback-2"],
      evidenceLinks: [
        { kind: "evaluation_run", id: "run-1" },
        { kind: "evaluation_run", id: "run-2" },
      ],
      notes: "Expanded fallback coverage before review.",
    },
  });

  assert.deepEqual(updatedDraft.body.version.fallback_model_ids, [
    "model-fallback-1",
    "model-fallback-2",
  ]);
  assert.deepEqual(updatedDraft.body.version.evidence_links, [
    { kind: "evaluation_run", id: "run-1" },
    { kind: "evaluation_run", id: "run-2" },
  ]);
  assert.equal(
    updatedDraft.body.version.notes,
    "Expanded fallback coverage before review.",
  );

  const submitted = await api.submitVersion({
    actorRole: "admin",
    versionId: createdDraft.body.version.id,
    input: {
      reason: "Ready for routing review.",
    },
  });
  assert.equal(submitted.body.version.status, "pending_review");

  const approved = await api.approveVersion({
    actorRole: "admin",
    versionId: createdDraft.body.version.id,
    input: {
      reason: "Evidence reviewed and approved.",
    },
  });
  assert.equal(approved.body.version.status, "approved");

  const activated = await api.activateVersion({
    actorRole: "admin",
    versionId: createdDraft.body.version.id,
    input: {
      reason: "Make the approved version live.",
    },
  });
  assert.equal(activated.body.version.status, "active");

  const nextDraft = await api.createDraftVersion({
    actorRole: "admin",
    policyId: createdDraft.body.policy_id,
    input: {
      primaryModelId: "model-primary-2",
      fallbackModelIds: ["model-fallback-1"],
      evidenceLinks: [{ kind: "evaluation_run", id: "run-3" }],
      notes: "Evaluate the new primary model.",
    },
  });

  assert.equal(nextDraft.status, 201);
  assert.equal(nextDraft.body.version.version_no, 2);
  assert.equal(nextDraft.body.version.primary_model_id, "model-primary-2");

  const approvedNextDraft = await api.approveVersion({
    actorRole: "admin",
    versionId:
      (
        await api.submitVersion({
          actorRole: "admin",
          versionId: nextDraft.body.version.id,
          input: {
            reason: "Second draft is ready for review.",
          },
        })
      ).body.version.id,
    input: {
      reason: "Second draft approved.",
    },
  });
  assert.equal(approvedNextDraft.body.version.status, "approved");

  const activatedNextDraft = await api.activateVersion({
    actorRole: "admin",
    versionId: nextDraft.body.version.id,
    input: {
      reason: "Supersede the current active version.",
    },
  });
  assert.equal(activatedNextDraft.body.version.status, "active");

  const listed = await api.listPolicies();
  assert.equal(listed.status, 200);
  assert.equal(listed.body.length, 1);
  assert.equal(listed.body[0]?.scope_kind, "template_family");
  assert.equal(listed.body[0]?.scope_value, "family-1");
  assert.equal(listed.body[0]?.active_version?.id, nextDraft.body.version.id);
  assert.equal(
    listed.body[0]?.versions.find((version) => version.id === createdDraft.body.version.id)
      ?.status,
    "superseded",
  );
  assert.deepEqual(
    listed.body[0]?.versions.find((version) => version.id === createdDraft.body.version.id)
      ?.fallback_model_ids,
    ["model-fallback-1", "model-fallback-2"],
  );

  const rolledBack = await api.rollbackPolicy({
    actorRole: "admin",
    policyId: createdDraft.body.policy_id,
    input: {
      reason: "Revert to the legacy fallback path.",
    },
  });
  assert.equal(rolledBack.body.version.status, "rolled_back");

  const afterRollback = await api.listPolicies();
  assert.equal(afterRollback.body[0]?.active_version, undefined);
});

test("model routing governance only edits drafts and can reject a pending-review version", async () => {
  const { api, modelRegistryRepository } = createGovernanceHarness();

  await seedModels(modelRegistryRepository, [
    {
      id: "model-editing-primary",
      provider: "openai",
      model_name: "gpt-5-editing",
      model_version: "2026-04",
      allowed_modules: ["editing"],
      is_prod_allowed: true,
    },
  ]);

  const createdDraft = await api.createPolicy({
    actorRole: "admin",
    input: {
      scopeKind: "module",
      scopeValue: "editing",
      primaryModelId: "model-editing-primary",
      fallbackModelIds: [],
      evidenceLinks: [{ kind: "evaluation_run", id: "run-editing-1" }],
      notes: "Editing module routing draft.",
    },
  });

  await api.submitVersion({
    actorRole: "admin",
    versionId: createdDraft.body.version.id,
    input: {
      reason: "Send the module policy for review.",
    },
  });

  await assert.rejects(
    () =>
      api.updateDraftVersion({
        actorRole: "admin",
        versionId: createdDraft.body.version.id,
        input: {
          notes: "This should fail because the version is no longer a draft.",
        },
      }),
    ModelRoutingGovernanceDraftNotEditableError,
  );

  const rejected = await api.rejectVersion({
    actorRole: "admin",
    versionId: createdDraft.body.version.id,
    input: {
      reason: "Evidence is insufficient for activation.",
    },
  });

  assert.equal(rejected.body.version.status, "rejected");
});

test("model routing governance validates production readiness, module compatibility, and approval evidence", async () => {
  const { api, modelRegistryRepository } = createGovernanceHarness();

  await seedModels(modelRegistryRepository, [
    {
      id: "model-screening-primary",
      provider: "openai",
      model_name: "gpt-5-screening",
      model_version: "2026-04",
      allowed_modules: ["screening"],
      is_prod_allowed: true,
    },
    {
      id: "model-editing-only",
      provider: "anthropic",
      model_name: "claude-editing-only",
      model_version: "4.1",
      allowed_modules: ["editing"],
      is_prod_allowed: true,
    },
    {
      id: "model-non-prod",
      provider: "google",
      model_name: "gemini-eval-only",
      model_version: "2.5",
      allowed_modules: ["screening"],
      is_prod_allowed: false,
    },
  ]);

  await assert.rejects(
    () =>
      api.createPolicy({
        actorRole: "admin",
        input: {
          scopeKind: "module",
          scopeValue: "screening",
          primaryModelId: "model-editing-only",
          fallbackModelIds: [],
          evidenceLinks: [{ kind: "evaluation_run", id: "run-invalid-1" }],
        },
      }),
    ModelRoutingGovernanceValidationError,
  );

  await assert.rejects(
    () =>
      api.createPolicy({
        actorRole: "admin",
        input: {
          scopeKind: "module",
          scopeValue: "screening",
          primaryModelId: "model-non-prod",
          fallbackModelIds: [],
          evidenceLinks: [{ kind: "evaluation_run", id: "run-invalid-2" }],
        },
      }),
    ModelRoutingGovernanceValidationError,
  );

  const createdDraft = await api.createPolicy({
    actorRole: "admin",
    input: {
      scopeKind: "module",
      scopeValue: "screening",
      primaryModelId: "model-screening-primary",
      fallbackModelIds: [],
      evidenceLinks: [],
    },
  });

  await api.submitVersion({
    actorRole: "admin",
    versionId: createdDraft.body.version.id,
    input: {
      reason: "Intentionally missing evidence.",
    },
  });

  await assert.rejects(
    () =>
      api.approveVersion({
        actorRole: "admin",
        versionId: createdDraft.body.version.id,
        input: {
          reason: "This should fail without evidence.",
        },
      }),
    ModelRoutingGovernanceValidationError,
  );
});

test("model routing governance exposes bounded system-settings module defaults without mixing template-family overrides", async () => {
  const { api, modelRegistryRepository } = createGovernanceHarness();
  const systemSettingsApi = api as typeof api & {
    listSystemSettingsModuleDefaults: () => Promise<{
      status: number;
      body: Array<{
        module_key: "screening" | "editing" | "proofreading";
        primary_model_id?: string;
        fallback_model_id?: string;
        temperature?: number | null;
      }>;
    }>;
    saveSystemSettingsModuleDefault: (input: {
      actorRole: "admin";
      input: CreateSystemSettingsModuleDefaultInput;
    }) => Promise<{
      status: number;
      body: {
        module_key: "screening" | "editing" | "proofreading";
        primary_model_id?: string;
        fallback_model_id?: string;
        temperature?: number | null;
      };
    }>;
  };

  await seedModels(modelRegistryRepository, [
    {
      id: "model-screening-default",
      provider: "qwen",
      model_name: "qwen-screening",
      model_version: "2026-04",
      allowed_modules: ["screening"],
      is_prod_allowed: true,
    },
    {
      id: "model-editing-default",
      provider: "deepseek",
      model_name: "deepseek-editing",
      model_version: "2026-04",
      allowed_modules: ["editing"],
      is_prod_allowed: true,
    },
    {
      id: "model-proofreading-default",
      provider: "openai",
      model_name: "gpt-proofreading",
      model_version: "2026-04",
      allowed_modules: ["proofreading"],
      is_prod_allowed: true,
    },
    {
      id: "model-shared-fallback",
      provider: "anthropic",
      model_name: "claude-fallback",
      model_version: "4.1",
      allowed_modules: ["screening", "editing", "proofreading"],
      is_prod_allowed: true,
    },
  ]);

  await api.createPolicy({
    actorRole: "admin",
    input: {
      scopeKind: "template_family",
      scopeValue: "family-1",
      primaryModelId: "model-shared-fallback",
      fallbackModelIds: [],
      evidenceLinks: [{ kind: "evaluation_run", id: "run-template-family-1" }],
      notes: "Template-family override should stay outside the system-settings list.",
    },
  });

  await systemSettingsApi.saveSystemSettingsModuleDefault({
    actorRole: "admin",
    input: {
      moduleKey: "screening",
      primaryModelId: "model-screening-default",
      fallbackModelId: "model-shared-fallback",
      temperature: 0.1,
    },
  });
  await systemSettingsApi.saveSystemSettingsModuleDefault({
    actorRole: "admin",
    input: {
      moduleKey: "editing",
      primaryModelId: "model-editing-default",
      fallbackModelId: "model-shared-fallback",
      temperature: 0.2,
    },
  });
  await systemSettingsApi.saveSystemSettingsModuleDefault({
    actorRole: "admin",
    input: {
      moduleKey: "proofreading",
      primaryModelId: "model-proofreading-default",
      fallbackModelId: "model-shared-fallback",
      temperature: 0.3,
    },
  });

  const listedDefaults = await systemSettingsApi.listSystemSettingsModuleDefaults();

  assert.equal(listedDefaults.status, 200);
  assert.deepEqual(
    listedDefaults.body.map((record) => ({
      module_key: record.module_key,
      primary_model_id: record.primary_model_id,
      fallback_model_id: record.fallback_model_id,
      temperature: record.temperature,
    })),
    [
      {
        module_key: "screening",
        primary_model_id: "model-screening-default",
        fallback_model_id: "model-shared-fallback",
        temperature: 0.1,
      },
      {
        module_key: "editing",
        primary_model_id: "model-editing-default",
        fallback_model_id: "model-shared-fallback",
        temperature: 0.2,
      },
      {
        module_key: "proofreading",
        primary_model_id: "model-proofreading-default",
        fallback_model_id: "model-shared-fallback",
        temperature: 0.3,
      },
    ],
  );

  await assert.rejects(
    () =>
      systemSettingsApi.saveSystemSettingsModuleDefault({
        actorRole: "admin",
        input: {
          moduleKey: "screening",
          primaryModelId: "model-screening-default",
          fallbackModelId: "model-shared-fallback",
          temperature: 1.4,
        },
      }),
    ModelRoutingGovernanceValidationError,
  );
});
