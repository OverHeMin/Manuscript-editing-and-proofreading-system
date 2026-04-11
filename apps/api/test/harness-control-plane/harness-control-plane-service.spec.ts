import test from "node:test";
import assert from "node:assert/strict";
import {
  HarnessControlPlaneService,
  type ResolveHarnessEnvironmentPreviewInput,
} from "../../src/modules/harness-control-plane/index.ts";
import type { ModuleExecutionProfileRecord } from "../../src/modules/execution-governance/index.ts";
import type { ManualReviewPolicyRecord } from "../../src/modules/manual-review-policies/index.ts";
import type {
  ModelRoutingPolicyRecord,
} from "../../src/modules/model-routing-governance/index.ts";
import type { RetrievalPresetRecord } from "../../src/modules/retrieval-presets/index.ts";
import type { RuntimeBindingRecord } from "../../src/modules/runtime-bindings/index.ts";

function createHarnessControlPlaneServiceHarness() {
  const scope = {
    module: "editing",
    manuscriptType: "clinical_study",
    templateFamilyId: "family-1",
  } satisfies ResolveHarnessEnvironmentPreviewInput;

  const profiles: ModuleExecutionProfileRecord[] = [
    {
      id: "profile-active-1",
      module: "editing",
      manuscript_type: "clinical_study",
      template_family_id: "family-1",
      module_template_id: "template-active-1",
      prompt_template_id: "prompt-active-1",
      skill_package_ids: ["skill-active-1"],
      knowledge_binding_mode: "profile_plus_dynamic",
      status: "active",
      version: 1,
    },
    {
      id: "profile-draft-2",
      module: "editing",
      manuscript_type: "clinical_study",
      template_family_id: "family-1",
      module_template_id: "template-draft-2",
      prompt_template_id: "prompt-draft-2",
      skill_package_ids: ["skill-draft-2"],
      knowledge_binding_mode: "profile_plus_dynamic",
      status: "draft",
      version: 2,
    },
  ];
  const bindings: RuntimeBindingRecord[] = [
    {
      id: "binding-active-1",
      module: "editing",
      manuscript_type: "clinical_study",
      template_family_id: "family-1",
      runtime_id: "runtime-active-1",
      sandbox_profile_id: "sandbox-active-1",
      agent_profile_id: "agent-active-1",
      tool_permission_policy_id: "tool-policy-active-1",
      prompt_template_id: "prompt-active-1",
      skill_package_ids: ["skill-active-1"],
      execution_profile_id: "profile-active-1",
      verification_check_profile_ids: ["check-profile-1"],
      evaluation_suite_ids: ["suite-1"],
      release_check_profile_id: "release-profile-1",
      status: "active",
      version: 1,
    },
    {
      id: "binding-draft-2",
      module: "editing",
      manuscript_type: "clinical_study",
      template_family_id: "family-1",
      runtime_id: "runtime-draft-2",
      sandbox_profile_id: "sandbox-draft-2",
      agent_profile_id: "agent-draft-2",
      tool_permission_policy_id: "tool-policy-draft-2",
      prompt_template_id: "prompt-draft-2",
      skill_package_ids: ["skill-draft-2"],
      execution_profile_id: "profile-draft-2",
      verification_check_profile_ids: ["check-profile-2"],
      evaluation_suite_ids: ["suite-2"],
      release_check_profile_id: "release-profile-2",
      status: "draft",
      version: 2,
    },
  ];
  const policyRecord: ModelRoutingPolicyRecord = {
    policy_id: "routing-policy-1",
    scope_kind: "template_family",
    scope_value: "family-1",
    active_version: {
      id: "routing-version-active-1",
      policy_scope_id: "routing-policy-1",
      scope_kind: "template_family",
      scope_value: "family-1",
      version_no: 1,
      primary_model_id: "model-active-1",
      fallback_model_ids: ["model-fallback-1"],
      evidence_links: [{ kind: "evaluation_run", id: "run-1" }],
      status: "active",
      created_at: "2026-04-10T08:00:00.000Z",
      updated_at: "2026-04-10T08:00:00.000Z",
    },
    versions: [
      {
        id: "routing-version-active-1",
        policy_scope_id: "routing-policy-1",
        scope_kind: "template_family",
        scope_value: "family-1",
        version_no: 1,
        primary_model_id: "model-active-1",
        fallback_model_ids: ["model-fallback-1"],
        evidence_links: [{ kind: "evaluation_run", id: "run-1" }],
        status: "active",
        created_at: "2026-04-10T08:00:00.000Z",
        updated_at: "2026-04-10T08:00:00.000Z",
      },
      {
        id: "routing-version-draft-2",
        policy_scope_id: "routing-policy-1",
        scope_kind: "template_family",
        scope_value: "family-1",
        version_no: 2,
        primary_model_id: "model-draft-2",
        fallback_model_ids: ["model-fallback-2"],
        evidence_links: [{ kind: "evaluation_run", id: "run-2" }],
        status: "approved",
        created_at: "2026-04-10T08:30:00.000Z",
        updated_at: "2026-04-10T08:30:00.000Z",
      },
    ],
    decisions: [],
  };
  const retrievalPresets: RetrievalPresetRecord[] = [
    {
      id: "retrieval-active-1",
      module: "editing",
      manuscript_type: "clinical_study",
      template_family_id: "family-1",
      name: "Active retrieval",
      top_k: 6,
      section_filters: ["discussion"],
      risk_tag_filters: ["grounding"],
      rerank_enabled: true,
      citation_required: true,
      min_retrieval_score: 0.55,
      status: "active",
      version: 1,
    },
    {
      id: "retrieval-draft-2",
      module: "editing",
      manuscript_type: "clinical_study",
      template_family_id: "family-1",
      name: "Draft retrieval",
      top_k: 10,
      section_filters: ["methods"],
      risk_tag_filters: ["coverage"],
      rerank_enabled: false,
      citation_required: false,
      min_retrieval_score: 0.4,
      status: "draft",
      version: 2,
    },
  ];
  const manualReviewPolicies: ManualReviewPolicyRecord[] = [
    {
      id: "manual-review-active-1",
      module: "editing",
      manuscript_type: "clinical_study",
      template_family_id: "family-1",
      name: "Active review policy",
      min_confidence_threshold: 0.8,
      high_risk_force_review: true,
      conflict_force_review: true,
      insufficient_knowledge_force_review: true,
      module_blocklist_rules: ["unsafe-claim"],
      status: "active",
      version: 1,
    },
    {
      id: "manual-review-draft-2",
      module: "editing",
      manuscript_type: "clinical_study",
      template_family_id: "family-1",
      name: "Draft review policy",
      min_confidence_threshold: 0.7,
      high_risk_force_review: false,
      conflict_force_review: true,
      insufficient_knowledge_force_review: false,
      module_blocklist_rules: ["statistical-overreach"],
      status: "draft",
      version: 2,
    },
  ];

  const activeIds = {
    executionProfileId: "profile-active-1",
    runtimeBindingId: "binding-active-1",
    modelRoutingPolicyVersionId: "routing-version-active-1",
    retrievalPresetId: "retrieval-active-1",
    manualReviewPolicyId: "manual-review-active-1",
  };

  const requireProfile = (profileId: string) => {
    const match = profiles.find((record) => record.id === profileId);
    assert.ok(match, `Expected execution profile ${profileId} to exist.`);
    return match;
  };
  const requireBinding = (bindingId: string) => {
    const match = bindings.find((record) => record.id === bindingId);
    assert.ok(match, `Expected runtime binding ${bindingId} to exist.`);
    return match;
  };
  const requireRoutingVersion = (versionId: string) => {
    const match = policyRecord.versions.find((record) => record.id === versionId);
    assert.ok(match, `Expected routing version ${versionId} to exist.`);
    return match;
  };
  const requireRetrievalPreset = (presetId: string) => {
    const match = retrievalPresets.find((record) => record.id === presetId);
    assert.ok(match, `Expected retrieval preset ${presetId} to exist.`);
    return match;
  };
  const requireManualReviewPolicy = (policyId: string) => {
    const match = manualReviewPolicies.find((record) => record.id === policyId);
    assert.ok(match, `Expected manual review policy ${policyId} to exist.`);
    return match;
  };

  const service = new HarnessControlPlaneService({
    executionGovernanceService: {
      resolveActiveProfile: async () => requireProfile(activeIds.executionProfileId),
      listProfiles: async () => profiles.map((record) => ({ ...record })),
      publishProfile: async (profileId: string) => {
        activeIds.executionProfileId = profileId;
        return requireProfile(profileId);
      },
    },
    runtimeBindingService: {
      getActiveBindingForScope: async () => requireBinding(activeIds.runtimeBindingId),
      listBindingsForScope: async () => bindings.map((record) => ({ ...record })),
      getBinding: async (bindingId: string) => requireBinding(bindingId),
      activateBinding: async (bindingId: string) => {
        activeIds.runtimeBindingId = bindingId;
        return requireBinding(bindingId);
      },
    },
    modelRoutingGovernanceService: {
      findActivePolicy: async () => ({
        ...policyRecord,
        active_version: requireRoutingVersion(activeIds.modelRoutingPolicyVersionId),
      }),
      listPolicies: async () => [
        {
          ...policyRecord,
          active_version: requireRoutingVersion(activeIds.modelRoutingPolicyVersionId),
          versions: policyRecord.versions.map((record) => ({ ...record })),
        },
      ],
      activateVersion: async (versionId: string) => {
        activeIds.modelRoutingPolicyVersionId = versionId;
        return {
          policy_id: policyRecord.policy_id,
          scope: {
            id: policyRecord.policy_id,
            scope_kind: "template_family",
            scope_value: "family-1",
            active_version_id: versionId,
            created_at: "2026-04-10T08:00:00.000Z",
            updated_at: "2026-04-10T08:45:00.000Z",
          },
          version: requireRoutingVersion(versionId),
        };
      },
    },
    retrievalPresetService: {
      getActivePresetForScope: async () =>
        requireRetrievalPreset(activeIds.retrievalPresetId),
      listPresetsForScope: async () =>
        retrievalPresets.map((record) => ({ ...record })),
      getPreset: async (presetId: string) => requireRetrievalPreset(presetId),
      activatePreset: async (presetId: string) => {
        activeIds.retrievalPresetId = presetId;
        return requireRetrievalPreset(presetId);
      },
    },
    manualReviewPolicyService: {
      getActivePolicyForScope: async () =>
        requireManualReviewPolicy(activeIds.manualReviewPolicyId),
      listPoliciesForScope: async () =>
        manualReviewPolicies.map((record) => ({ ...record })),
      getPolicy: async (policyId: string) => requireManualReviewPolicy(policyId),
      activatePolicy: async (policyId: string) => {
        activeIds.manualReviewPolicyId = policyId;
        return requireManualReviewPolicy(policyId);
      },
    },
  });

  return {
    scope,
    service,
  };
}

test("harness control plane reads the active five-part environment for one scope", async () => {
  const { service, scope } = createHarnessControlPlaneServiceHarness();

  const activeEnvironment = await service.getActiveEnvironment(scope);

  assert.equal(activeEnvironment.execution_profile.id, "profile-active-1");
  assert.equal(activeEnvironment.runtime_binding.id, "binding-active-1");
  assert.equal(
    activeEnvironment.model_routing_policy_version.id,
    "routing-version-active-1",
  );
  assert.equal(activeEnvironment.retrieval_preset.id, "retrieval-active-1");
  assert.equal(
    activeEnvironment.manual_review_policy.id,
    "manual-review-active-1",
  );
});

test("harness control plane previews explicit override ids and diffs them against active state", async () => {
  const { service, scope } = createHarnessControlPlaneServiceHarness();

  const preview = await service.previewEnvironment({
    ...scope,
    executionProfileId: "profile-draft-2",
    runtimeBindingId: "binding-draft-2",
    modelRoutingPolicyVersionId: "routing-version-draft-2",
    retrievalPresetId: "retrieval-draft-2",
    manualReviewPolicyId: "manual-review-draft-2",
  });

  assert.equal(preview.active_environment.execution_profile.id, "profile-active-1");
  assert.equal(preview.candidate_environment.execution_profile.id, "profile-draft-2");
  assert.equal(preview.active_environment.runtime_binding.id, "binding-active-1");
  assert.equal(preview.candidate_environment.runtime_binding.id, "binding-draft-2");
  assert.equal(
    preview.candidate_environment.model_routing_policy_version.id,
    "routing-version-draft-2",
  );
  assert.equal(
    preview.candidate_environment.retrieval_preset.id,
    "retrieval-draft-2",
  );
  assert.equal(
    preview.candidate_environment.manual_review_policy.id,
    "manual-review-draft-2",
  );
  assert.deepEqual(preview.diff.changed_components, [
    "execution_profile",
    "runtime_binding",
    "model_routing_policy_version",
    "retrieval_preset",
    "manual_review_policy",
  ]);
});

test("harness control plane activates a candidate bundle and rolls back the same scope only", async () => {
  const { service, scope } = createHarnessControlPlaneServiceHarness();

  const activated = await service.activateEnvironment("admin", {
    ...scope,
    executionProfileId: "profile-draft-2",
    runtimeBindingId: "binding-draft-2",
    modelRoutingPolicyVersionId: "routing-version-draft-2",
    retrievalPresetId: "retrieval-draft-2",
    manualReviewPolicyId: "manual-review-draft-2",
    reason: "Harness candidate outperformed the active environment.",
  });

  assert.equal(activated.execution_profile.id, "profile-draft-2");
  assert.equal(activated.runtime_binding.id, "binding-draft-2");
  assert.equal(activated.model_routing_policy_version.id, "routing-version-draft-2");
  assert.equal(activated.retrieval_preset.id, "retrieval-draft-2");
  assert.equal(activated.manual_review_policy.id, "manual-review-draft-2");

  const rolledBack = await service.rollbackEnvironment("admin", {
    ...scope,
    reason: "Harness rollback after candidate regression.",
  });

  assert.equal(rolledBack.execution_profile.id, "profile-active-1");
  assert.equal(rolledBack.runtime_binding.id, "binding-active-1");
  assert.equal(
    rolledBack.model_routing_policy_version.id,
    "routing-version-active-1",
  );
  assert.equal(rolledBack.retrieval_preset.id, "retrieval-active-1");
  assert.equal(
    rolledBack.manual_review_policy.id,
    "manual-review-active-1",
  );
});
