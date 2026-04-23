import test from "node:test";
import assert from "node:assert/strict";
import { ScreeningService } from "../../src/modules/screening/screening-service.ts";
import { ModuleExecutionConcurrencyController } from "../../src/modules/shared/module-execution-concurrency-controller.ts";
import { seedMedicalQualityFixture } from "../shared/medical-quality-fixture.ts";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

test("screening service persists queued and running states while concurrency limits hold later work", async () => {
  const harness = await seedMedicalQualityFixture();
  const controller = new ModuleExecutionConcurrencyController({
    limits: {
      global: 1,
      screening: 1,
      editing: 1,
      proofreading: 1,
    },
  });
  const releaseFirst = createDeferred<void>();
  const firstStarted = createDeferred<void>();
  let invocationCount = 0;
  const screeningService = new ScreeningService({
    manuscriptRepository: harness.manuscriptRepository,
    assetRepository: harness.assetRepository,
    moduleTemplateRepository: harness.moduleTemplateRepository,
    promptSkillRegistryRepository: harness.promptSkillRegistryRepository,
    knowledgeRepository: harness.knowledgeRepository,
    executionGovernanceService: harness.executionGovernanceService,
    executionTrackingService: harness.executionTrackingService,
    jobRepository: harness.jobRepository,
    documentAssetService: harness.documentAssetService,
    aiGatewayService: harness.aiGatewayService,
    sandboxProfileService: harness.sandboxProfileService,
    agentProfileService: harness.agentProfileService,
    agentRuntimeService: harness.agentRuntimeService,
    runtimeBindingService: harness.runtimeBindingService,
    toolPermissionPolicyService: harness.toolPermissionPolicyService,
    agentExecutionService: harness.agentExecutionService,
    agentExecutionOrchestrationService: {
      async dispatchBestEffort() {
        return undefined;
      },
    } as never,
    screeningAiReportService: {
      async createReport() {
        invocationCount += 1;
        if (invocationCount === 1) {
          firstStarted.resolve();
          await releaseFirst.promise;
        }

        return {
          report: {
            summary: `screening-${invocationCount}`,
            majorFindings: [],
            minorFindings: [],
            riskLevel: "low" as const,
            recommendedDecision: "accept" as const,
          },
          markdown: `# Screening ${invocationCount}`,
        };
      },
    } as never,
    moduleExecutionConcurrencyController: controller,
    createId: (() => {
      const ids = ["job-screening-1", "job-screening-2"];
      return () => {
        const value = ids.shift();
        assert.ok(value);
        return value;
      };
    })(),
    now: () => new Date("2026-04-23T10:00:00.000Z"),
  } as never);

  const firstRun = screeningService.run({
    manuscriptId: "manuscript-1",
    parentAssetId: harness.originalAssetId,
    requestedBy: "screener-1",
    actorRole: "screener",
    storageKey: "runs/manuscript-1/screening/first.md",
    fileName: "first.md",
    executionMode: "bare",
  });

  await firstStarted.promise;

  const secondRun = screeningService.run({
    manuscriptId: "manuscript-1",
    parentAssetId: harness.originalAssetId,
    requestedBy: "screener-2",
    actorRole: "screener",
    storageKey: "runs/manuscript-1/screening/second.md",
    fileName: "second.md",
    executionMode: "bare",
  });

  await Promise.resolve();

  assert.equal((await harness.jobRepository.findById("job-screening-1"))?.status, "running");
  assert.equal((await harness.jobRepository.findById("job-screening-2"))?.status, "queued");
  assert.deepEqual(controller.getSnapshot(), {
    active: {
      global: 1,
      screening: 1,
      editing: 0,
      proofreading: 0,
    },
    queued: {
      global: 1,
      screening: 1,
      editing: 0,
      proofreading: 0,
    },
    limits: {
      global: 1,
      screening: 1,
      editing: 1,
      proofreading: 1,
    },
  });

  releaseFirst.resolve();

  assert.equal((await firstRun).job.status, "completed");
  assert.equal((await secondRun).job.status, "completed");
}
);
