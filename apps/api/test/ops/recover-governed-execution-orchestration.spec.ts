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
import {
  type AgentExecutionOrchestrationInspectionReport,
  formatGovernedExecutionOrchestrationRecoverySummary,
  runGovernedExecutionOrchestrationRecovery,
  runGovernedExecutionOrchestrationRecoveryCli,
} from "../../src/ops/recover-governed-execution-orchestration.ts";

function createRecoveryHarness(input?: {
  failingCheckProfileIds?: string[];
}) {
  const ids = [
    "check-profile-1",
    "evaluation-suite-1",
    "evaluation-run-1",
    "verification-evidence-1",
  ];
  const toolIds = ["tool-1"];
  const executionIds = ["execution-log-1"];
  const trackingIds = ["snapshot-1", "hit-1"];
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
    governedRunCheckExecutor: async ({ checkProfile, governedSource }) => {
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

async function seedPendingExecutionLog() {
  const harness = createRecoveryHarness();
  const tool = await harness.toolGatewayService.createTool("admin", {
    name: "gstack.browser.qa",
    scope: "browser_qa",
  });
  const checkProfile =
    await harness.verificationOpsService.createVerificationCheckProfile("admin", {
      name: "Governed Check",
      checkType: "browser_qa",
      toolIds: [tool.id],
    });
  const publishedCheckProfile =
    await harness.verificationOpsService.publishVerificationCheckProfile(
      checkProfile.id,
      "admin",
    );
  const suite = await harness.verificationOpsService.createEvaluationSuite("admin", {
    name: "Governed Suite",
    suiteType: "regression",
    verificationCheckProfileIds: [publishedCheckProfile.id],
    moduleScope: ["editing"],
  });
  const activeSuite = await harness.verificationOpsService.activateEvaluationSuite(
    suite.id,
    "admin",
  );

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

  await harness.agentExecutionService.completeLog({
    logId: created.id,
    executionSnapshotId: snapshot.id,
  });

  return harness;
}

test("governed execution orchestration recovery command replays pending logs", async () => {
  const harness = await seedPendingExecutionLog();

  const summary = await runGovernedExecutionOrchestrationRecovery({
    orchestrationService: harness.orchestrationService,
  });

  assert.deepEqual(summary, {
    processed_count: 1,
    completed_count: 1,
    retryable_count: 0,
    failed_count: 0,
    deferred_count: 0,
  });
  const recovered = await harness.agentExecutionService.getLog("execution-log-1");
  assert.equal(recovered.orchestration_status, "completed");
  assert.equal(recovered.verification_evidence_ids.length, 1);
});

test("governed execution orchestration recovery cli prints json and human summaries", async () => {
  const messages: string[] = [];
  const summary = {
    processed_count: 2,
    completed_count: 1,
    retryable_count: 1,
    failed_count: 0,
    deferred_count: 3,
  };

  await runGovernedExecutionOrchestrationRecoveryCli({
    args: ["--json"],
    createRecoveryRunner: async () => summary,
    log: (message) => messages.push(message),
  });
  assert.equal(messages[0], JSON.stringify(summary, null, 2));

  assert.equal(
    formatGovernedExecutionOrchestrationRecoverySummary(summary),
    "[api] governed execution orchestration recovery processed=2 completed=1 retryable=1 failed=0 deferred=3",
  );
});

test("governed execution orchestration recovery cli supports dry-run inspection output", async () => {
  const messages: string[] = [];
  const inspection: AgentExecutionOrchestrationInspectionReport = {
    summary: {
      total_count: 4,
      recoverable_now_count: 1,
      stale_running_count: 1,
      deferred_retry_count: 1,
      attention_required_count: 1,
      not_recoverable_count: 0,
    },
    focus: {
      actionable_count: 4,
      displayed_count: 1,
      omitted_count: 3,
      actionable_only: true,
      limit: 1,
    },
    items: [
      {
        log_id: "execution-log-1",
        manuscript_id: "manuscript-1",
        module: "editing",
        business_status: "completed",
        orchestration_status: "pending",
        orchestration_attempt_count: 0,
        orchestration_max_attempts: 3,
        category: "recoverable_now",
        reason: "Pending orchestration is ready to replay now.",
      },
    ],
  };

  await runGovernedExecutionOrchestrationRecoveryCli({
    args: ["--dry-run"],
    createInspectionRunner: async () => inspection,
    log: (message) => messages.push(message),
  });

  assert.match(messages[0] ?? "", /dry-run/i);
  assert.match(messages[0] ?? "", /recoverable_now=1/i);
  assert.match(messages[0] ?? "", /stale_running=1/i);
  assert.match(messages[1] ?? "", /execution-log-1/);

  messages.length = 0;
  await runGovernedExecutionOrchestrationRecoveryCli({
    args: ["--dry-run", "--json"],
    createInspectionRunner: async () => inspection,
    log: (message) => messages.push(message),
  });
  assert.equal(messages[0], JSON.stringify(inspection, null, 2));
});

test("governed execution orchestration dry-run forwards actionable focus options", async () => {
  const messages: string[] = [];
  let receivedOptions:
    | {
        actionableOnly?: boolean;
        limit?: number;
      }
    | undefined;

  const inspection: AgentExecutionOrchestrationInspectionReport = {
    summary: {
      total_count: 3,
      recoverable_now_count: 1,
      stale_running_count: 1,
      deferred_retry_count: 0,
      attention_required_count: 1,
      not_recoverable_count: 0,
    },
    focus: {
      actionable_count: 3,
      displayed_count: 2,
      omitted_count: 1,
      actionable_only: true,
      limit: 2,
    },
    items: [
      {
        log_id: "execution-log-4",
        manuscript_id: "manuscript-4",
        module: "editing",
        business_status: "completed",
        orchestration_status: "failed",
        orchestration_attempt_count: 1,
        orchestration_max_attempts: 1,
        category: "attention_required",
        reason: "Orchestration failed terminally: Exhausted",
      },
      {
        log_id: "execution-log-3",
        manuscript_id: "manuscript-3",
        module: "editing",
        business_status: "completed",
        orchestration_status: "running",
        orchestration_attempt_count: 1,
        orchestration_max_attempts: 3,
        category: "stale_running",
        reason: "Running orchestration attempt is stale and reclaimable.",
      },
    ],
  };

  await runGovernedExecutionOrchestrationRecoveryCli({
    args: ["--dry-run", "--actionable-only", "--limit", "2"],
    createInspectionRunner: async (input) => {
      receivedOptions = input.inspectionOptions;
      return inspection;
    },
    log: (message) => messages.push(message),
  });

  assert.deepEqual(receivedOptions, {
    actionableOnly: true,
    limit: 2,
  });
  assert.match(messages[0] ?? "", /displayed=2/i);
  assert.match(messages[0] ?? "", /omitted=1/i);
});
