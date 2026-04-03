import test from "node:test";
import assert from "node:assert/strict";
import {
  createAdminGovernanceWorkbenchController,
} from "../src/features/admin-governance/admin-governance-controller.ts";

const agentToolingOverviewUrls = [
  "/api/v1/tool-gateway",
  "/api/v1/sandbox-profiles",
  "/api/v1/agent-profiles",
  "/api/v1/agent-runtime",
  "/api/v1/tool-permission-policies",
  "/api/v1/verification-ops/check-profiles",
  "/api/v1/verification-ops/release-check-profiles",
  "/api/v1/verification-ops/evaluation-suites",
  "/api/v1/runtime-bindings",
  "/api/v1/agent-execution",
] as const;
const routingGovernanceOverviewUrl = "/api/v1/model-routing-governance/policies";

test("admin governance controller loads families, prompts, skills, and the selected family module templates", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createAdminGovernanceWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.url === "/api/v1/templates/families") {
        return {
          status: 200,
          body: [
            {
              id: "family-1",
              manuscript_type: "review",
              name: "Review family",
              status: "active",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/templates/families/family-1/module-templates") {
        return {
          status: 200,
          body: [
            {
              id: "template-1",
              template_family_id: "family-1",
              module: "proofreading",
              manuscript_type: "review",
              version_no: 2,
              status: "draft",
              prompt: "Create proofreading draft first.",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/prompt-skill-registry/prompt-templates") {
        return {
          status: 200,
          body: [
            {
              id: "prompt-1",
              name: "proofreading_mainline",
              version: "1.0.0",
              status: "published",
              module: "proofreading",
              manuscript_types: ["review"],
            },
          ] as TResponse,
        };
      }

      const emptyAgentToolingResponse = createEmptyAgentToolingListResponse<TResponse>(input.url);
      if (emptyAgentToolingResponse) {
        return emptyAgentToolingResponse;
      }

      return {
        status: 200,
        body: [
          {
            id: "skill-1",
            name: "editing_skills",
            version: "1.0.0",
            scope: "admin_only",
            status: "published",
            applies_to_modules: ["editing"],
          },
        ] as TResponse,
      };
    },
  });

  const overview = await controller.loadOverview();

  assert.equal(overview.selectedTemplateFamilyId, "family-1");
  assert.equal(overview.templateFamilies.length, 1);
  assert.equal(overview.moduleTemplates.length, 1);
  assert.equal(overview.promptTemplates.length, 1);
  assert.equal(overview.skillPackages.length, 1);
  assert.deepEqual(
    requests.map((request) => request.url),
    [
      "/api/v1/templates/families",
      "/api/v1/prompt-skill-registry/prompt-templates",
      "/api/v1/prompt-skill-registry/skill-packages",
      "/api/v1/model-registry",
      "/api/v1/model-registry/routing-policy",
      routingGovernanceOverviewUrl,
      "/api/v1/execution-governance/profiles",
      ...agentToolingOverviewUrls,
      "/api/v1/templates/families/family-1/module-templates",
    ],
  );
});

test("admin governance controller creates a family and reloads the overview around the new selection", async () => {
  const controller = createAdminGovernanceWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      if (input.method === "POST" && input.url === "/api/v1/templates/families") {
        return {
          status: 201,
          body: {
            id: "family-2",
            manuscript_type: "case_report",
            name: "Case family",
            status: "draft",
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/templates/families") {
        return {
          status: 200,
          body: [
            {
              id: "family-2",
              manuscript_type: "case_report",
              name: "Case family",
              status: "draft",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/templates/families/family-2/module-templates") {
        return {
          status: 200,
          body: [] as TResponse,
        };
      }

      const emptyAgentToolingResponse = createEmptyAgentToolingListResponse<TResponse>(input.url);
      if (emptyAgentToolingResponse) {
        return emptyAgentToolingResponse;
      }

      return {
        status: 200,
        body: [] as TResponse,
      };
    },
  });

  const result = await controller.createTemplateFamilyAndReload({
    manuscriptType: "case_report",
    name: "Case family",
  });

  assert.equal(result.createdFamily.id, "family-2");
  assert.equal(result.overview.selectedTemplateFamilyId, "family-2");
  assert.deepEqual(result.overview.moduleTemplates, []);
});

test("admin governance controller loads model registry entries and routing policy", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createAdminGovernanceWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.url === "/api/v1/templates/families") {
        return {
          status: 200,
          body: [] as TResponse,
        };
      }

      if (input.url === "/api/v1/prompt-skill-registry/prompt-templates") {
        return {
          status: 200,
          body: [] as TResponse,
        };
      }

      if (input.url === "/api/v1/prompt-skill-registry/skill-packages") {
        return {
          status: 200,
          body: [] as TResponse,
        };
      }

      const emptyAgentToolingResponse = createEmptyAgentToolingListResponse<TResponse>(input.url);
      if (emptyAgentToolingResponse) {
        return emptyAgentToolingResponse;
      }

      if (input.url === "/api/v1/model-registry") {
        return {
          status: 200,
          body: [
            {
              id: "model-1",
              provider: "openai",
              model_name: "gpt-5.4",
              model_version: "2026-03-01",
              allowed_modules: ["screening", "editing", "proofreading"],
              is_prod_allowed: true,
            },
          ] as TResponse,
        };
      }

      return {
        status: 200,
        body: {
          system_default_model_id: "model-1",
          module_defaults: {
            screening: "model-1",
          },
          template_overrides: {
            "template-1": "model-1",
          },
        } as TResponse,
      };
    },
  });

  const overview = await controller.loadOverview();

  assert.equal(overview.modelRegistryEntries.length, 1);
  assert.deepEqual(overview.modelRegistryEntries[0], {
    id: "model-1",
    provider: "openai",
    model_name: "gpt-5.4",
    model_version: "2026-03-01",
    allowed_modules: ["screening", "editing", "proofreading"],
    is_prod_allowed: true,
  });
  assert.deepEqual(overview.modelRoutingPolicy, {
    system_default_model_id: "model-1",
    module_defaults: {
      screening: "model-1",
    },
    template_overrides: {
      "template-1": "model-1",
    },
  });
  assert.deepEqual(
    requests.map((request) => request.url),
    [
      "/api/v1/templates/families",
      "/api/v1/prompt-skill-registry/prompt-templates",
      "/api/v1/prompt-skill-registry/skill-packages",
      "/api/v1/model-registry",
      "/api/v1/model-registry/routing-policy",
      routingGovernanceOverviewUrl,
      "/api/v1/execution-governance/profiles",
      ...agentToolingOverviewUrls,
    ],
  );
});

test("admin governance controller loads versioned routing policies alongside registry assets", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createAdminGovernanceWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.url === "/api/v1/templates/families") {
        return {
          status: 200,
          body: [] as TResponse,
        };
      }

      if (input.url === "/api/v1/prompt-skill-registry/prompt-templates") {
        return {
          status: 200,
          body: [] as TResponse,
        };
      }

      if (input.url === "/api/v1/prompt-skill-registry/skill-packages") {
        return {
          status: 200,
          body: [] as TResponse,
        };
      }

      if (input.url === "/api/v1/model-registry") {
        return {
          status: 200,
          body: [
            {
              id: "model-primary-1",
              provider: "openai",
              model_name: "gpt-5.4",
              model_version: "2026-04-01",
              allowed_modules: ["screening", "editing", "proofreading"],
              is_prod_allowed: true,
            },
            {
              id: "model-fallback-1",
              provider: "google",
              model_name: "gemini-2.5-pro",
              model_version: "2026-04-01",
              allowed_modules: ["screening", "editing", "proofreading"],
              is_prod_allowed: true,
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/model-registry/routing-policy") {
        return {
          status: 200,
          body: {
            system_default_model_id: "model-primary-1",
            module_defaults: {},
            template_overrides: {},
          } as TResponse,
        };
      }

      if (input.method === "GET" && input.url === routingGovernanceOverviewUrl) {
        return {
          status: 200,
          body: [
            {
              policy_id: "policy-1",
              scope_kind: "template_family",
              scope_value: "family-1",
              active_version: {
                id: "policy-version-1",
                policy_scope_id: "policy-1",
                scope_kind: "template_family",
                scope_value: "family-1",
                version_no: 1,
                primary_model_id: "model-primary-1",
                fallback_model_ids: ["model-fallback-1"],
                evidence_links: [{ kind: "evaluation_run", id: "run-1" }],
                status: "active",
                created_at: "2026-04-03T08:00:00.000Z",
                updated_at: "2026-04-03T08:05:00.000Z",
              },
              versions: [],
              decisions: [],
            },
          ] as TResponse,
        };
      }

      const emptyAgentToolingResponse = createEmptyAgentToolingListResponse<TResponse>(input.url);
      if (emptyAgentToolingResponse) {
        return emptyAgentToolingResponse;
      }

      return {
        status: 200,
        body: [] as TResponse,
      };
    },
  });

  const overview = await controller.loadOverview();

  assert.equal(overview.routingPolicies[0]?.scope_kind, "template_family");
  assert.equal(overview.routingPolicies[0]?.active_version?.status, "active");
  assert.equal(
    overview.routingPolicies[0]?.active_version?.primary_model_id,
    "model-primary-1",
  );
  assert.deepEqual(
    overview.routingPolicies[0]?.active_version?.fallback_model_ids,
    ["model-fallback-1"],
  );
  assert.deepEqual(
    requests.map((request) => request.url),
    [
      "/api/v1/templates/families",
      "/api/v1/prompt-skill-registry/prompt-templates",
      "/api/v1/prompt-skill-registry/skill-packages",
      "/api/v1/model-registry",
      "/api/v1/model-registry/routing-policy",
      routingGovernanceOverviewUrl,
      "/api/v1/execution-governance/profiles",
      ...agentToolingOverviewUrls,
    ],
  );
});

test("admin governance controller runs the routing policy lifecycle and reloads overview", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  let latestStatus = "draft";
  let latestPrimaryModelId = "model-primary-1";
  let latestNotes = "Routing governance lifecycle test";
  let latestVersionId = "policy-version-1";
  let latestVersionNo = 1;
  let latestPolicyActive = false;

  const controller = createAdminGovernanceWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.url === "/api/v1/templates/families") {
        return { status: 200, body: [] as TResponse };
      }

      if (
        input.url === "/api/v1/prompt-skill-registry/prompt-templates" ||
        input.url === "/api/v1/prompt-skill-registry/skill-packages" ||
        input.url === "/api/v1/model-registry"
      ) {
        return {
          status: 200,
          body:
            input.url === "/api/v1/model-registry"
              ? ([
                  {
                    id: "model-primary-1",
                    provider: "openai",
                    model_name: "gpt-5.4",
                    model_version: "2026-04-01",
                    allowed_modules: ["screening", "editing", "proofreading"],
                    is_prod_allowed: true,
                  },
                  {
                    id: "model-fallback-1",
                    provider: "google",
                    model_name: "gemini-2.5-pro",
                    model_version: "2026-04-01",
                    allowed_modules: ["screening", "editing", "proofreading"],
                    is_prod_allowed: true,
                  },
                ] as TResponse)
              : ([] as TResponse),
        };
      }

      if (input.url === "/api/v1/model-registry/routing-policy") {
        return {
          status: 200,
          body: {
            system_default_model_id: undefined,
            module_defaults: {},
            template_overrides: {},
          } as TResponse,
        };
      }

      if (input.method === "GET" && input.url === routingGovernanceOverviewUrl) {
        return {
          status: 200,
          body: [
            {
              policy_id: "policy-1",
              scope_kind: "template_family",
              scope_value: "family-1",
              active_version: latestPolicyActive
                ? {
                    id: latestVersionId,
                    policy_scope_id: "policy-1",
                    scope_kind: "template_family",
                    scope_value: "family-1",
                    version_no: latestVersionNo,
                    primary_model_id: latestPrimaryModelId,
                    fallback_model_ids: ["model-fallback-1"],
                    evidence_links: [{ kind: "evaluation_run", id: "run-1" }],
                    notes: latestNotes,
                    status: latestStatus,
                    created_at: "2026-04-03T08:00:00.000Z",
                    updated_at: "2026-04-03T08:05:00.000Z",
                  }
                : undefined,
              versions: [
                {
                  id: latestVersionId,
                  policy_scope_id: "policy-1",
                  scope_kind: "template_family",
                  scope_value: "family-1",
                  version_no: latestVersionNo,
                  primary_model_id: latestPrimaryModelId,
                  fallback_model_ids: ["model-fallback-1"],
                  evidence_links: [{ kind: "evaluation_run", id: "run-1" }],
                  notes: latestNotes,
                  status: latestStatus,
                  created_at: "2026-04-03T08:00:00.000Z",
                  updated_at: "2026-04-03T08:05:00.000Z",
                },
              ],
              decisions: [],
            },
          ] as TResponse,
        };
      }

      if (input.method === "POST" && input.url === "/api/v1/model-routing-governance/policies") {
        latestStatus = "draft";
        latestPolicyActive = false;
        latestVersionId = "policy-version-1";
        latestVersionNo = 1;
        latestNotes = "Create policy";
        return {
          status: 201,
          body: {
            policy_id: "policy-1",
            scope: {
              id: "policy-1",
              scope_kind: "template_family",
              scope_value: "family-1",
              created_at: "2026-04-03T08:00:00.000Z",
              updated_at: "2026-04-03T08:00:00.000Z",
            },
            version: {
              id: latestVersionId,
              policy_scope_id: "policy-1",
              scope_kind: "template_family",
              scope_value: "family-1",
              version_no: latestVersionNo,
              primary_model_id: latestPrimaryModelId,
              fallback_model_ids: ["model-fallback-1"],
              evidence_links: [{ kind: "evaluation_run", id: "run-1" }],
              notes: latestNotes,
              status: latestStatus,
              created_at: "2026-04-03T08:00:00.000Z",
              updated_at: "2026-04-03T08:00:00.000Z",
            },
          } as TResponse,
        };
      }

      if (
        input.method === "POST" &&
        input.url === "/api/v1/model-routing-governance/versions/policy-version-1/draft"
      ) {
        latestNotes = "Saved draft updates.";
        return {
          status: 200,
          body: {
            policy_id: "policy-1",
            scope: {
              id: "policy-1",
              scope_kind: "template_family",
              scope_value: "family-1",
              created_at: "2026-04-03T08:00:00.000Z",
              updated_at: "2026-04-03T08:00:00.000Z",
            },
            version: {
              id: latestVersionId,
              policy_scope_id: "policy-1",
              scope_kind: "template_family",
              scope_value: "family-1",
              version_no: latestVersionNo,
              primary_model_id: latestPrimaryModelId,
              fallback_model_ids: ["model-fallback-1"],
              evidence_links: [{ kind: "evaluation_run", id: "run-1" }],
              notes: latestNotes,
              status: latestStatus,
              created_at: "2026-04-03T08:00:00.000Z",
              updated_at: "2026-04-03T08:02:00.000Z",
            },
          } as TResponse,
        };
      }

      if (
        input.method === "POST" &&
        input.url === "/api/v1/model-routing-governance/versions/policy-version-1/submit"
      ) {
        latestStatus = "pending_review";
        return { status: 200, body: {} as TResponse };
      }

      if (
        input.method === "POST" &&
        input.url === "/api/v1/model-routing-governance/versions/policy-version-1/approve"
      ) {
        latestStatus = "approved";
        return { status: 200, body: {} as TResponse };
      }

      if (
        input.method === "POST" &&
        input.url === "/api/v1/model-routing-governance/versions/policy-version-1/activate"
      ) {
        latestStatus = "active";
        latestPolicyActive = true;
        return { status: 200, body: {} as TResponse };
      }

      if (
        input.method === "POST" &&
        input.url === "/api/v1/model-routing-governance/policies/policy-1/versions"
      ) {
        latestStatus = "draft";
        latestVersionId = "policy-version-2";
        latestVersionNo = 2;
        latestPrimaryModelId = "model-primary-1";
        latestNotes = "New Draft Version";
        return { status: 201, body: {} as TResponse };
      }

      if (
        input.method === "POST" &&
        input.url === "/api/v1/model-routing-governance/policies/policy-1/rollback"
      ) {
        latestStatus = "rolled_back";
        latestPolicyActive = false;
        return { status: 200, body: {} as TResponse };
      }

      const emptyAgentToolingResponse = createEmptyAgentToolingListResponse<TResponse>(input.url);
      if (emptyAgentToolingResponse) {
        return emptyAgentToolingResponse;
      }

      return {
        status: 200,
        body: [] as TResponse,
      };
    },
  });

  const created = await controller.createRoutingPolicyAndReload({
    actorRole: "admin",
    scopeKind: "template_family",
    scopeValue: "family-1",
    primaryModelId: "model-primary-1",
    fallbackModelIds: ["model-fallback-1"],
    evidenceLinks: [{ kind: "evaluation_run", id: "run-1" }],
    notes: "Create policy",
  });
  const savedOverview = await controller.saveRoutingPolicyDraftAndReload({
    actorRole: "admin",
    versionId: "policy-version-1",
    input: {
      notes: "Saved draft updates.",
    },
  });
  const submittedOverview = await controller.submitRoutingPolicyVersionAndReload({
    actorRole: "admin",
    versionId: "policy-version-1",
    reason: "Submit for review",
  });
  const approvedOverview = await controller.approveRoutingPolicyVersionAndReload({
    actorRole: "admin",
    versionId: "policy-version-1",
    reason: "Approve",
  });
  const activatedOverview = await controller.activateRoutingPolicyVersionAndReload({
    actorRole: "admin",
    versionId: "policy-version-1",
    reason: "Activate",
  });
  const nextDraftOverview = await controller.createRoutingPolicyDraftVersionAndReload({
    actorRole: "admin",
    policyId: "policy-1",
    input: {
      primaryModelId: "model-primary-1",
      fallbackModelIds: ["model-fallback-1"],
      evidenceLinks: [{ kind: "evaluation_run", id: "run-1" }],
      notes: "New Draft Version",
    },
  });
  const rolledBackOverview = await controller.rollbackRoutingPolicyAndReload({
    actorRole: "admin",
    policyId: "policy-1",
    reason: "Rollback",
  });

  assert.equal(created.createdPolicy.version.id, "policy-version-1");
  assert.equal(savedOverview.routingPolicies[0]?.versions[0]?.notes, "Saved draft updates.");
  assert.equal(submittedOverview.routingPolicies[0]?.versions[0]?.status, "pending_review");
  assert.equal(approvedOverview.routingPolicies[0]?.versions[0]?.status, "approved");
  assert.equal(activatedOverview.routingPolicies[0]?.active_version?.status, "active");
  assert.equal(nextDraftOverview.routingPolicies[0]?.versions[0]?.version_no, 2);
  assert.equal(rolledBackOverview.routingPolicies[0]?.active_version, undefined);
  assert.deepEqual(
    requests
      .filter((request) => request.method === "POST")
      .map((request) => request.url),
    [
      "/api/v1/model-routing-governance/policies",
      "/api/v1/model-routing-governance/versions/policy-version-1/draft",
      "/api/v1/model-routing-governance/versions/policy-version-1/submit",
      "/api/v1/model-routing-governance/versions/policy-version-1/approve",
      "/api/v1/model-routing-governance/versions/policy-version-1/activate",
      "/api/v1/model-routing-governance/policies/policy-1/versions",
      "/api/v1/model-routing-governance/policies/policy-1/rollback",
    ],
  );
});

test("admin governance controller creates a model entry and reloads governance overview", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createAdminGovernanceWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.method === "POST" && input.url === "/api/v1/model-registry") {
        return {
          status: 201,
          body: {
            id: "model-2",
            provider: "anthropic",
            model_name: "claude-sonnet",
            model_version: "2026-02-15",
            allowed_modules: ["editing", "proofreading"],
            is_prod_allowed: true,
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/model-registry") {
        return {
          status: 200,
          body: [
            {
              id: "model-2",
              provider: "anthropic",
              model_name: "claude-sonnet",
              model_version: "2026-02-15",
              allowed_modules: ["editing", "proofreading"],
              is_prod_allowed: true,
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/model-registry/routing-policy") {
        return {
          status: 200,
          body: {
            system_default_model_id: undefined,
            module_defaults: {},
            template_overrides: {},
          } as TResponse,
        };
      }

      const emptyAgentToolingResponse = createEmptyAgentToolingListResponse<TResponse>(input.url);
      if (emptyAgentToolingResponse) {
        return emptyAgentToolingResponse;
      }

      return {
        status: 200,
        body: [] as TResponse,
      };
    },
  });

  const result = await controller.createModelEntryAndReload({
    actorRole: "admin",
    provider: "anthropic",
    modelName: "claude-sonnet",
    modelVersion: "2026-02-15",
    allowedModules: ["editing", "proofreading"],
    isProdAllowed: true,
  });

  assert.equal(result.createdModel.id, "model-2");
  assert.equal(result.overview.modelRegistryEntries.length, 1);
  assert.deepEqual(
    requests.map((request) => request.url),
    [
      "/api/v1/model-registry",
      "/api/v1/templates/families",
      "/api/v1/prompt-skill-registry/prompt-templates",
      "/api/v1/prompt-skill-registry/skill-packages",
      "/api/v1/model-registry",
      "/api/v1/model-registry/routing-policy",
      routingGovernanceOverviewUrl,
      "/api/v1/execution-governance/profiles",
      ...agentToolingOverviewUrls,
    ],
  );
});

test("admin governance controller updates routing policy and reloads governance overview", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createAdminGovernanceWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (
        input.method === "POST" &&
        input.url === "/api/v1/model-registry/routing-policy"
      ) {
        return {
          status: 200,
          body: {
            system_default_model_id: "model-1",
            module_defaults: {
              editing: "model-1",
            },
            template_overrides: {},
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/model-registry") {
        return {
          status: 200,
          body: [
            {
              id: "model-1",
              provider: "openai",
              model_name: "gpt-5.4",
              model_version: "2026-03-01",
              allowed_modules: ["screening", "editing", "proofreading"],
              is_prod_allowed: true,
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/model-registry/routing-policy") {
        return {
          status: 200,
          body: {
            system_default_model_id: "model-1",
            module_defaults: {
              editing: "model-1",
            },
            template_overrides: {},
          } as TResponse,
        };
      }

      const emptyAgentToolingResponse = createEmptyAgentToolingListResponse<TResponse>(input.url);
      if (emptyAgentToolingResponse) {
        return emptyAgentToolingResponse;
      }

      return {
        status: 200,
        body: [] as TResponse,
      };
    },
  });

  const overview = await controller.updateRoutingPolicyAndReload({
    actorRole: "admin",
    moduleDefaults: {
      editing: "model-1",
    },
  });

  assert.deepEqual(overview.modelRoutingPolicy, {
    system_default_model_id: "model-1",
    module_defaults: {
      editing: "model-1",
    },
    template_overrides: {},
  });
  assert.deepEqual(
    requests.map((request) => request.url),
    [
      "/api/v1/model-registry/routing-policy",
      "/api/v1/templates/families",
      "/api/v1/prompt-skill-registry/prompt-templates",
      "/api/v1/prompt-skill-registry/skill-packages",
      "/api/v1/model-registry",
      "/api/v1/model-registry/routing-policy",
      routingGovernanceOverviewUrl,
      "/api/v1/execution-governance/profiles",
      ...agentToolingOverviewUrls,
    ],
  );
});

test("admin governance controller loads execution profiles and resolves execution preview", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createAdminGovernanceWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.url === "/api/v1/templates/families") {
        return {
          status: 200,
          body: [
            {
              id: "family-1",
              manuscript_type: "clinical_study",
              name: "Execution family",
              status: "active",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/templates/families/family-1/module-templates") {
        return {
          status: 200,
          body: [
            {
              id: "template-1",
              template_family_id: "family-1",
              module: "editing",
              manuscript_type: "clinical_study",
              version_no: 1,
              status: "published",
              prompt: "Execution template",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/prompt-skill-registry/prompt-templates") {
        return {
          status: 200,
          body: [
            {
              id: "prompt-1",
              name: "editing_mainline",
              version: "1.0.0",
              status: "published",
              module: "editing",
              manuscript_types: ["clinical_study"],
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/prompt-skill-registry/skill-packages") {
        return {
          status: 200,
          body: [
            {
              id: "skill-1",
              name: "editing_skills",
              version: "1.0.0",
              scope: "admin_only",
              status: "published",
              applies_to_modules: ["editing"],
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/model-registry") {
        return {
          status: 200,
          body: [
            {
              id: "model-1",
              provider: "openai",
              model_name: "gpt-5.4",
              model_version: "2026-03-01",
              allowed_modules: ["editing"],
              is_prod_allowed: true,
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/model-registry/routing-policy") {
        return {
          status: 200,
          body: {
            system_default_model_id: undefined,
            module_defaults: {
              editing: "model-1",
            },
            template_overrides: {},
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/execution-governance/profiles") {
        return {
          status: 200,
          body: [
            {
              id: "profile-1",
              module: "editing",
              manuscript_type: "clinical_study",
              template_family_id: "family-1",
              module_template_id: "template-1",
              prompt_template_id: "prompt-1",
              skill_package_ids: ["skill-1"],
              knowledge_binding_mode: "profile_plus_dynamic",
              status: "active",
              version: 1,
            },
          ] as TResponse,
        };
      }

      const emptyAgentToolingResponse = createEmptyAgentToolingListResponse<TResponse>(input.url);
      if (emptyAgentToolingResponse) {
        return emptyAgentToolingResponse;
      }

      return {
        status: 200,
        body: {
          profile: {
            id: "profile-1",
          },
          resolved_model: {
            id: "model-1",
          },
          knowledge_items: [
            {
              id: "knowledge-1",
            },
          ],
        } as TResponse,
      };
    },
  });

  const overview = await controller.loadOverview();
  const preview = await controller.resolveExecutionBundlePreview({
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
  });

  assert.equal(overview.executionProfiles.length, 1);
  assert.equal(overview.executionProfiles[0]?.id, "profile-1");
  assert.equal(preview.profile.id, "profile-1");
  assert.equal(preview.resolved_model.id, "model-1");
  assert.deepEqual(
    preview.knowledge_items.map((record) => record.id),
    ["knowledge-1"],
  );
  assert.deepEqual(
    requests.map((request) => request.url),
    [
      "/api/v1/templates/families",
      "/api/v1/prompt-skill-registry/prompt-templates",
      "/api/v1/prompt-skill-registry/skill-packages",
      "/api/v1/model-registry",
      "/api/v1/model-registry/routing-policy",
      routingGovernanceOverviewUrl,
      "/api/v1/execution-governance/profiles",
      ...agentToolingOverviewUrls,
      "/api/v1/templates/families/family-1/module-templates",
      "/api/v1/execution-governance/resolve",
    ],
  );
});

test("admin governance controller loads agent-tooling registries and recent execution logs", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createAdminGovernanceWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.url === "/api/v1/templates/families") {
        return {
          status: 200,
          body: [
            {
              id: "family-1",
              manuscript_type: "review",
              name: "Review family",
              status: "active",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/templates/families/family-1/module-templates") {
        return {
          status: 200,
          body: [] as TResponse,
        };
      }

      if (input.url === "/api/v1/prompt-skill-registry/prompt-templates") {
        return { status: 200, body: [] as TResponse };
      }

      if (input.url === "/api/v1/prompt-skill-registry/skill-packages") {
        return {
          status: 200,
          body: [
            {
              id: "skill-1",
              name: "governance_skills",
              version: "1.0.0",
              scope: "admin_only",
              status: "published",
              applies_to_modules: ["editing"],
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/model-registry") {
        return { status: 200, body: [] as TResponse };
      }

      if (input.url === "/api/v1/model-registry/routing-policy") {
        return {
          status: 200,
          body: {
            system_default_model_id: undefined,
            module_defaults: {},
            template_overrides: {},
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/execution-governance/profiles") {
        return {
          status: 200,
          body: [
            {
              id: "profile-1",
              module: "editing",
              manuscript_type: "review",
              template_family_id: "family-1",
              module_template_id: "template-1",
              prompt_template_id: "prompt-1",
              skill_package_ids: ["skill-1"],
              knowledge_binding_mode: "profile_only",
              status: "active",
              version: 1,
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/tool-gateway") {
        return {
          status: 200,
          body: [
            {
              id: "tool-1",
              name: "knowledge_search",
              scope: "knowledge",
              access_mode: "read",
              admin_only: true,
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/sandbox-profiles") {
        return {
          status: 200,
          body: [
            {
              id: "sandbox-1",
              name: "review-safe",
              status: "active",
              sandbox_mode: "workspace_write",
              network_access: true,
              approval_required: false,
              allowed_tool_ids: ["tool-1"],
              admin_only: true,
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/agent-profiles") {
        return {
          status: 200,
          body: [
            {
              id: "agent-profile-1",
              name: "Senior reviewer",
              role_key: "gstack",
              status: "published",
              module_scope: ["editing", "proofreading"],
              manuscript_types: ["review"],
              description: "Governed editor",
              admin_only: true,
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/agent-runtime") {
        return {
          status: 200,
          body: [
            {
              id: "runtime-1",
              name: "Deepagents prod",
              adapter: "deepagents",
              status: "active",
              sandbox_profile_id: "sandbox-1",
              allowed_modules: ["editing", "proofreading"],
              runtime_slot: "governed-primary",
              version: 3,
              admin_only: true,
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/tool-permission-policies") {
        return {
          status: 200,
          body: [
            {
              id: "policy-1",
              name: "review-policy",
              status: "active",
              default_mode: "read",
              allowed_tool_ids: ["tool-1"],
              high_risk_tool_ids: [],
              write_requires_confirmation: true,
              admin_only: true,
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/runtime-bindings") {
        return {
          status: 200,
          body: [
            {
              id: "binding-1",
              module: "editing",
              manuscript_type: "review",
              template_family_id: "family-1",
              runtime_id: "runtime-1",
              sandbox_profile_id: "sandbox-1",
              agent_profile_id: "agent-profile-1",
              tool_permission_policy_id: "policy-1",
              prompt_template_id: "prompt-1",
              skill_package_ids: ["skill-1"],
              execution_profile_id: "profile-1",
              status: "active",
              version: 2,
            },
          ] as TResponse,
        };
      }

      return {
        status: 200,
        body: [
          {
            id: "log-1",
            manuscript_id: "manuscript-1",
            module: "editing",
            triggered_by: "admin",
            runtime_id: "runtime-1",
            sandbox_profile_id: "sandbox-1",
            agent_profile_id: "agent-profile-1",
            runtime_binding_id: "binding-1",
            tool_permission_policy_id: "policy-1",
            execution_snapshot_id: "snapshot-1",
            knowledge_item_ids: ["knowledge-1"],
            verification_evidence_ids: ["evidence-1"],
            status: "completed",
            started_at: "2026-03-30T08:00:00.000Z",
            finished_at: "2026-03-30T08:01:00.000Z",
          },
        ] as TResponse,
      };
    },
  });

  const overview = await controller.loadOverview();

  assert.equal(overview.toolGatewayTools.length, 1);
  assert.equal(overview.sandboxProfiles[0]?.id, "sandbox-1");
  assert.equal(overview.agentProfiles[0]?.id, "agent-profile-1");
  assert.equal(overview.agentRuntimes[0]?.id, "runtime-1");
  assert.equal(overview.toolPermissionPolicies[0]?.id, "policy-1");
  assert.equal(overview.runtimeBindings[0]?.id, "binding-1");
  assert.equal(overview.agentExecutionLogs[0]?.id, "log-1");
  assert.deepEqual(
    requests.map((request) => request.url),
    [
      "/api/v1/templates/families",
      "/api/v1/prompt-skill-registry/prompt-templates",
      "/api/v1/prompt-skill-registry/skill-packages",
      "/api/v1/model-registry",
      "/api/v1/model-registry/routing-policy",
      routingGovernanceOverviewUrl,
      "/api/v1/execution-governance/profiles",
      ...agentToolingOverviewUrls,
      "/api/v1/templates/families/family-1/module-templates",
    ],
  );
});

test("admin governance controller creates and promotes agent-tooling records while reloading the overview", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const state = {
    toolGatewayTools: [] as Array<Record<string, unknown>>,
    sandboxProfiles: [] as Array<Record<string, unknown>>,
    agentProfiles: [] as Array<Record<string, unknown>>,
    agentRuntimes: [] as Array<Record<string, unknown>>,
    toolPermissionPolicies: [] as Array<Record<string, unknown>>,
    runtimeBindings: [] as Array<Record<string, unknown>>,
  };

  const controller = createAdminGovernanceWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.url === "/api/v1/templates/families") {
        return {
          status: 200,
          body: [
            {
              id: "family-1",
              manuscript_type: "review",
              name: "Review family",
              status: "active",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/templates/families/family-1/module-templates") {
        return {
          status: 200,
          body: [
            {
              id: "template-1",
              template_family_id: "family-1",
              module: "editing",
              manuscript_type: "review",
              version_no: 1,
              status: "published",
              prompt: "Editing template",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/prompt-skill-registry/prompt-templates") {
        return {
          status: 200,
          body: [
            {
              id: "prompt-1",
              name: "editing_mainline",
              version: "1.0.0",
              status: "published",
              module: "editing",
              manuscript_types: ["review"],
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/prompt-skill-registry/skill-packages") {
        return {
          status: 200,
          body: [
            {
              id: "skill-1",
              name: "editing_skills",
              version: "1.0.0",
              scope: "admin_only",
              status: "published",
              applies_to_modules: ["editing"],
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/model-registry") {
        return { status: 200, body: [] as TResponse };
      }

      if (input.url === "/api/v1/model-registry/routing-policy") {
        return {
          status: 200,
          body: {
            system_default_model_id: undefined,
            module_defaults: {},
            template_overrides: {},
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/execution-governance/profiles") {
        return {
          status: 200,
          body: [
            {
              id: "profile-1",
              module: "editing",
              manuscript_type: "review",
              template_family_id: "family-1",
              module_template_id: "template-1",
              prompt_template_id: "prompt-1",
              skill_package_ids: ["skill-1"],
              knowledge_binding_mode: "profile_plus_dynamic",
              status: "active",
              version: 1,
            },
          ] as TResponse,
        };
      }

      if (input.method === "POST" && input.url === "/api/v1/tool-gateway") {
        const createdRecord = {
          id: "tool-1",
          name: "knowledge_search",
          scope: "knowledge",
          access_mode: "read",
          admin_only: true,
        };
        state.toolGatewayTools = [createdRecord];
        return { status: 201, body: createdRecord as TResponse };
      }

      if (input.url === "/api/v1/tool-gateway") {
        return { status: 200, body: state.toolGatewayTools as TResponse };
      }

      if (input.method === "POST" && input.url === "/api/v1/sandbox-profiles") {
        const createdRecord = {
          id: "sandbox-1",
          name: "review-safe",
          status: "draft",
          sandbox_mode: "workspace_write",
          network_access: true,
          approval_required: false,
          allowed_tool_ids: ["tool-1"],
          admin_only: true,
        };
        state.sandboxProfiles = [createdRecord];
        return { status: 201, body: createdRecord as TResponse };
      }

      if (
        input.method === "POST" &&
        input.url === "/api/v1/sandbox-profiles/sandbox-1/activate"
      ) {
        state.sandboxProfiles = state.sandboxProfiles.map((record) =>
          record.id === "sandbox-1" ? { ...record, status: "active" } : record,
        );
        return { status: 200, body: state.sandboxProfiles[0] as TResponse };
      }

      if (input.url === "/api/v1/sandbox-profiles") {
        return { status: 200, body: state.sandboxProfiles as TResponse };
      }

      if (input.method === "POST" && input.url === "/api/v1/agent-profiles") {
        const createdRecord = {
          id: "agent-profile-1",
          name: "Senior reviewer",
          role_key: "gstack",
          status: "draft",
          module_scope: ["editing"],
          manuscript_types: ["review"],
          description: "Handles governed editing",
          admin_only: true,
        };
        state.agentProfiles = [createdRecord];
        return { status: 201, body: createdRecord as TResponse };
      }

      if (
        input.method === "POST" &&
        input.url === "/api/v1/agent-profiles/agent-profile-1/publish"
      ) {
        state.agentProfiles = state.agentProfiles.map((record) =>
          record.id === "agent-profile-1" ? { ...record, status: "published" } : record,
        );
        return { status: 200, body: state.agentProfiles[0] as TResponse };
      }

      if (input.url === "/api/v1/agent-profiles") {
        return { status: 200, body: state.agentProfiles as TResponse };
      }

      if (input.method === "POST" && input.url === "/api/v1/agent-runtime") {
        const createdRecord = {
          id: "runtime-1",
          name: "Deepagents primary",
          adapter: "deepagents",
          status: "draft",
          sandbox_profile_id: "sandbox-1",
          allowed_modules: ["editing"],
          runtime_slot: "primary",
          version: 1,
          admin_only: true,
        };
        state.agentRuntimes = [createdRecord];
        return { status: 201, body: createdRecord as TResponse };
      }

      if (
        input.method === "POST" &&
        input.url === "/api/v1/agent-runtime/runtime-1/publish"
      ) {
        state.agentRuntimes = state.agentRuntimes.map((record) =>
          record.id === "runtime-1" ? { ...record, status: "active", version: 2 } : record,
        );
        return { status: 200, body: state.agentRuntimes[0] as TResponse };
      }

      if (input.url === "/api/v1/agent-runtime") {
        return { status: 200, body: state.agentRuntimes as TResponse };
      }

      if (input.method === "POST" && input.url === "/api/v1/tool-permission-policies") {
        const createdRecord = {
          id: "policy-1",
          name: "review-policy",
          status: "draft",
          default_mode: "read",
          allowed_tool_ids: ["tool-1"],
          high_risk_tool_ids: [],
          write_requires_confirmation: true,
          admin_only: true,
        };
        state.toolPermissionPolicies = [createdRecord];
        return { status: 201, body: createdRecord as TResponse };
      }

      if (
        input.method === "POST" &&
        input.url === "/api/v1/tool-permission-policies/policy-1/activate"
      ) {
        state.toolPermissionPolicies = state.toolPermissionPolicies.map((record) =>
          record.id === "policy-1" ? { ...record, status: "active" } : record,
        );
        return { status: 200, body: state.toolPermissionPolicies[0] as TResponse };
      }

      if (input.url === "/api/v1/tool-permission-policies") {
        return { status: 200, body: state.toolPermissionPolicies as TResponse };
      }

      if (input.method === "POST" && input.url === "/api/v1/runtime-bindings") {
        const createdRecord = {
          id: "binding-1",
          module: "editing",
          manuscript_type: "review",
          template_family_id: "family-1",
          runtime_id: "runtime-1",
          sandbox_profile_id: "sandbox-1",
          agent_profile_id: "agent-profile-1",
          tool_permission_policy_id: "policy-1",
          prompt_template_id: "prompt-1",
          skill_package_ids: ["skill-1"],
          execution_profile_id: "profile-1",
          status: "draft",
          version: 1,
        };
        state.runtimeBindings = [createdRecord];
        return { status: 201, body: createdRecord as TResponse };
      }

      if (
        input.method === "POST" &&
        input.url === "/api/v1/runtime-bindings/binding-1/activate"
      ) {
        state.runtimeBindings = state.runtimeBindings.map((record) =>
          record.id === "binding-1" ? { ...record, status: "active", version: 2 } : record,
        );
        return { status: 200, body: state.runtimeBindings[0] as TResponse };
      }

      if (input.url === "/api/v1/runtime-bindings") {
        return { status: 200, body: state.runtimeBindings as TResponse };
      }

      return {
        status: 200,
        body: [] as TResponse,
      };
    },
  });

  const createdTool = await controller.createToolGatewayToolAndReload({
    actorRole: "admin",
    name: "knowledge_search",
    scope: "knowledge",
    accessMode: "read",
  });
  const createdSandbox = await controller.createSandboxProfileAndReload({
    actorRole: "admin",
    name: "review-safe",
    sandboxMode: "workspace_write",
    networkAccess: true,
    approvalRequired: false,
    allowedToolIds: ["tool-1"],
  });
  const activeSandboxOverview = await controller.activateSandboxProfileAndReload({
    actorRole: "admin",
    profileId: "sandbox-1",
  });
  const createdAgentProfile = await controller.createAgentProfileAndReload({
    actorRole: "admin",
    name: "Senior reviewer",
    roleKey: "gstack",
    moduleScope: ["editing"],
    manuscriptTypes: ["review"],
    description: "Handles governed editing",
  });
  const publishedAgentProfileOverview = await controller.publishAgentProfileAndReload({
    actorRole: "admin",
    profileId: "agent-profile-1",
  });
  const createdRuntime = await controller.createAgentRuntimeAndReload({
    actorRole: "admin",
    name: "Deepagents primary",
    adapter: "deepagents",
    sandboxProfileId: "sandbox-1",
    allowedModules: ["editing"],
    runtimeSlot: "primary",
  });
  const publishedRuntimeOverview = await controller.publishAgentRuntimeAndReload({
    actorRole: "admin",
    runtimeId: "runtime-1",
  });
  const createdPolicy = await controller.createToolPermissionPolicyAndReload({
    actorRole: "admin",
    name: "review-policy",
    defaultMode: "read",
    allowedToolIds: ["tool-1"],
    highRiskToolIds: [],
    writeRequiresConfirmation: true,
  });
  const activePolicyOverview = await controller.activateToolPermissionPolicyAndReload({
    actorRole: "admin",
    policyId: "policy-1",
  });
  const createdBinding = await controller.createRuntimeBindingAndReload({
    actorRole: "admin",
    module: "editing",
    manuscriptType: "review",
    templateFamilyId: "family-1",
    runtimeId: "runtime-1",
    sandboxProfileId: "sandbox-1",
    agentProfileId: "agent-profile-1",
    toolPermissionPolicyId: "policy-1",
    promptTemplateId: "prompt-1",
    skillPackageIds: ["skill-1"],
    executionProfileId: "profile-1",
  });
  const activeBindingOverview = await controller.activateRuntimeBindingAndReload({
    actorRole: "admin",
    bindingId: "binding-1",
    selectedTemplateFamilyId: "family-1",
  });

  assert.equal(createdTool.createdTool.id, "tool-1");
  assert.equal(createdSandbox.createdProfile.id, "sandbox-1");
  assert.equal(activeSandboxOverview.sandboxProfiles[0]?.status, "active");
  assert.equal(createdAgentProfile.createdProfile.id, "agent-profile-1");
  assert.equal(
    publishedAgentProfileOverview.agentProfiles[0]?.status,
    "published",
  );
  assert.equal(createdRuntime.createdRuntime.id, "runtime-1");
  assert.equal(publishedRuntimeOverview.agentRuntimes[0]?.status, "active");
  assert.equal(createdPolicy.createdPolicy.id, "policy-1");
  assert.equal(activePolicyOverview.toolPermissionPolicies[0]?.status, "active");
  assert.equal(createdBinding.createdBinding.id, "binding-1");
  assert.equal(activeBindingOverview.runtimeBindings[0]?.status, "active");
  assert.deepEqual(
    requests
      .filter((request) => request.method === "POST")
      .map((request) => request.url),
    [
      "/api/v1/tool-gateway",
      "/api/v1/sandbox-profiles",
      "/api/v1/sandbox-profiles/sandbox-1/activate",
      "/api/v1/agent-profiles",
      "/api/v1/agent-profiles/agent-profile-1/publish",
      "/api/v1/agent-runtime",
      "/api/v1/agent-runtime/runtime-1/publish",
      "/api/v1/tool-permission-policies",
      "/api/v1/tool-permission-policies/policy-1/activate",
      "/api/v1/runtime-bindings",
      "/api/v1/runtime-bindings/binding-1/activate",
    ],
  );
});

test("admin governance controller loads execution evidence with snapshot and knowledge hit details", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createAdminGovernanceWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.url === "/api/v1/agent-execution/log-1") {
        return {
          status: 200,
          body: {
            id: "log-1",
            manuscript_id: "manuscript-1",
            module: "editing",
            triggered_by: "dev.admin",
            runtime_id: "runtime-1",
            sandbox_profile_id: "sandbox-1",
            agent_profile_id: "agent-profile-1",
            runtime_binding_id: "binding-1",
            tool_permission_policy_id: "policy-1",
            execution_snapshot_id: "snapshot-1",
            knowledge_item_ids: ["knowledge-1", "knowledge-2"],
            verification_evidence_ids: ["evidence-1", "evidence-missing"],
            status: "completed",
            started_at: "2026-03-31T08:00:00.000Z",
            finished_at: "2026-03-31T08:01:00.000Z",
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/manuscripts/manuscript-1") {
        return {
          status: 200,
          body: {
            id: "manuscript-1",
            title: "Evidence inspection manuscript",
            manuscript_type: "review",
            status: "completed",
            created_by: "dev.admin",
            current_editing_asset_id: "asset-1",
            current_template_family_id: "family-1",
            created_at: "2026-03-31T07:45:00.000Z",
            updated_at: "2026-03-31T08:01:00.000Z",
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/manuscripts/manuscript-1/assets") {
        return {
          status: 200,
          body: [
            {
              id: "asset-1",
              manuscript_id: "manuscript-1",
              asset_type: "edited_docx",
              status: "active",
              storage_key: "runs/manuscript-1/editing/final.docx",
              mime_type:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              parent_asset_id: "asset-source-1",
              source_module: "editing",
              source_job_id: "job-1",
              created_by: "dev.admin",
              version_no: 2,
              is_current: true,
              file_name: "editing-final.docx",
              created_at: "2026-03-31T08:00:45.000Z",
              updated_at: "2026-03-31T08:01:00.000Z",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/execution-tracking/snapshots/snapshot-1") {
        return {
          status: 200,
          body: {
            id: "snapshot-1",
            manuscript_id: "manuscript-1",
            module: "editing",
            job_id: "job-1",
            execution_profile_id: "profile-1",
            module_template_id: "template-1",
            module_template_version_no: 3,
            prompt_template_id: "prompt-1",
            prompt_template_version: "1.2.0",
            skill_package_ids: ["skill-1"],
            skill_package_versions: ["1.0.0"],
            model_id: "model-1",
            model_version: "2026-03-01",
            knowledge_item_ids: ["knowledge-1", "knowledge-2"],
            created_asset_ids: ["asset-1"],
            created_at: "2026-03-31T08:00:30.000Z",
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/jobs/job-1") {
        return {
          status: 200,
          body: {
            id: "job-1",
            manuscript_id: "manuscript-1",
            module: "editing",
            job_type: "governed_execution",
            status: "completed",
            requested_by: "dev.admin",
            attempt_count: 1,
            started_at: "2026-03-31T08:00:00.000Z",
            finished_at: "2026-03-31T08:01:00.000Z",
            created_at: "2026-03-31T08:00:00.000Z",
            updated_at: "2026-03-31T08:01:00.000Z",
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evidence/evidence-1") {
        return {
          status: 200,
          body: {
            id: "evidence-1",
            kind: "url",
            label: "Editing browser QA",
            uri: "https://example.test/evidence/editing-browser-qa",
            created_at: "2026-03-31T08:00:50.000Z",
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evidence/evidence-missing") {
        throw new Error("not found");
      }

      return {
        status: 200,
        body: [
          {
            id: "hit-1",
            snapshot_id: "snapshot-1",
            knowledge_item_id: "knowledge-1",
            binding_rule_id: "rule-1",
            match_source: "binding_rule",
            match_reasons: ["Required by editing profile"],
            created_at: "2026-03-31T08:00:30.000Z",
          },
          {
            id: "hit-2",
            snapshot_id: "snapshot-1",
            knowledge_item_id: "knowledge-2",
            match_source_id: "knowledge-2",
            match_source: "dynamic_routing",
            match_reasons: ["Matched discussion terminology"],
            section: "discussion",
            created_at: "2026-03-31T08:00:30.000Z",
          },
        ] as TResponse,
      };
    },
  });

  const evidence = await controller.loadExecutionEvidence("log-1");

  assert.equal(evidence.log.id, "log-1");
  assert.equal(evidence.manuscript?.title, "Evidence inspection manuscript");
  assert.equal(evidence.job?.id, "job-1");
  assert.equal(evidence.snapshot?.id, "snapshot-1");
  assert.deepEqual(
    evidence.createdAssets.map((asset) => asset.id),
    ["asset-1"],
  );
  assert.deepEqual(
    evidence.knowledgeHitLogs.map((record) => ({
      id: record.id,
      source: record.match_source,
    })),
    [
      {
        id: "hit-1",
        source: "binding_rule",
      },
      {
        id: "hit-2",
        source: "dynamic_routing",
      },
    ],
  );
  assert.deepEqual(
    evidence.verificationEvidence.map((record) => ({
      id: record.id,
      label: record.label,
      kind: record.kind,
    })),
    [
      {
        id: "evidence-1",
        label: "Editing browser QA",
        kind: "url",
      },
    ],
  );
  assert.deepEqual(evidence.unresolvedVerificationEvidenceIds, ["evidence-missing"]);
  assert.deepEqual(
    requests.map((request) => request.url),
    [
      "/api/v1/agent-execution/log-1",
      "/api/v1/manuscripts/manuscript-1",
      "/api/v1/manuscripts/manuscript-1/assets",
      "/api/v1/verification-ops/evidence/evidence-1",
      "/api/v1/verification-ops/evidence/evidence-missing",
      "/api/v1/execution-tracking/snapshots/snapshot-1",
      "/api/v1/execution-tracking/snapshots/snapshot-1/knowledge-hit-logs",
      "/api/v1/jobs/job-1",
    ],
  );
});

test("admin governance controller joins manuscript, job, and created asset outputs into execution evidence", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createAdminGovernanceWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.url === "/api/v1/agent-execution/log-output-1") {
        return {
          status: 200,
          body: {
            id: "log-output-1",
            manuscript_id: "manuscript-9",
            module: "editing",
            triggered_by: "dev.admin",
            runtime_id: "runtime-1",
            sandbox_profile_id: "sandbox-1",
            agent_profile_id: "agent-profile-1",
            runtime_binding_id: "binding-1",
            tool_permission_policy_id: "policy-1",
            execution_snapshot_id: "snapshot-output-1",
            knowledge_item_ids: ["knowledge-1"],
            verification_evidence_ids: ["evidence-1"],
            status: "completed",
            started_at: "2026-04-02T08:00:00.000Z",
            finished_at: "2026-04-02T08:01:00.000Z",
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/manuscripts/manuscript-9") {
        return {
          status: 200,
          body: {
            id: "manuscript-9",
            title: "Governed editing output manuscript",
            manuscript_type: "clinical_study",
            status: "completed",
            created_by: "dev.admin",
            current_editing_asset_id: "asset-edited-1",
            current_template_family_id: "family-1",
            created_at: "2026-04-02T07:30:00.000Z",
            updated_at: "2026-04-02T08:01:00.000Z",
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/manuscripts/manuscript-9/assets") {
        return {
          status: 200,
          body: [
            {
              id: "asset-original-1",
              manuscript_id: "manuscript-9",
              asset_type: "original",
              status: "active",
              storage_key: "uploads/manuscript-9/source.docx",
              mime_type:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              source_module: "upload",
              created_by: "dev.admin",
              version_no: 1,
              is_current: false,
              file_name: "source.docx",
              created_at: "2026-04-02T07:30:00.000Z",
              updated_at: "2026-04-02T07:30:00.000Z",
            },
            {
              id: "asset-edited-1",
              manuscript_id: "manuscript-9",
              asset_type: "edited_docx",
              status: "active",
              storage_key: "runs/manuscript-9/editing/final.docx",
              mime_type:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              parent_asset_id: "asset-original-1",
              source_module: "editing",
              source_job_id: "job-output-1",
              created_by: "dev.admin",
              version_no: 2,
              is_current: true,
              file_name: "editing-final.docx",
              created_at: "2026-04-02T08:00:45.000Z",
              updated_at: "2026-04-02T08:01:00.000Z",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/execution-tracking/snapshots/snapshot-output-1") {
        return {
          status: 200,
          body: {
            id: "snapshot-output-1",
            manuscript_id: "manuscript-9",
            module: "editing",
            job_id: "job-output-1",
            execution_profile_id: "profile-1",
            module_template_id: "template-1",
            module_template_version_no: 3,
            prompt_template_id: "prompt-1",
            prompt_template_version: "1.2.0",
            skill_package_ids: ["skill-1"],
            skill_package_versions: ["1.0.0"],
            model_id: "model-1",
            model_version: "2026-03-01",
            knowledge_item_ids: ["knowledge-1"],
            created_asset_ids: ["asset-edited-1"],
            created_at: "2026-04-02T08:00:30.000Z",
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/jobs/job-output-1") {
        return {
          status: 200,
          body: {
            id: "job-output-1",
            manuscript_id: "manuscript-9",
            module: "editing",
            job_type: "governed_execution",
            status: "completed",
            requested_by: "dev.admin",
            attempt_count: 1,
            started_at: "2026-04-02T08:00:00.000Z",
            finished_at: "2026-04-02T08:01:00.000Z",
            created_at: "2026-04-02T08:00:00.000Z",
            updated_at: "2026-04-02T08:01:00.000Z",
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/execution-tracking/snapshots/snapshot-output-1/knowledge-hit-logs") {
        return {
          status: 200,
          body: [
            {
              id: "hit-output-1",
              snapshot_id: "snapshot-output-1",
              knowledge_item_id: "knowledge-1",
              match_source: "binding_rule",
              binding_rule_id: "rule-1",
              match_reasons: ["Bound by editing family"],
              created_at: "2026-04-02T08:00:30.000Z",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/verification-ops/evidence/evidence-1") {
        return {
          status: 200,
          body: {
            id: "evidence-1",
            kind: "artifact",
            label: "Editing final QA checklist",
            artifact_asset_id: "asset-edited-1",
            created_at: "2026-04-02T08:00:50.000Z",
          } as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const evidence = await controller.loadExecutionEvidence("log-output-1");

  assert.equal(evidence.manuscript?.title, "Governed editing output manuscript");
  assert.equal(evidence.job?.id, "job-output-1");
  assert.deepEqual(
    evidence.createdAssets.map((asset) => ({
      id: asset.id,
      assetType: asset.asset_type,
      isCurrent: asset.is_current,
    })),
    [
      {
        id: "asset-edited-1",
        assetType: "edited_docx",
        isCurrent: true,
      },
    ],
  );
  assert.deepEqual(
    evidence.verificationEvidence.map((record) => ({
      id: record.id,
      kind: record.kind,
      artifactAssetId: record.artifact_asset_id,
    })),
    [
      {
        id: "evidence-1",
        kind: "artifact",
        artifactAssetId: "asset-edited-1",
      },
    ],
  );
  assert.deepEqual(evidence.unresolvedVerificationEvidenceIds, []);
  assert.deepEqual(
    requests.map((request) => request.url),
    [
      "/api/v1/agent-execution/log-output-1",
      "/api/v1/manuscripts/manuscript-9",
      "/api/v1/manuscripts/manuscript-9/assets",
      "/api/v1/verification-ops/evidence/evidence-1",
      "/api/v1/execution-tracking/snapshots/snapshot-output-1",
      "/api/v1/execution-tracking/snapshots/snapshot-output-1/knowledge-hit-logs",
      "/api/v1/jobs/job-output-1",
    ],
  );
});

test("admin governance controller returns log-only execution evidence when a snapshot is not available yet", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createAdminGovernanceWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);
      if (input.url === "/api/v1/manuscripts/manuscript-2") {
        return {
          status: 200,
          body: {
            id: "manuscript-2",
            title: "Running execution manuscript",
            manuscript_type: "clinical_study",
            status: "processing",
            created_by: "dev.admin",
            created_at: "2026-03-31T08:55:00.000Z",
            updated_at: "2026-03-31T09:00:00.000Z",
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/manuscripts/manuscript-2/assets") {
        return {
          status: 200,
          body: [] as TResponse,
        };
      }

      return {
        status: 200,
        body: {
          id: "log-running-1",
          manuscript_id: "manuscript-2",
          module: "screening",
          triggered_by: "dev.admin",
          runtime_id: "runtime-1",
          sandbox_profile_id: "sandbox-1",
          agent_profile_id: "agent-profile-1",
          runtime_binding_id: "binding-1",
          tool_permission_policy_id: "policy-1",
          knowledge_item_ids: [],
          verification_evidence_ids: [],
          status: "running",
          started_at: "2026-03-31T09:00:00.000Z",
        } as TResponse,
      };
    },
  });

  const evidence = await controller.loadExecutionEvidence("log-running-1");

  assert.equal(evidence.log.status, "running");
  assert.equal(evidence.manuscript?.title, "Running execution manuscript");
  assert.equal(evidence.job, null);
  assert.deepEqual(evidence.createdAssets, []);
  assert.equal(evidence.snapshot, null);
  assert.deepEqual(evidence.knowledgeHitLogs, []);
  assert.deepEqual(
    requests.map((request) => request.url),
    [
      "/api/v1/agent-execution/log-running-1",
      "/api/v1/manuscripts/manuscript-2",
      "/api/v1/manuscripts/manuscript-2/assets",
    ],
  );
});

function createEmptyAgentToolingListResponse<TResponse>(url: string) {
  if (url === routingGovernanceOverviewUrl) {
    return {
      status: 200,
      body: [] as TResponse,
    };
  }

  if (agentToolingOverviewUrls.includes(url as (typeof agentToolingOverviewUrls)[number])) {
    return {
      status: 200,
      body: [] as TResponse,
    };
  }

  return null;
}
