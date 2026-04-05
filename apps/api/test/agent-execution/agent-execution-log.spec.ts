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
  initialNow?: string;
  now?: () => Date;
  runningAttemptStaleAfterMs?: number;
}) {
  let idCounter = 0;
  let currentTime = new Date(input?.initialNow ?? "2026-03-28T13:00:00.000Z");
  const service = new AgentExecutionService({
    repository: new InMemoryAgentExecutionRepository(),
    createId: () => {
      idCounter += 1;
      return `execution-log-${idCounter}`;
    },
    now: () => currentTime,
  });
  const apiOptions: Parameters<typeof createAgentExecutionApi>[0] & {
    now?: () => Date;
    runningAttemptStaleAfterMs?: number;
  } = {
    agentExecutionService: service,
    runtimeBindingReadinessService: input?.runtimeBindingReadinessService,
    now: input?.now ?? (() => currentTime),
    runningAttemptStaleAfterMs: input?.runningAttemptStaleAfterMs,
  };
  const api = createAgentExecutionApi({
    ...apiOptions,
  });

  return {
    api,
    service,
    setNow(value: string) {
      currentTime = new Date(value);
    },
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
  assert.equal(
    created.body.completion_summary.derived_status,
    "business_in_progress",
  );
  assert.equal(created.body.completion_summary.business_completed, false);
  assert.equal(created.body.completion_summary.follow_up_required, true);
  assert.equal(created.body.completion_summary.fully_settled, false);
  assert.equal(created.body.completion_summary.attention_required, false);
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
    completed.body.completion_summary.derived_status,
    "business_completed_follow_up_pending",
  );
  assert.equal(completed.body.completion_summary.business_completed, true);
  assert.equal(completed.body.completion_summary.follow_up_required, true);
  assert.equal(completed.body.completion_summary.fully_settled, false);
  assert.equal(completed.body.completion_summary.attention_required, false);
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
    listed.body[0]?.completion_summary.derived_status,
    "business_completed_settled",
  );
  assert.equal(listed.body[0]?.completion_summary.business_completed, true);
  assert.equal(listed.body[0]?.completion_summary.follow_up_required, false);
  assert.equal(listed.body[0]?.completion_summary.fully_settled, true);
  assert.equal(listed.body[0]?.completion_summary.attention_required, false);
  assert.equal(
    listed.body[0]?.runtime_binding_readiness.observation_status,
    "reported",
  );
  assert.deepEqual(listed.body[0]?.runtime_binding_readiness.report, readinessReport);
});

test("agent execution api derives retryable and terminal follow-up completion summaries without changing business completion", async () => {
  const { api, service } = createAgentExecutionHarness({
    runtimeBindingReadinessService: {
      async getBindingReadiness() {
        return {
          status: "ready",
          scope: {
            module: "editing",
            manuscriptType: "clinical_study",
            templateFamilyId: "family-1",
          },
          issues: [],
          execution_profile_alignment: {
            status: "aligned",
            binding_execution_profile_id: "profile-1",
            active_execution_profile_id: "profile-1",
          },
        };
      },
    },
  });

  const retryable = await service.createLog({
    manuscriptId: "manuscript-retryable",
    module: "editing",
    triggeredBy: "editor-1",
    runtimeId: "runtime-1",
    sandboxProfileId: "sandbox-1",
    agentProfileId: "agent-profile-1",
    runtimeBindingId: "binding-1",
    toolPermissionPolicyId: "policy-1",
    knowledgeItemIds: [],
    evaluationSuiteIds: ["suite-1"],
  });
  await service.completeLog({
    logId: retryable.id,
    executionSnapshotId: "snapshot-retryable",
  });
  await service.failOrchestrationAttempt({
    logId: retryable.id,
    errorMessage: "retry later",
    nextRetryAt: "2026-03-28T13:05:00.000Z",
  });

  const failed = await service.createLog({
    manuscriptId: "manuscript-failed",
    module: "editing",
    triggeredBy: "editor-1",
    runtimeId: "runtime-1",
    sandboxProfileId: "sandbox-1",
    agentProfileId: "agent-profile-1",
    runtimeBindingId: "binding-1",
    toolPermissionPolicyId: "policy-1",
    knowledgeItemIds: [],
    evaluationSuiteIds: ["suite-2"],
    orchestrationMaxAttempts: 1,
  });
  await service.completeLog({
    logId: failed.id,
    executionSnapshotId: "snapshot-failed",
  });
  await service.markOrchestrationRunning({
    logId: failed.id,
  });
  await service.failOrchestrationAttempt({
    logId: failed.id,
    errorMessage: "exhausted",
  });

  const retryableView = await api.getLog({ logId: retryable.id });
  const failedView = await api.getLog({ logId: failed.id });

  assert.equal(retryableView.status, 200);
  assert.equal(
    retryableView.body.completion_summary.derived_status,
    "business_completed_follow_up_retryable",
  );
  assert.equal(retryableView.body.completion_summary.business_completed, true);
  assert.equal(retryableView.body.completion_summary.follow_up_required, true);
  assert.equal(retryableView.body.completion_summary.fully_settled, false);
  assert.equal(retryableView.body.completion_summary.attention_required, false);

  assert.equal(failedView.status, 200);
  assert.equal(
    failedView.body.completion_summary.derived_status,
    "business_completed_follow_up_failed",
  );
  assert.equal(failedView.body.completion_summary.business_completed, true);
  assert.equal(failedView.body.completion_summary.follow_up_required, true);
  assert.equal(failedView.body.completion_summary.fully_settled, false);
  assert.equal(failedView.body.completion_summary.attention_required, true);
});

test("agent execution api derives per-log recovery summary without changing orchestration behavior", async () => {
  const { api, service, setNow } = createAgentExecutionHarness({
    initialNow: "2026-03-28T12:55:00.000Z",
    runningAttemptStaleAfterMs: 5 * 60 * 1000,
  });

  const staleRunning = await service.createLog({
    manuscriptId: "manuscript-stale-running",
    module: "editing",
    triggeredBy: "editor-1",
    runtimeId: "runtime-1",
    sandboxProfileId: "sandbox-1",
    agentProfileId: "agent-profile-1",
    runtimeBindingId: "binding-1",
    toolPermissionPolicyId: "policy-1",
    knowledgeItemIds: [],
    evaluationSuiteIds: ["suite-stale"],
  });
  await service.completeLog({
    logId: staleRunning.id,
    executionSnapshotId: "snapshot-stale-running",
  });
  await service.markOrchestrationRunning({
    logId: staleRunning.id,
  });

  setNow("2026-03-28T13:00:00.000Z");

  const pending = await service.createLog({
    manuscriptId: "manuscript-pending",
    module: "editing",
    triggeredBy: "editor-1",
    runtimeId: "runtime-1",
    sandboxProfileId: "sandbox-1",
    agentProfileId: "agent-profile-1",
    runtimeBindingId: "binding-1",
    toolPermissionPolicyId: "policy-1",
    knowledgeItemIds: [],
    evaluationSuiteIds: ["suite-pending"],
  });
  await service.completeLog({
    logId: pending.id,
    executionSnapshotId: "snapshot-pending",
  });

  const deferredRetry = await service.createLog({
    manuscriptId: "manuscript-deferred-retry",
    module: "editing",
    triggeredBy: "editor-1",
    runtimeId: "runtime-1",
    sandboxProfileId: "sandbox-1",
    agentProfileId: "agent-profile-1",
    runtimeBindingId: "binding-1",
    toolPermissionPolicyId: "policy-1",
    knowledgeItemIds: [],
    evaluationSuiteIds: ["suite-deferred"],
  });
  await service.completeLog({
    logId: deferredRetry.id,
    executionSnapshotId: "snapshot-deferred-retry",
  });
  await service.failOrchestrationAttempt({
    logId: deferredRetry.id,
    errorMessage: "retry later",
    nextRetryAt: "2026-03-28T13:10:00.000Z",
  });

  const failed = await service.createLog({
    manuscriptId: "manuscript-failed",
    module: "editing",
    triggeredBy: "editor-1",
    runtimeId: "runtime-1",
    sandboxProfileId: "sandbox-1",
    agentProfileId: "agent-profile-1",
    runtimeBindingId: "binding-1",
    toolPermissionPolicyId: "policy-1",
    knowledgeItemIds: [],
    evaluationSuiteIds: ["suite-failed"],
    orchestrationMaxAttempts: 1,
  });
  await service.completeLog({
    logId: failed.id,
    executionSnapshotId: "snapshot-failed",
  });
  await service.markOrchestrationRunning({
    logId: failed.id,
  });
  await service.failOrchestrationAttempt({
    logId: failed.id,
    errorMessage: "exhausted",
  });

  const settled = await service.createLog({
    manuscriptId: "manuscript-settled",
    module: "editing",
    triggeredBy: "editor-1",
    runtimeId: "runtime-1",
    sandboxProfileId: "sandbox-1",
    agentProfileId: "agent-profile-1",
    runtimeBindingId: "binding-1",
    toolPermissionPolicyId: "policy-1",
    knowledgeItemIds: [],
  });
  await service.completeLog({
    logId: settled.id,
    executionSnapshotId: "snapshot-settled",
  });

  const inProgress = await service.createLog({
    manuscriptId: "manuscript-in-progress",
    module: "editing",
    triggeredBy: "editor-1",
    runtimeId: "runtime-1",
    sandboxProfileId: "sandbox-1",
    agentProfileId: "agent-profile-1",
    runtimeBindingId: "binding-1",
    toolPermissionPolicyId: "policy-1",
    knowledgeItemIds: [],
  });

  setNow("2026-03-28T13:02:00.000Z");

  const freshRunning = await service.createLog({
    manuscriptId: "manuscript-fresh-running",
    module: "editing",
    triggeredBy: "editor-1",
    runtimeId: "runtime-1",
    sandboxProfileId: "sandbox-1",
    agentProfileId: "agent-profile-1",
    runtimeBindingId: "binding-1",
    toolPermissionPolicyId: "policy-1",
    knowledgeItemIds: [],
    evaluationSuiteIds: ["suite-fresh"],
  });
  await service.completeLog({
    logId: freshRunning.id,
    executionSnapshotId: "snapshot-fresh-running",
  });
  await service.markOrchestrationRunning({
    logId: freshRunning.id,
  });

  setNow("2026-03-28T13:04:00.000Z");

  type RecoverySummary = {
    category: string;
    recovery_readiness: string;
    recovery_ready_at?: string;
    reason: string;
  };

  function readRecoverySummary(body: object): RecoverySummary {
    return (body as { recovery_summary: RecoverySummary }).recovery_summary;
  }

  const pendingView = await api.getLog({ logId: pending.id });
  const deferredRetryView = await api.getLog({ logId: deferredRetry.id });
  const failedView = await api.getLog({ logId: failed.id });
  const staleRunningView = await api.getLog({ logId: staleRunning.id });
  const freshRunningView = await api.getLog({ logId: freshRunning.id });
  const settledView = await api.getLog({ logId: settled.id });
  const inProgressView = await api.getLog({ logId: inProgress.id });

  assert.equal(readRecoverySummary(pendingView.body).category, "recoverable_now");
  assert.equal(readRecoverySummary(pendingView.body).recovery_readiness, "ready_now");
  assert.equal(
    readRecoverySummary(pendingView.body).reason,
    "Pending orchestration is ready to replay now.",
  );

  assert.equal(
    readRecoverySummary(deferredRetryView.body).category,
    "deferred_retry",
  );
  assert.equal(
    readRecoverySummary(deferredRetryView.body).recovery_readiness,
    "waiting_retry_eligibility",
  );
  assert.equal(
    readRecoverySummary(deferredRetryView.body).recovery_ready_at,
    "2026-03-28T13:10:00.000Z",
  );
  assert.equal(
    readRecoverySummary(deferredRetryView.body).reason,
    "Retryable orchestration is deferred until 2026-03-28T13:10:00.000Z.",
  );

  assert.equal(
    readRecoverySummary(failedView.body).category,
    "attention_required",
  );
  assert.equal(
    readRecoverySummary(failedView.body).recovery_readiness,
    "not_recoverable",
  );
  assert.equal(
    readRecoverySummary(failedView.body).reason,
    "Orchestration failed terminally: exhausted",
  );

  assert.equal(
    readRecoverySummary(staleRunningView.body).category,
    "stale_running",
  );
  assert.equal(
    readRecoverySummary(staleRunningView.body).recovery_readiness,
    "ready_now",
  );
  assert.equal(
    readRecoverySummary(staleRunningView.body).reason,
    "Running orchestration attempt is stale and reclaimable.",
  );

  assert.equal(
    readRecoverySummary(freshRunningView.body).category,
    "not_recoverable",
  );
  assert.equal(
    readRecoverySummary(freshRunningView.body).recovery_readiness,
    "waiting_running_timeout",
  );
  assert.equal(
    readRecoverySummary(freshRunningView.body).recovery_ready_at,
    "2026-03-28T13:07:00.000Z",
  );
  assert.equal(
    readRecoverySummary(freshRunningView.body).reason,
    "Running orchestration attempt is still fresh and should not be reclaimed yet.",
  );

  assert.equal(
    readRecoverySummary(settledView.body).category,
    "not_recoverable",
  );
  assert.equal(
    readRecoverySummary(settledView.body).recovery_readiness,
    "not_recoverable",
  );
  assert.equal(
    readRecoverySummary(settledView.body).reason,
    "No governed follow-up orchestration is required for this execution.",
  );

  assert.equal(
    readRecoverySummary(inProgressView.body).category,
    "not_recoverable",
  );
  assert.equal(
    readRecoverySummary(inProgressView.body).recovery_readiness,
    "not_recoverable",
  );
  assert.equal(
    readRecoverySummary(inProgressView.body).reason,
    "Business execution is running, so governed follow-up is not recoverable yet.",
  );
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
    created.body.completion_summary.derived_status,
    "business_in_progress",
  );
  assert.equal(created.body.completion_summary.business_completed, false);
  assert.equal(created.body.completion_summary.follow_up_required, false);
  assert.equal(created.body.completion_summary.fully_settled, false);
  assert.equal(created.body.completion_summary.attention_required, false);
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
