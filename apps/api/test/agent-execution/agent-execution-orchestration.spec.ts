import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryAgentExecutionRepository } from "../../src/modules/agent-execution/in-memory-agent-execution-repository.ts";
import { AgentExecutionService } from "../../src/modules/agent-execution/agent-execution-service.ts";
import { AgentExecutionOrchestrationService } from "../../src/modules/agent-execution/agent-execution-orchestration-service.ts";
import { InMemoryExecutionTrackingRepository } from "../../src/modules/execution-tracking/in-memory-execution-tracking-repository.ts";
import { ExecutionTrackingService } from "../../src/modules/execution-tracking/execution-tracking-service.ts";
import { InMemoryToolGatewayRepository } from "../../src/modules/tool-gateway/in-memory-tool-gateway-repository.ts";
import { ToolGatewayService } from "../../src/modules/tool-gateway/tool-gateway-service.ts";
import { InMemoryVerificationOpsRepository } from "../../src/modules/verification-ops/in-memory-verification-ops-repository.ts";
import { VerificationOpsService } from "../../src/modules/verification-ops/verification-ops-service.ts";

function createOrchestrationHarness(input?: {
  failingCheckProfileIds?: string[];
}) {
  const ids = [
    "check-profile-1",
    "evaluation-suite-1",
    "evaluation-run-1",
    "verification-evidence-1",
    "check-profile-2",
    "evaluation-suite-2",
    "evaluation-run-2",
    "verification-evidence-2",
    "check-profile-3",
    "evaluation-suite-3",
    "evaluation-run-3",
    "verification-evidence-3",
  ];
  const toolIds = ["tool-1", "tool-2", "tool-3"];
  const executionIds = [
    "execution-log-1",
    "execution-log-2",
    "execution-log-3",
    "execution-log-4",
    "execution-log-5",
    "execution-log-6",
  ];
  const trackingIds = [
    "snapshot-1",
    "hit-1",
    "snapshot-2",
    "hit-2",
    "snapshot-3",
    "hit-3",
    "snapshot-4",
    "hit-4",
    "snapshot-5",
    "hit-5",
    "snapshot-6",
    "hit-6",
  ];
  const toolGatewayRepository = new InMemoryToolGatewayRepository();
  const verificationOpsRepository = new InMemoryVerificationOpsRepository();
  const agentExecutionRepository = new InMemoryAgentExecutionRepository();
  const executionTrackingRepository = new InMemoryExecutionTrackingRepository();
  const toolGatewayService = new ToolGatewayService({
    repository: toolGatewayRepository,
    createId: () => {
      const value = toolIds.shift();
      assert.ok(value, "Expected a tool id to be available.");
      return value;
    },
  });
  const verificationOpsService = new VerificationOpsService({
    repository: verificationOpsRepository,
    toolGatewayRepository,
    createId: () => {
      const value = ids.shift();
      assert.ok(value, "Expected a verification ops id to be available.");
      return value;
    },
    now: () => new Date("2026-04-05T09:00:00.000Z"),
    governedRunCheckExecutor: async ({
      checkProfile,
      governedSource,
    }: {
      checkProfile: { id: string; check_type: string; name: string };
      governedSource: { output_asset_id: string };
    }) => {
      if (input?.failingCheckProfileIds?.includes(checkProfile.id)) {
        throw new Error(`Synthetic failure for ${checkProfile.id}`);
      }

      return {
        outcome: "passed" as const,
        evidence: {
          kind: "artifact" as const,
          label: `Automatic governed ${checkProfile.check_type} passed for ${checkProfile.name}`,
          artifactAssetId: governedSource.output_asset_id,
        },
      };
    },
  });
  const agentExecutionService = new AgentExecutionService({
    repository: agentExecutionRepository,
    createId: () => {
      const value = executionIds.shift();
      assert.ok(value, "Expected an execution log id to be available.");
      return value;
    },
    now: () => new Date("2026-04-05T09:00:00.000Z"),
  });
  const executionTrackingService = new ExecutionTrackingService({
    repository: executionTrackingRepository,
    createId: () => {
      const value = trackingIds.shift();
      assert.ok(value, "Expected a tracking id to be available.");
      return value;
    },
    now: () => new Date("2026-04-05T09:00:00.000Z"),
  });
  const orchestrationService = new AgentExecutionOrchestrationService({
    agentExecutionService,
    executionTrackingService,
    verificationOpsService,
    now: () => new Date("2026-04-05T09:05:00.000Z"),
  });

  return {
    toolGatewayService,
    verificationOpsService,
    agentExecutionService,
    executionTrackingService,
    orchestrationService,
  };
}

async function seedPendingExecutionLog(input?: {
  failingCheckProfileIds?: string[];
  orchestrationMaxAttempts?: number;
}) {
  const harness = createOrchestrationHarness({
    failingCheckProfileIds: input?.failingCheckProfileIds,
  });
  const activeSuite = await createActiveSuiteForModule(harness, {
    module: "editing",
    name: "Governed Suite",
  });

  const created = await harness.agentExecutionService.createLog({
    manuscriptId: "manuscript-1",
    module: "editing",
    triggeredBy: "editor-1",
    runtimeId: "runtime-1",
    sandboxProfileId: "sandbox-1",
    agentProfileId: "agent-profile-1",
    runtimeBindingId: "binding-1",
    toolPermissionPolicyId: "policy-1",
    knowledgeItemIds: ["knowledge-1"],
    evaluationSuiteIds: [activeSuite.id],
    orchestrationMaxAttempts: input?.orchestrationMaxAttempts,
  });

  const snapshot = await harness.executionTrackingService.recordSnapshot({
    manuscriptId: "manuscript-1",
    module: "editing",
    jobId: "job-1",
    executionProfileId: "profile-1",
    moduleTemplateId: "template-1",
    moduleTemplateVersionNo: 1,
    promptTemplateId: "prompt-1",
    promptTemplateVersion: "1.0.0",
    skillPackageIds: [],
    skillPackageVersions: [],
    modelId: "model-1",
    createdAssetIds: ["asset-1"],
    knowledgeHits: [
      {
        knowledgeItemId: "knowledge-1",
        matchSource: "binding_rule",
        matchReasons: ["module"],
      },
    ],
  });

  const completed = await harness.agentExecutionService.completeLog({
    logId: created.id,
    executionSnapshotId: snapshot.id,
  });

  return {
    ...harness,
    activeSuite,
    created,
    snapshot,
    completed,
  };
}

async function createCompletedInspectionLog(input: {
  harness: ReturnType<typeof createOrchestrationHarness>;
  logId: string;
  manuscriptId: string;
  module?: "screening" | "editing" | "proofreading";
  suiteIds?: string[];
  maxAttempts?: number;
}) {
  const module = input.module ?? "editing";
  const created = await input.harness.agentExecutionService.createLog({
    manuscriptId: input.manuscriptId,
    module,
    triggeredBy: "editor-1",
    runtimeId: "runtime-1",
    sandboxProfileId: "sandbox-1",
    agentProfileId: "agent-profile-1",
    runtimeBindingId: "binding-1",
    toolPermissionPolicyId: "policy-1",
    knowledgeItemIds: ["knowledge-1"],
    evaluationSuiteIds: input.suiteIds ?? ["suite-1"],
    orchestrationMaxAttempts: input.maxAttempts,
  });
  assert.equal(created.id, input.logId);

  const snapshot = await input.harness.executionTrackingService.recordSnapshot({
    manuscriptId: input.manuscriptId,
    module,
    jobId: `job-${input.logId}`,
    executionProfileId: "profile-1",
    moduleTemplateId: "template-1",
    moduleTemplateVersionNo: 1,
    promptTemplateId: "prompt-1",
    promptTemplateVersion: "1.0.0",
    skillPackageIds: [],
    skillPackageVersions: [],
    modelId: "model-1",
    createdAssetIds: ["asset-1"],
    knowledgeHits: [
      {
        knowledgeItemId: "knowledge-1",
        matchSource: "binding_rule",
        matchReasons: ["module"],
      },
    ],
  });

  return input.harness.agentExecutionService.completeLog({
    logId: created.id,
    executionSnapshotId: snapshot.id,
  });
}

async function createActiveSuiteForModule(
  harness: ReturnType<typeof createOrchestrationHarness>,
  input: {
    module: "screening" | "editing" | "proofreading";
    name: string;
  },
) {
  const tool = await harness.toolGatewayService.createTool("admin", {
    name: `gstack.browser.qa.${input.module}`,
    scope: "browser_qa",
  });
  const checkProfile =
    await harness.verificationOpsService.createVerificationCheckProfile("admin", {
      name: `${input.name} Check`,
      checkType: "browser_qa",
      toolIds: [tool.id],
    });
  const publishedCheckProfile =
    await harness.verificationOpsService.publishVerificationCheckProfile(
      checkProfile.id,
      "admin",
    );
  const suite = await harness.verificationOpsService.createEvaluationSuite("admin", {
    name: input.name,
    suiteType: "regression",
    verificationCheckProfileIds: [publishedCheckProfile.id],
    moduleScope: [input.module],
  });
  return harness.verificationOpsService.activateEvaluationSuite(suite.id, "admin");
}

test("orchestration service completes a pending governed follow-up and reuses the existing run on replay", async () => {
  const { orchestrationService, verificationOpsService, agentExecutionService, activeSuite } =
    await seedPendingExecutionLog();

  const completed = await orchestrationService.dispatchBestEffort("execution-log-1");
  assert.equal(completed.status, "completed");
  assert.equal(completed.orchestration_status, "completed");
  assert.equal(completed.orchestration_attempt_count, 1);
  assert.deepEqual(completed.verification_evidence_ids, ["verification-evidence-1"]);

  const replayed = await orchestrationService.dispatchBestEffort("execution-log-1");
  assert.equal(replayed.orchestration_status, "completed");
  assert.equal(replayed.orchestration_attempt_count, 1);
  assert.deepEqual(replayed.verification_evidence_ids, ["verification-evidence-1"]);

  const runs = await verificationOpsService.listEvaluationRunsBySuiteId(activeSuite.id);
  assert.deepEqual(runs.map((run) => run.id), ["evaluation-run-1"]);
  const persisted = await agentExecutionService.getLog("execution-log-1");
  assert.equal(persisted.orchestration_status, "completed");
});

test("orchestration service marks retryable failure without changing business completion", async () => {
  const { orchestrationService, agentExecutionService } = await seedPendingExecutionLog({
    failingCheckProfileIds: ["check-profile-1"],
  });

  const updated = await orchestrationService.dispatchBestEffort("execution-log-1");
  assert.equal(updated.status, "completed");
  assert.equal(updated.orchestration_status, "retryable");
  assert.equal(updated.orchestration_attempt_count, 1);
  assert.match(updated.orchestration_last_error ?? "", /Synthetic failure/);
  assert.equal(updated.orchestration_next_retry_at, "2026-04-05T09:06:00.000Z");

  const persisted = await agentExecutionService.getLog("execution-log-1");
  assert.equal(persisted.status, "completed");
  assert.equal(persisted.orchestration_status, "retryable");
  assert.equal(
    persisted.orchestration_next_retry_at,
    "2026-04-05T09:06:00.000Z",
  );
});

test("recovery summary processes recoverable logs and exhausts bounded retries", async () => {
  const {
    orchestrationService,
    agentExecutionService,
    executionTrackingService,
    verificationOpsService,
  } = await seedPendingExecutionLog({
    failingCheckProfileIds: ["check-profile-1"],
    orchestrationMaxAttempts: 2,
  });

  const firstSummary = await orchestrationService.recoverPending();
  assert.deepEqual(firstSummary, {
    processed_count: 1,
    completed_count: 0,
    retryable_count: 1,
    failed_count: 0,
    deferred_count: 0,
  });

  const tooEarlySummary = await orchestrationService.recoverPending();
  assert.deepEqual(tooEarlySummary, {
    processed_count: 0,
    completed_count: 0,
    retryable_count: 0,
    failed_count: 0,
    deferred_count: 1,
  });

  const eligibleRecoveryService = new AgentExecutionOrchestrationService({
    agentExecutionService,
    executionTrackingService,
    verificationOpsService,
    now: () => new Date("2026-04-05T09:06:01.000Z"),
  });
  const secondSummary = await eligibleRecoveryService.recoverPending();
  assert.deepEqual(secondSummary, {
    processed_count: 1,
    completed_count: 0,
    retryable_count: 0,
    failed_count: 1,
    deferred_count: 0,
  });

  const exhausted = await agentExecutionService.getLog("execution-log-1");
  assert.equal(exhausted.status, "completed");
  assert.equal(exhausted.orchestration_status, "failed");
  assert.equal(exhausted.orchestration_attempt_count, 2);
  assert.equal(exhausted.orchestration_next_retry_at, undefined);
});

test("recovery reclaims stale running orchestration but leaves fresh running attempts alone", async () => {
  const {
    agentExecutionService,
    executionTrackingService,
    verificationOpsService,
  } = await seedPendingExecutionLog();

  await agentExecutionService.markOrchestrationRunning({
    logId: "execution-log-1",
  });

  const freshRecoveryService = new AgentExecutionOrchestrationService({
    agentExecutionService,
    executionTrackingService,
    verificationOpsService,
    now: () => new Date("2026-04-05T09:04:00.000Z"),
  });
  const freshSummary = await freshRecoveryService.recoverPending();
  assert.deepEqual(freshSummary, {
    processed_count: 0,
    completed_count: 0,
    retryable_count: 0,
    failed_count: 0,
    deferred_count: 0,
  });

  const stillRunning = await agentExecutionService.getLog("execution-log-1");
  assert.equal(stillRunning.orchestration_status, "running");
  assert.equal(stillRunning.orchestration_attempt_count, 1);

  const staleRecoveryService = new AgentExecutionOrchestrationService({
    agentExecutionService,
    executionTrackingService,
    verificationOpsService,
    now: () => new Date("2026-04-05T09:06:00.000Z"),
  });
  const staleSummary = await staleRecoveryService.recoverPending();
  assert.deepEqual(staleSummary, {
    processed_count: 1,
    completed_count: 1,
    retryable_count: 0,
    failed_count: 0,
    deferred_count: 0,
  });

  const recovered = await agentExecutionService.getLog("execution-log-1");
  assert.equal(recovered.orchestration_status, "completed");
  assert.equal(recovered.orchestration_attempt_count, 2);
});

test("recovery waits until retryable orchestration becomes eligible again", async () => {
  const {
    agentExecutionService,
    executionTrackingService,
    verificationOpsService,
    orchestrationService,
  } = await seedPendingExecutionLog({
    failingCheckProfileIds: ["check-profile-1"],
  });

  const firstAttempt = await orchestrationService.dispatchBestEffort("execution-log-1");
  assert.equal(firstAttempt.orchestration_status, "retryable");
  assert.equal(firstAttempt.orchestration_next_retry_at, "2026-04-05T09:06:00.000Z");

  const tooEarlyRecoveryService = new AgentExecutionOrchestrationService({
    agentExecutionService,
    executionTrackingService,
    verificationOpsService,
    now: () => new Date("2026-04-05T09:05:30.000Z"),
  });
  const tooEarlySummary = await tooEarlyRecoveryService.recoverPending();
  assert.deepEqual(tooEarlySummary, {
    processed_count: 0,
    completed_count: 0,
    retryable_count: 0,
    failed_count: 0,
    deferred_count: 1,
  });

  const stillRetryable = await agentExecutionService.getLog("execution-log-1");
  assert.equal(stillRetryable.orchestration_status, "retryable");
  assert.equal(stillRetryable.orchestration_attempt_count, 1);

  const eligibleRecoveryService = new AgentExecutionOrchestrationService({
    agentExecutionService,
    executionTrackingService,
    verificationOpsService,
    now: () => new Date("2026-04-05T09:06:01.000Z"),
  });
  const eligibleSummary = await eligibleRecoveryService.recoverPending();
  assert.deepEqual(eligibleSummary, {
    processed_count: 1,
    completed_count: 0,
    retryable_count: 1,
    failed_count: 0,
    deferred_count: 0,
  });
});

test("recovery can scope replay candidates by module and explicit log id", async () => {
  const harness = createOrchestrationHarness();
  const editingSuite = await createActiveSuiteForModule(harness, {
    module: "editing",
    name: "Editing Recovery Suite",
  });
  const screeningSuite = await createActiveSuiteForModule(harness, {
    module: "screening",
    name: "Screening Recovery Suite",
  });

  await createCompletedInspectionLog({
    harness,
    logId: "execution-log-1",
    manuscriptId: "manuscript-editing",
    module: "editing",
    suiteIds: [editingSuite.id],
  });
  await createCompletedInspectionLog({
    harness,
    logId: "execution-log-2",
    manuscriptId: "manuscript-screening",
    module: "screening",
    suiteIds: [screeningSuite.id],
  });

  const scopedByModule = await harness.orchestrationService.recoverPending({
    modules: ["screening"],
  });
  assert.deepEqual(scopedByModule, {
    processed_count: 1,
    completed_count: 1,
    retryable_count: 0,
    failed_count: 0,
    deferred_count: 0,
  });
  assert.equal(
    (await harness.agentExecutionService.getLog("execution-log-1"))
      .orchestration_status,
    "pending",
  );
  assert.equal(
    (await harness.agentExecutionService.getLog("execution-log-2"))
      .orchestration_status,
    "completed",
  );

  const scopedByLog = await harness.orchestrationService.recoverPending({
    logIds: ["execution-log-1"],
  });
  assert.deepEqual(scopedByLog, {
    processed_count: 1,
    completed_count: 1,
    retryable_count: 0,
    failed_count: 0,
    deferred_count: 0,
  });
  assert.equal(
    (await harness.agentExecutionService.getLog("execution-log-1"))
      .orchestration_status,
    "completed",
  );
});

test("recovery applies replay budget after scope and recoverability screening", async () => {
  const harness = createOrchestrationHarness();
  const editingSuite = await createActiveSuiteForModule(harness, {
    module: "editing",
    name: "Editing Budget Suite",
  });
  const screeningSuite = await createActiveSuiteForModule(harness, {
    module: "screening",
    name: "Screening Budget Suite",
  });

  await createCompletedInspectionLog({
    harness,
    logId: "execution-log-1",
    manuscriptId: "manuscript-editing",
    module: "editing",
    suiteIds: [editingSuite.id],
  });

  await createCompletedInspectionLog({
    harness,
    logId: "execution-log-2",
    manuscriptId: "manuscript-deferred",
    module: "editing",
    suiteIds: [editingSuite.id],
  });
  await harness.agentExecutionService.failOrchestrationAttempt({
    logId: "execution-log-2",
    errorMessage: "Retry later",
    nextRetryAt: "2026-04-05T09:06:00.000Z",
  });

  await createCompletedInspectionLog({
    harness,
    logId: "execution-log-3",
    manuscriptId: "manuscript-screening",
    module: "screening",
    suiteIds: [screeningSuite.id],
  });

  const summary = await harness.orchestrationService.recoverPending({
    modules: ["editing", "screening"],
    budget: 1,
  });

  assert.deepEqual(summary, {
    processed_count: 1,
    completed_count: 1,
    retryable_count: 0,
    failed_count: 0,
    deferred_count: 1,
    eligible_count: 2,
    remaining_count: 1,
    budget: 1,
  });

  const processed = await harness.agentExecutionService.getLog("execution-log-1");
  assert.equal(processed.orchestration_status, "completed");
  assert.equal(processed.orchestration_attempt_count, 1);

  const deferred = await harness.agentExecutionService.getLog("execution-log-2");
  assert.equal(deferred.orchestration_status, "retryable");
  assert.equal(deferred.orchestration_next_retry_at, "2026-04-05T09:06:00.000Z");

  const remaining = await harness.agentExecutionService.getLog("execution-log-3");
  assert.equal(remaining.orchestration_status, "pending");
  assert.equal(remaining.orchestration_attempt_count, 0);
});

test("budgeted replay aligns with the existing dry-run recoverable priority order", async () => {
  const harness = createOrchestrationHarness();
  const editingSuite = await createActiveSuiteForModule(harness, {
    module: "editing",
    name: "Editing Alignment Suite",
  });
  const screeningSuite = await createActiveSuiteForModule(harness, {
    module: "screening",
    name: "Screening Alignment Suite",
  });

  await createCompletedInspectionLog({
    harness,
    logId: "execution-log-1",
    manuscriptId: "manuscript-pending",
    module: "editing",
    suiteIds: [editingSuite.id],
  });

  await createCompletedInspectionLog({
    harness,
    logId: "execution-log-2",
    manuscriptId: "manuscript-stale",
    module: "screening",
    suiteIds: [screeningSuite.id],
  });
  await harness.agentExecutionService.markOrchestrationRunning({
    logId: "execution-log-2",
    claimToken: "claim-stale",
  });

  const preview = await harness.orchestrationService.inspectBacklog({
    actionableOnly: true,
    limit: 1,
  });
  assert.deepEqual(
    preview.items.map((item) => ({
      logId: item.log_id,
      category: item.category,
    })),
    [
      {
        logId: "execution-log-2",
        category: "stale_running",
      },
    ],
  );

  const summary = await harness.orchestrationService.recoverPending({
    budget: 1,
  });
  assert.deepEqual(summary, {
    processed_count: 1,
    completed_count: 1,
    retryable_count: 0,
    failed_count: 0,
    deferred_count: 0,
    eligible_count: 2,
    remaining_count: 1,
    budget: 1,
  });

  const stillPending = await harness.agentExecutionService.getLog("execution-log-1");
  assert.equal(stillPending.orchestration_status, "pending");
  assert.equal(stillPending.orchestration_attempt_count, 0);

  const recoveredStale = await harness.agentExecutionService.getLog("execution-log-2");
  assert.equal(recoveredStale.orchestration_status, "completed");
  assert.equal(recoveredStale.orchestration_attempt_count, 2);
});

test("inspection can preview the next budgeted replay slice without mutating durable state", async () => {
  const harness = createOrchestrationHarness();
  const editingSuite = await createActiveSuiteForModule(harness, {
    module: "editing",
    name: "Editing Preview Suite",
  });
  const screeningSuite = await createActiveSuiteForModule(harness, {
    module: "screening",
    name: "Screening Preview Suite",
  });

  await createCompletedInspectionLog({
    harness,
    logId: "execution-log-1",
    manuscriptId: "manuscript-pending",
    module: "editing",
    suiteIds: [editingSuite.id],
  });

  await createCompletedInspectionLog({
    harness,
    logId: "execution-log-2",
    manuscriptId: "manuscript-stale",
    module: "screening",
    suiteIds: [screeningSuite.id],
  });
  await harness.agentExecutionService.markOrchestrationRunning({
    logId: "execution-log-2",
    claimToken: "claim-preview",
  });

  await createCompletedInspectionLog({
    harness,
    logId: "execution-log-3",
    manuscriptId: "manuscript-failed",
    module: "editing",
    suiteIds: [editingSuite.id],
    maxAttempts: 1,
  });
  await harness.agentExecutionService.markOrchestrationRunning({
    logId: "execution-log-3",
    claimToken: "claim-failed",
  });
  await harness.agentExecutionService.failOrchestrationAttempt({
    logId: "execution-log-3",
    claimToken: "claim-failed",
    errorMessage: "Exhausted",
  });

  const report = await harness.orchestrationService.inspectBacklog({
    budget: 1,
  });

  assert.deepEqual(report.summary, {
    total_count: 3,
    recoverable_now_count: 1,
    stale_running_count: 1,
    deferred_retry_count: 0,
    attention_required_count: 1,
    not_recoverable_count: 0,
  });
  assert.deepEqual(report.focus, {
    actionable_count: 3,
    displayed_count: 1,
    omitted_count: 0,
    actionable_only: false,
    limit: undefined,
  });
  assert.deepEqual(report.replay_preview, {
    budget: 1,
    eligible_count: 2,
    selected_count: 1,
    remaining_count: 1,
  });
  assert.deepEqual(
    report.items.map((item) => ({
      logId: item.log_id,
      category: item.category,
    })),
    [
      {
        logId: "execution-log-2",
        category: "stale_running",
      },
    ],
  );

  const pending = await harness.agentExecutionService.getLog("execution-log-1");
  assert.equal(pending.orchestration_status, "pending");

  const staleRunning = await harness.agentExecutionService.getLog("execution-log-2");
  assert.equal(staleRunning.orchestration_status, "running");

  const failed = await harness.agentExecutionService.getLog("execution-log-3");
  assert.equal(failed.orchestration_status, "failed");
});

test("inspection budget preview preserves preview counts when display limit trims the preview slice", async () => {
  const harness = createOrchestrationHarness();
  const editingSuite = await createActiveSuiteForModule(harness, {
    module: "editing",
    name: "Editing Preview Limit Suite",
  });
  const screeningSuite = await createActiveSuiteForModule(harness, {
    module: "screening",
    name: "Screening Preview Limit Suite",
  });
  const proofreadingSuite = await createActiveSuiteForModule(harness, {
    module: "proofreading",
    name: "Proofreading Preview Limit Suite",
  });

  await createCompletedInspectionLog({
    harness,
    logId: "execution-log-1",
    manuscriptId: "manuscript-editing",
    module: "editing",
    suiteIds: [editingSuite.id],
  });

  await createCompletedInspectionLog({
    harness,
    logId: "execution-log-2",
    manuscriptId: "manuscript-screening",
    module: "screening",
    suiteIds: [screeningSuite.id],
  });
  await harness.agentExecutionService.markOrchestrationRunning({
    logId: "execution-log-2",
    claimToken: "claim-stale",
  });

  await createCompletedInspectionLog({
    harness,
    logId: "execution-log-3",
    manuscriptId: "manuscript-proofreading",
    module: "proofreading",
    suiteIds: [proofreadingSuite.id],
  });

  const report = await harness.orchestrationService.inspectBacklog({
    budget: 2,
    limit: 1,
  });

  assert.deepEqual(report.focus, {
    actionable_count: 3,
    displayed_count: 1,
    omitted_count: 1,
    actionable_only: false,
    limit: 1,
  });
  assert.deepEqual(report.replay_preview, {
    budget: 2,
    eligible_count: 3,
    selected_count: 2,
    remaining_count: 1,
  });
  assert.deepEqual(
    report.items.map((item) => item.log_id),
    ["execution-log-2"],
  );
});

test("only one orchestration claimant can win the same persisted attempt snapshot", async () => {
  const { agentExecutionService } = await seedPendingExecutionLog();

  const original = await agentExecutionService.getLog("execution-log-1");
  const firstClaim = await agentExecutionService.claimOrchestrationAttempt({
    logId: original.id,
    claimToken: "claim-1",
    expectedOrchestrationStatus: original.orchestration_status,
    expectedAttemptCount: original.orchestration_attempt_count,
    expectedLastAttemptStartedAt: original.orchestration_last_attempt_started_at,
    expectedNextRetryAt: original.orchestration_next_retry_at,
  });
  assert.ok(firstClaim);
  assert.equal(firstClaim.orchestration_status, "running");
  assert.equal(firstClaim.orchestration_attempt_count, 1);
  assert.equal(firstClaim.orchestration_attempt_claim_token, "claim-1");

  const secondClaim = await agentExecutionService.claimOrchestrationAttempt({
    logId: original.id,
    claimToken: "claim-2",
    expectedOrchestrationStatus: original.orchestration_status,
    expectedAttemptCount: original.orchestration_attempt_count,
    expectedLastAttemptStartedAt: original.orchestration_last_attempt_started_at,
    expectedNextRetryAt: original.orchestration_next_retry_at,
  });
  assert.equal(secondClaim, undefined);

  const persisted = await agentExecutionService.getLog("execution-log-1");
  assert.equal(persisted.orchestration_status, "running");
  assert.equal(persisted.orchestration_attempt_count, 1);
  assert.equal(persisted.orchestration_attempt_claim_token, "claim-1");
});

test("stale orchestration owner cannot finalize after a newer claim rotates ownership", async () => {
  const { agentExecutionService } = await seedPendingExecutionLog();

  const original = await agentExecutionService.getLog("execution-log-1");
  const firstClaim = await agentExecutionService.claimOrchestrationAttempt({
    logId: original.id,
    claimToken: "claim-1",
    expectedOrchestrationStatus: original.orchestration_status,
    expectedAttemptCount: original.orchestration_attempt_count,
    expectedLastAttemptStartedAt: original.orchestration_last_attempt_started_at,
    expectedNextRetryAt: original.orchestration_next_retry_at,
  });
  assert.ok(firstClaim);

  const secondClaim = await agentExecutionService.claimOrchestrationAttempt({
    logId: original.id,
    claimToken: "claim-2",
    expectedOrchestrationStatus: firstClaim.orchestration_status,
    expectedAttemptCount: firstClaim.orchestration_attempt_count,
    expectedLastAttemptStartedAt: firstClaim.orchestration_last_attempt_started_at,
    expectedNextRetryAt: firstClaim.orchestration_next_retry_at,
    expectedAttemptClaimToken: firstClaim.orchestration_attempt_claim_token,
  });
  assert.ok(secondClaim);
  assert.equal(secondClaim.orchestration_attempt_claim_token, "claim-2");
  assert.equal(secondClaim.orchestration_attempt_count, 2);

  const staleFinalize = await agentExecutionService.completeOrchestration({
    logId: original.id,
    claimToken: "claim-1",
    evidenceIds: ["verification-evidence-stale"],
  });
  assert.equal(staleFinalize.orchestration_status, "running");
  assert.equal(staleFinalize.orchestration_attempt_claim_token, "claim-2");
  assert.deepEqual(staleFinalize.verification_evidence_ids, []);

  const ownedFinalize = await agentExecutionService.completeOrchestration({
    logId: original.id,
    claimToken: "claim-2",
    evidenceIds: ["verification-evidence-owned"],
  });
  assert.equal(ownedFinalize.orchestration_status, "completed");
  assert.equal(ownedFinalize.orchestration_attempt_claim_token, undefined);
  assert.deepEqual(ownedFinalize.verification_evidence_ids, [
    "verification-evidence-owned",
  ]);
});

test("inspection classifies orchestration backlog without mutating durable state", async () => {
  const harness = createOrchestrationHarness();

  await createCompletedInspectionLog({
    harness,
    logId: "execution-log-1",
    manuscriptId: "manuscript-recoverable",
  });

  await createCompletedInspectionLog({
    harness,
    logId: "execution-log-2",
    manuscriptId: "manuscript-deferred",
  });
  await harness.agentExecutionService.failOrchestrationAttempt({
    logId: "execution-log-2",
    errorMessage: "Retry later",
    nextRetryAt: "2026-04-05T09:06:00.000Z",
  });

  await createCompletedInspectionLog({
    harness,
    logId: "execution-log-3",
    manuscriptId: "manuscript-stale",
  });
  await harness.agentExecutionService.markOrchestrationRunning({
    logId: "execution-log-3",
    claimToken: "claim-stale",
  });

  await createCompletedInspectionLog({
    harness,
    logId: "execution-log-4",
    manuscriptId: "manuscript-failed",
    maxAttempts: 1,
  });
  await harness.agentExecutionService.markOrchestrationRunning({
    logId: "execution-log-4",
    claimToken: "claim-failed",
  });
  await harness.agentExecutionService.failOrchestrationAttempt({
    logId: "execution-log-4",
    claimToken: "claim-failed",
    errorMessage: "Exhausted",
  });

  await createCompletedInspectionLog({
    harness,
    logId: "execution-log-5",
    manuscriptId: "manuscript-complete",
  });
  await harness.agentExecutionService.completeOrchestration({
    logId: "execution-log-5",
  });

  const report = await harness.orchestrationService.inspectBacklog();
  assert.deepEqual(report.summary, {
    total_count: 5,
    recoverable_now_count: 1,
    stale_running_count: 1,
    deferred_retry_count: 1,
    attention_required_count: 1,
    not_recoverable_count: 1,
  });

  const byId = new Map(report.items.map((item) => [item.log_id, item]));
  assert.equal(byId.get("execution-log-1")?.category, "recoverable_now");
  assert.match(byId.get("execution-log-1")?.reason ?? "", /pending/i);
  assert.equal(byId.get("execution-log-2")?.category, "deferred_retry");
  assert.match(byId.get("execution-log-2")?.reason ?? "", /retry/i);
  assert.equal(byId.get("execution-log-3")?.category, "stale_running");
  assert.match(byId.get("execution-log-3")?.reason ?? "", /stale/i);
  assert.equal(byId.get("execution-log-4")?.category, "attention_required");
  assert.match(byId.get("execution-log-4")?.reason ?? "", /failed|exhausted/i);
  assert.equal(byId.get("execution-log-5")?.category, "not_recoverable");

  const staleAfter = await harness.agentExecutionService.getLog("execution-log-3");
  assert.equal(staleAfter.orchestration_status, "running");
  assert.equal(staleAfter.orchestration_attempt_count, 1);
  assert.equal(staleAfter.orchestration_attempt_claim_token, "claim-stale");
});

test("inspection supports actionable focus ordering and bounded limits", async () => {
  const harness = createOrchestrationHarness();

  await createCompletedInspectionLog({
    harness,
    logId: "execution-log-1",
    manuscriptId: "manuscript-recoverable",
  });

  await createCompletedInspectionLog({
    harness,
    logId: "execution-log-2",
    manuscriptId: "manuscript-deferred",
  });
  await harness.agentExecutionService.failOrchestrationAttempt({
    logId: "execution-log-2",
    errorMessage: "Retry later",
    nextRetryAt: "2026-04-05T09:06:00.000Z",
  });

  await createCompletedInspectionLog({
    harness,
    logId: "execution-log-3",
    manuscriptId: "manuscript-stale",
  });
  await harness.agentExecutionService.markOrchestrationRunning({
    logId: "execution-log-3",
    claimToken: "claim-stale",
  });

  await createCompletedInspectionLog({
    harness,
    logId: "execution-log-4",
    manuscriptId: "manuscript-failed",
    maxAttempts: 1,
  });
  await harness.agentExecutionService.markOrchestrationRunning({
    logId: "execution-log-4",
    claimToken: "claim-failed",
  });
  await harness.agentExecutionService.failOrchestrationAttempt({
    logId: "execution-log-4",
    claimToken: "claim-failed",
    errorMessage: "Exhausted",
  });

  await createCompletedInspectionLog({
    harness,
    logId: "execution-log-5",
    manuscriptId: "manuscript-complete",
  });
  await harness.agentExecutionService.completeOrchestration({
    logId: "execution-log-5",
  });

  const report = await harness.orchestrationService.inspectBacklog({
    actionableOnly: true,
    limit: 2,
  });

  assert.deepEqual(report.focus, {
    actionable_count: 4,
    displayed_count: 2,
    omitted_count: 2,
    actionable_only: true,
    limit: 2,
  });
  assert.deepEqual(
    report.items.map((item) => item.category),
    ["attention_required", "stale_running"],
  );
  assert.deepEqual(
    report.items.map((item) => item.log_id),
    ["execution-log-4", "execution-log-3"],
  );
});

test("inspection scopes backlog before applying actionable focus ordering", async () => {
  const harness = createOrchestrationHarness();

  await createCompletedInspectionLog({
    harness,
    logId: "execution-log-1",
    manuscriptId: "manuscript-editing",
    module: "editing",
  });

  await createCompletedInspectionLog({
    harness,
    logId: "execution-log-2",
    manuscriptId: "manuscript-screening",
    module: "screening",
    maxAttempts: 1,
  });
  await harness.agentExecutionService.markOrchestrationRunning({
    logId: "execution-log-2",
    claimToken: "claim-failed",
  });
  await harness.agentExecutionService.failOrchestrationAttempt({
    logId: "execution-log-2",
    claimToken: "claim-failed",
    errorMessage: "Exhausted",
  });

  await createCompletedInspectionLog({
    harness,
    logId: "execution-log-3",
    manuscriptId: "manuscript-proofreading",
    module: "proofreading",
  });
  await harness.agentExecutionService.completeOrchestration({
    logId: "execution-log-3",
  });

  const report = await harness.orchestrationService.inspectBacklog({
    modules: ["screening", "proofreading"],
    logIds: ["execution-log-2", "execution-log-3"],
    actionableOnly: true,
    limit: 1,
  });

  assert.deepEqual(report.summary, {
    total_count: 2,
    recoverable_now_count: 0,
    stale_running_count: 0,
    deferred_retry_count: 0,
    attention_required_count: 1,
    not_recoverable_count: 1,
  });
  assert.deepEqual(report.focus, {
    actionable_count: 1,
    displayed_count: 1,
    omitted_count: 0,
    actionable_only: true,
    limit: 1,
  });
  assert.deepEqual(
    report.items.map((item) => item.log_id),
    ["execution-log-2"],
  );
  assert.deepEqual(
    report.items.map((item) => item.category),
    ["attention_required"],
  );
});
