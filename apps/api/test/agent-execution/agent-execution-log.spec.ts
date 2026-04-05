import test from "node:test";
import assert from "node:assert/strict";
import { createAgentExecutionApi } from "../../src/modules/agent-execution/agent-execution-api.ts";
import { InMemoryAgentExecutionRepository } from "../../src/modules/agent-execution/in-memory-agent-execution-repository.ts";
import {
  AgentExecutionService,
  type CreateAgentExecutionLogInput,
} from "../../src/modules/agent-execution/agent-execution-service.ts";
import type { RuntimeBindingReadinessReport } from "../../src/modules/runtime-bindings/runtime-binding-readiness.ts";

function createAgentExecutionHarness(input?: {
  runtimeBindingReadinessService?: {
    getBindingReadiness: (bindingId: string) => Promise<RuntimeBindingReadinessReport>;
  };
}) {
  const ids = ["execution-log-1", "execution-log-2"];
  const service = new AgentExecutionService({
    repository: new InMemoryAgentExecutionRepository(),
    createId: () => {
      const value = ids.shift();
      assert.ok(value, "Expected an agent execution log id to be available.");
      return value;
    },
    now: () => new Date("2026-03-28T13:00:00.000Z"),
  });
  const api = createAgentExecutionApi({
    agentExecutionService: service,
    runtimeBindingReadinessService: input?.runtimeBindingReadinessService,
  });

  return {
    api,
    service,
  };
}

test("agent execution logs capture governed runtime metadata and can be completed with snapshot evidence", async () => {
  const readinessReport: RuntimeBindingReadinessReport = {
    status: "ready",
    scope: {
      module: "editing",
      manuscriptType: "clinical_study",
      templateFamilyId: "family-1",
    },
    binding: {
      id: "binding-1",
      status: "active",
      version: 1,
      runtime_id: "runtime-1",
      sandbox_profile_id: "sandbox-1",
      agent_profile_id: "agent-profile-1",
      tool_permission_policy_id: "policy-1",
      prompt_template_id: "prompt-editing-1",
      skill_package_ids: ["skill-editing-1"],
      execution_profile_id: "profile-1",
      verification_check_profile_ids: ["check-profile-1"],
      evaluation_suite_ids: ["suite-1"],
      release_check_profile_id: "release-profile-1",
    },
    issues: [],
    execution_profile_alignment: {
      status: "aligned",
      binding_execution_profile_id: "profile-1",
      active_execution_profile_id: "profile-1",
    },
  };
  const { api } = createAgentExecutionHarness({
    runtimeBindingReadinessService: {
      async getBindingReadiness(bindingId) {
        assert.equal(bindingId, "binding-1");
        return readinessReport;
      },
    },
  });
  const input: CreateAgentExecutionLogInput = {
    manuscriptId: "manuscript-1",
    module: "editing",
    triggeredBy: "editor-1",
    runtimeId: "runtime-1",
    sandboxProfileId: "sandbox-1",
    agentProfileId: "agent-profile-1",
    runtimeBindingId: "binding-1",
    toolPermissionPolicyId: "policy-1",
    knowledgeItemIds: ["knowledge-editing-1"],
    verificationCheckProfileIds: ["check-profile-1"],
    evaluationSuiteIds: ["suite-1"],
    releaseCheckProfileId: "release-profile-1",
    routingPolicyVersionId: "policy-version-2",
    routingPolicyScopeKind: "template_family",
    routingPolicyScopeValue: "family-1",
    resolvedModelId: "model-primary-1",
  };

  const created = await api.createLog({
    input,
  });

  assert.equal(created.status, 201);
  assert.equal(created.body.status, "running");
  assert.equal(created.body.runtime_id, "runtime-1");
  assert.equal(created.body.agent_profile_id, "agent-profile-1");
  assert.equal(created.body.runtime_binding_id, "binding-1");
  assert.equal(created.body.tool_permission_policy_id, "policy-1");
  assert.deepEqual(created.body.verification_check_profile_ids, [
    "check-profile-1",
  ]);
  assert.deepEqual(created.body.evaluation_suite_ids, ["suite-1"]);
  assert.equal(created.body.release_check_profile_id, "release-profile-1");
  assert.equal(created.body.routing_policy_version_id, "policy-version-2");
  assert.equal(created.body.routing_policy_scope_kind, "template_family");
  assert.equal(created.body.routing_policy_scope_value, "family-1");
  assert.equal(created.body.resolved_model_id, "model-primary-1");
  assert.equal(created.body.fallback_model_id, undefined);
  assert.equal(created.body.fallback_trigger, undefined);
  assert.equal(created.body.orchestration_status, "pending");
  assert.equal(created.body.orchestration_attempt_count, 0);
  assert.equal(created.body.orchestration_max_attempts, 3);
  assert.equal(created.body.orchestration_last_error, undefined);
  assert.equal(created.body.orchestration_last_attempt_started_at, undefined);
  assert.equal(created.body.orchestration_last_attempt_finished_at, undefined);
  assert.equal(created.body.orchestration_attempt_claim_token, undefined);
  assert.equal(created.body.orchestration_next_retry_at, undefined);
  assert.deepEqual(created.body.verification_evidence_ids, []);
  assert.equal(created.body.runtime_binding_readiness.observation_status, "reported");
  assert.deepEqual(created.body.runtime_binding_readiness.report, readinessReport);

  const completed = await api.completeLog({
    logId: created.body.id,
    executionSnapshotId: "snapshot-1",
    verificationEvidenceIds: ["evidence-1", "evidence-2"],
  });

  assert.equal(completed.status, 200);
  assert.equal(completed.body.status, "completed");
  assert.equal(completed.body.execution_snapshot_id, "snapshot-1");
  assert.equal(completed.body.orchestration_status, "pending");
  assert.equal(completed.body.orchestration_attempt_count, 0);
  assert.equal(completed.body.orchestration_max_attempts, 3);
  assert.equal(completed.body.orchestration_attempt_claim_token, undefined);
  assert.equal(completed.body.orchestration_next_retry_at, undefined);
  assert.deepEqual(completed.body.verification_evidence_ids, [
    "evidence-1",
    "evidence-2",
  ]);
  assert.equal(completed.body.finished_at, "2026-03-28T13:00:00.000Z");
  assert.equal(
    completed.body.runtime_binding_readiness.observation_status,
    "reported",
  );
  assert.deepEqual(completed.body.runtime_binding_readiness.report, readinessReport);
});

test("agent execution logs can append governed verification evidence after completion", async () => {
  const readinessReport: RuntimeBindingReadinessReport = {
    status: "degraded",
    scope: {
      module: "screening",
      manuscriptType: "clinical_study",
      templateFamilyId: "family-1",
    },
    binding: {
      id: "binding-1",
      status: "active",
      version: 1,
      runtime_id: "runtime-1",
      sandbox_profile_id: "sandbox-1",
      agent_profile_id: "agent-profile-1",
      tool_permission_policy_id: "policy-1",
      prompt_template_id: "prompt-screening-1",
      skill_package_ids: [],
      execution_profile_id: "profile-1",
      verification_check_profile_ids: [],
      evaluation_suite_ids: [],
      release_check_profile_id: undefined,
    },
    issues: [
      {
        code: "runtime_not_active",
        message: "Runtime runtime-1 is not active.",
      },
    ],
    execution_profile_alignment: {
      status: "aligned",
      binding_execution_profile_id: "profile-1",
      active_execution_profile_id: "profile-1",
    },
  };
  const { service, api } = createAgentExecutionHarness({
    runtimeBindingReadinessService: {
      async getBindingReadiness(bindingId) {
        assert.equal(bindingId, "binding-1");
        return readinessReport;
      },
    },
  });

  const created = await service.createLog({
    manuscriptId: "manuscript-1",
    module: "screening",
    triggeredBy: "tester-1",
    runtimeId: "runtime-1",
    sandboxProfileId: "sandbox-1",
    agentProfileId: "agent-profile-1",
    runtimeBindingId: "binding-1",
    toolPermissionPolicyId: "policy-1",
    knowledgeItemIds: [],
    routingPolicyVersionId: "policy-version-3",
    routingPolicyScopeKind: "module",
    routingPolicyScopeValue: "screening",
    resolvedModelId: "model-primary-2",
    fallbackModelId: "model-fallback-2",
    fallbackTrigger: "rate_limit",
  });

  await service.completeLog({
    logId: created.id,
    executionSnapshotId: "snapshot-1",
    verificationEvidenceIds: ["evidence-seed-1"],
  });

  const updated = await service.appendVerificationEvidence({
    logId: created.id,
    evidenceIds: [
      "evidence-seed-1",
      "evidence-machine-1",
      "evidence-machine-2",
    ],
  });

  assert.deepEqual(updated.verification_evidence_ids, [
    "evidence-seed-1",
    "evidence-machine-1",
    "evidence-machine-2",
  ]);
  assert.equal(updated.routing_policy_version_id, "policy-version-3");
  assert.equal(updated.routing_policy_scope_kind, "module");
  assert.equal(updated.routing_policy_scope_value, "screening");
  assert.equal(updated.resolved_model_id, "model-primary-2");
  assert.equal(updated.fallback_model_id, "model-fallback-2");
  assert.equal(updated.fallback_trigger, "rate_limit");
  assert.equal(updated.status, "completed");
  assert.equal(updated.orchestration_status, "not_required");
  assert.equal(updated.orchestration_attempt_count, 0);
  assert.equal(updated.orchestration_max_attempts, 3);
  assert.equal(updated.orchestration_attempt_claim_token, undefined);
  assert.equal(updated.orchestration_next_retry_at, undefined);
  assert.equal(updated.execution_snapshot_id, "snapshot-1");
  assert.equal(updated.finished_at, "2026-03-28T13:00:00.000Z");

  const listed = await api.listLogs();
  assert.equal(listed.status, 200);
  assert.equal(
    listed.body[0]?.runtime_binding_readiness.observation_status,
    "reported",
  );
  assert.deepEqual(listed.body[0]?.runtime_binding_readiness.report, readinessReport);
});

test("agent execution api fails open when runtime binding readiness observation throws unexpectedly", async () => {
  const { api } = createAgentExecutionHarness({
    runtimeBindingReadinessService: {
      async getBindingReadiness() {
        throw new Error("execution log readiness exploded");
      },
    },
  });

  const created = await api.createLog({
    input: {
      manuscriptId: "manuscript-1",
      module: "editing",
      triggeredBy: "editor-1",
      runtimeId: "runtime-1",
      sandboxProfileId: "sandbox-1",
      agentProfileId: "agent-profile-1",
      runtimeBindingId: "binding-1",
      toolPermissionPolicyId: "policy-1",
      knowledgeItemIds: [],
    },
  });

  assert.equal(created.status, 201);
  assert.equal(
    created.body.runtime_binding_readiness.observation_status,
    "failed_open",
  );
  assert.equal(
    created.body.runtime_binding_readiness.error,
    "execution log readiness exploded",
  );
  assert.equal(created.body.runtime_binding_readiness.report, undefined);
});
