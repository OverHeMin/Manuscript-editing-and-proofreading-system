import test from "node:test";
import assert from "node:assert/strict";
import { ensurePersistentWorkbenchReviewBaseline } from "../../src/http/persistent-workbench-review-baseline.ts";

test("persistent review baseline seeds an active review family when no review family exists yet", async () => {
  const savedTemplateFamilies: Array<Record<string, unknown>> = [];
  const savedModuleTemplates: Array<Record<string, unknown>> = [];
  const savedPromptTemplates: Array<Record<string, unknown>> = [];
  const savedSkillPackages: Array<Record<string, unknown>> = [];
  const savedRuleSets: Array<Record<string, unknown>> = [];
  const savedProfiles: Array<Record<string, unknown>> = [];
  const savedSandboxProfiles: Array<Record<string, unknown>> = [];
  const savedAgentRuntimes: Array<Record<string, unknown>> = [];
  const savedAgentProfiles: Array<Record<string, unknown>> = [];
  const savedToolPolicies: Array<Record<string, unknown>> = [];
  const savedModels: Array<Record<string, unknown>> = [];
  const savedRetrievalPresets: Array<Record<string, unknown>> = [];
  const savedManualReviewPolicies: Array<Record<string, unknown>> = [];
  const savedRuntimeBindings: Array<Record<string, unknown>> = [];
  let savedRoutingPolicy: Record<string, unknown> | null = null;

  await ensurePersistentWorkbenchReviewBaseline({
    templateFamilyRepository: {
      list: async () => [
        {
          id: "clinical-draft-family",
          manuscript_type: "clinical_study",
          name: "Clinical Draft",
          status: "draft",
        },
      ],
      save: async (record: unknown) => {
        savedTemplateFamilies.push(record as Record<string, unknown>);
      },
    },
    moduleTemplateRepository: {
      save: async (record: unknown) => {
        savedModuleTemplates.push(record as Record<string, unknown>);
      },
    },
    promptSkillRegistryRepository: {
      savePromptTemplate: async (record: unknown) => {
        savedPromptTemplates.push(record as Record<string, unknown>);
      },
      saveSkillPackage: async (record: unknown) => {
        savedSkillPackages.push(record as Record<string, unknown>);
      },
    },
    editorialRuleRepository: {
      saveRuleSet: async (record: unknown) => {
        savedRuleSets.push(record as Record<string, unknown>);
      },
    },
    executionGovernanceRepository: {
      saveProfile: async (record: unknown) => {
        savedProfiles.push(record as Record<string, unknown>);
      },
    },
    sandboxProfileRepository: {
      save: async (record: unknown) => {
        savedSandboxProfiles.push(record as Record<string, unknown>);
      },
    },
    agentRuntimeRepository: {
      save: async (record: unknown) => {
        savedAgentRuntimes.push(record as Record<string, unknown>);
      },
    },
    agentProfileRepository: {
      save: async (record: unknown) => {
        savedAgentProfiles.push(record as Record<string, unknown>);
      },
    },
    runtimeBindingRepository: {
      save: async (record: unknown) => {
        savedRuntimeBindings.push(record as Record<string, unknown>);
      },
    },
    toolPermissionPolicyRepository: {
      save: async (record: unknown) => {
        savedToolPolicies.push(record as Record<string, unknown>);
      },
    },
    modelRegistryRepository: {
      save: async (record: unknown) => {
        savedModels.push(record as Record<string, unknown>);
      },
    },
    modelRoutingPolicyRepository: {
      get: async () => ({
        module_defaults: {},
        template_overrides: {},
      }),
      save: async (record: unknown) => {
        savedRoutingPolicy = record as Record<string, unknown>;
      },
    },
    retrievalPresetRepository: {
      save: async (record: unknown) => {
        savedRetrievalPresets.push(record as Record<string, unknown>);
      },
    },
    manualReviewPolicyRepository: {
      save: async (record: unknown) => {
        savedManualReviewPolicies.push(record as Record<string, unknown>);
      },
    },
  } as never);

  assert.equal(savedTemplateFamilies.length, 1);
  assert.equal(savedTemplateFamilies[0]?.manuscript_type, "review");
  assert.equal(savedTemplateFamilies[0]?.status, "active");
  assert.equal(savedModuleTemplates.length, 3);
  assert.equal(savedPromptTemplates.length, 3);
  assert.equal(savedSkillPackages.length, 3);
  assert.equal(savedRuleSets.length, 3);
  assert.equal(savedProfiles.length, 3);
  assert.equal(savedSandboxProfiles.length, 3);
  assert.equal(savedAgentRuntimes.length, 3);
  assert.equal(savedAgentProfiles.length, 3);
  assert.equal(savedToolPolicies.length, 3);
  assert.equal(savedModels.length, 3);
  assert.equal(savedRetrievalPresets.length, 3);
  assert.equal(savedManualReviewPolicies.length, 3);
  assert.equal(savedRuntimeBindings.length, 3);
  assert.ok(savedRoutingPolicy);
});
