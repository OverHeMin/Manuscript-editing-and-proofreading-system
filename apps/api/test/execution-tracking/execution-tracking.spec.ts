import test from "node:test";
import assert from "node:assert/strict";
import { createExecutionTrackingApi } from "../../src/modules/execution-tracking/execution-tracking-api.ts";
import { ExecutionTrackingService } from "../../src/modules/execution-tracking/execution-tracking-service.ts";
import { InMemoryExecutionTrackingRepository } from "../../src/modules/execution-tracking/in-memory-execution-tracking-repository.ts";
import type { ModuleExecutionProfileRecord } from "../../src/modules/execution-governance/execution-governance-record.ts";
import type { RuntimeBindingReadinessReport } from "../../src/modules/runtime-bindings/runtime-binding-readiness.ts";

function createExecutionTrackingHarness(input?: {
  executionGovernanceRepository?: {
    findProfileById: (
      id: string,
    ) => Promise<ModuleExecutionProfileRecord | undefined>;
  };
  runtimeBindingReadinessService?: {
    getActiveBindingReadinessForScope: (
      scope: RuntimeBindingReadinessReport["scope"],
    ) => Promise<RuntimeBindingReadinessReport>;
  };
}) {
  const repository = new InMemoryExecutionTrackingRepository();
  const service = new ExecutionTrackingService({
    repository,
    createId: (() => {
      const ids = ["snapshot-1", "hit-1", "hit-2", "snapshot-2", "hit-3"];
      return () => {
        const value = ids.shift();
        assert.ok(value, "Expected an execution tracking id to be available.");
        return value;
      };
    })(),
    now: () => new Date("2026-03-28T10:30:00.000Z"),
  });
  const api = createExecutionTrackingApi({
    executionTrackingService: service,
    executionGovernanceRepository: input?.executionGovernanceRepository,
    runtimeBindingReadinessService: input?.runtimeBindingReadinessService,
  });

  return {
    api,
    repository,
    service,
  };
}

test("execution tracking stores a frozen snapshot and per-knowledge hit reasons", async () => {
  const { repository, service } = createExecutionTrackingHarness();

  const snapshot = await service.recordSnapshot({
    manuscriptId: "manuscript-1",
    module: "screening",
    jobId: "job-1",
    executionProfileId: "profile-1",
    moduleTemplateId: "template-1",
    moduleTemplateVersionNo: 3,
    promptTemplateId: "prompt-1",
    promptTemplateVersion: "1.2.0",
    skillPackageIds: ["skill-1"],
    skillPackageVersions: ["2.0.0"],
    modelId: "model-1",
    modelVersion: "2026-03",
    createdAssetIds: ["asset-1"],
    knowledgeHits: [
      {
        knowledgeItemId: "knowledge-1",
        matchSourceId: "rule-1",
        bindingRuleId: "rule-1",
        matchSource: "binding_rule",
        matchReasons: ["template_family", "risk_tag"],
      },
      {
        knowledgeItemId: "knowledge-2",
        matchSourceId: "template-binding-1",
        matchSource: "template_binding",
        matchReasons: ["module_template"],
      },
    ],
  });

  const hitLogs = await repository.listKnowledgeHitLogsBySnapshotId(snapshot.id);

  assert.equal(snapshot.knowledge_item_ids[0], "knowledge-1");
  assert.equal(snapshot.module_template_version_no, 3);
  assert.equal(snapshot.prompt_template_version, "1.2.0");
  assert.equal(snapshot.model_version, "2026-03");
  assert.equal(hitLogs.length, 2);
  assert.deepEqual(hitLogs[0]?.match_reasons, ["template_family", "risk_tag"]);
  assert.equal(hitLogs[1]?.match_source, "template_binding");
});

test("knowledge hit logs preserve source ids for audit joins", async () => {
  const { repository, service } = createExecutionTrackingHarness();

  const snapshot = await service.recordSnapshot({
    manuscriptId: "manuscript-2",
    module: "editing",
    jobId: "job-2",
    executionProfileId: "profile-2",
    moduleTemplateId: "template-2",
    moduleTemplateVersionNo: 1,
    promptTemplateId: "prompt-2",
    promptTemplateVersion: "1.0.0",
    skillPackageIds: ["skill-2"],
    skillPackageVersions: ["1.0.0"],
    modelId: "model-2",
    createdAssetIds: ["asset-2"],
    knowledgeHits: [
      {
        knowledgeItemId: "knowledge-9",
        matchSourceId: "template-binding-9",
        matchSource: "template_binding",
        matchReasons: ["section"],
        section: "Methods",
        score: 0.98,
      },
    ],
  });

  const hitLogs = await repository.listKnowledgeHitLogsBySnapshotId(snapshot.id);

  assert.equal(hitLogs[0]?.match_source_id, "template-binding-9");
  assert.equal(hitLogs[0]?.section, "Methods");
  assert.equal(hitLogs[0]?.score, 0.98);
});

test("execution tracking api enriches snapshot create and get responses with runtime binding readiness derived from execution profile scope", async () => {
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
      version: 2,
      runtime_id: "runtime-1",
      sandbox_profile_id: "sandbox-1",
      agent_profile_id: "agent-profile-1",
      tool_permission_policy_id: "policy-1",
      prompt_template_id: "prompt-1",
      skill_package_ids: ["skill-1"],
      execution_profile_id: "profile-1",
      verification_check_profile_ids: ["check-1"],
      evaluation_suite_ids: ["suite-1"],
      release_check_profile_id: "release-1",
    },
    issues: [],
    execution_profile_alignment: {
      status: "aligned",
      binding_execution_profile_id: "profile-1",
      active_execution_profile_id: "profile-1",
    },
  };
  const { api } = createExecutionTrackingHarness({
    executionGovernanceRepository: {
      async findProfileById(id) {
        assert.equal(id, "profile-1");
        return {
          id,
          module: "editing",
          manuscript_type: "clinical_study",
          template_family_id: "family-1",
          module_template_id: "template-1",
          prompt_template_id: "prompt-1",
          skill_package_ids: ["skill-1"],
          knowledge_binding_mode: "profile_only",
          status: "active",
          version: 1,
        };
      },
    },
    runtimeBindingReadinessService: {
      async getActiveBindingReadinessForScope(scope) {
        assert.deepEqual(scope, readinessReport.scope);
        return readinessReport;
      },
    },
  });

  const created = await api.recordSnapshot({
    input: {
      manuscriptId: "manuscript-3",
      module: "editing",
      jobId: "job-3",
      executionProfileId: "profile-1",
      moduleTemplateId: "template-1",
      moduleTemplateVersionNo: 4,
      promptTemplateId: "prompt-1",
      promptTemplateVersion: "1.0.0",
      skillPackageIds: ["skill-1"],
      skillPackageVersions: ["1.0.0"],
      modelId: "model-1",
      knowledgeHits: [],
    },
  });

  const loaded = await api.getSnapshot({
    snapshotId: created.body.id,
  });

  assert.equal(created.status, 201);
  assert.equal(
    created.body.runtime_binding_readiness.observation_status,
    "reported",
  );
  assert.deepEqual(created.body.runtime_binding_readiness.report, readinessReport);
  assert.equal(loaded.status, 200);
  assert.equal(
    loaded.body?.runtime_binding_readiness.observation_status,
    "reported",
  );
  assert.deepEqual(loaded.body?.runtime_binding_readiness.report, readinessReport);
});

test("execution tracking api fails open when snapshot readiness cannot recover execution profile scope", async () => {
  const { api } = createExecutionTrackingHarness({
    executionGovernanceRepository: {
      async findProfileById(id) {
        assert.equal(id, "profile-missing");
        return undefined;
      },
    },
    runtimeBindingReadinessService: {
      async getActiveBindingReadinessForScope() {
        throw new Error("should not be called when profile lookup fails");
      },
    },
  });

  const created = await api.recordSnapshot({
    input: {
      manuscriptId: "manuscript-4",
      module: "screening",
      jobId: "job-4",
      executionProfileId: "profile-missing",
      moduleTemplateId: "template-4",
      moduleTemplateVersionNo: 1,
      promptTemplateId: "prompt-4",
      promptTemplateVersion: "1.0.0",
      skillPackageIds: [],
      skillPackageVersions: [],
      modelId: "model-4",
      knowledgeHits: [],
    },
  });

  assert.equal(created.status, 201);
  assert.equal(
    created.body.runtime_binding_readiness.observation_status,
    "failed_open",
  );
  assert.match(
    created.body.runtime_binding_readiness.error ?? "",
    /profile-missing/,
  );
  assert.equal(created.body.runtime_binding_readiness.report, undefined);
});

test("execution tracking api fails open when runtime binding readiness observation throws unexpectedly", async () => {
  const { api } = createExecutionTrackingHarness({
    executionGovernanceRepository: {
      async findProfileById() {
        return {
          id: "profile-5",
          module: "editing",
          manuscript_type: "clinical_study",
          template_family_id: "family-5",
          module_template_id: "template-5",
          prompt_template_id: "prompt-5",
          skill_package_ids: [],
          knowledge_binding_mode: "profile_only",
          status: "active",
          version: 1,
        };
      },
    },
    runtimeBindingReadinessService: {
      async getActiveBindingReadinessForScope() {
        throw new Error("snapshot readiness exploded");
      },
    },
  });

  const created = await api.recordSnapshot({
    input: {
      manuscriptId: "manuscript-5",
      module: "editing",
      jobId: "job-5",
      executionProfileId: "profile-5",
      moduleTemplateId: "template-5",
      moduleTemplateVersionNo: 1,
      promptTemplateId: "prompt-5",
      promptTemplateVersion: "1.0.0",
      skillPackageIds: [],
      skillPackageVersions: [],
      modelId: "model-5",
      knowledgeHits: [],
    },
  });

  assert.equal(created.status, 201);
  assert.equal(
    created.body.runtime_binding_readiness.observation_status,
    "failed_open",
  );
  assert.equal(
    created.body.runtime_binding_readiness.error,
    "snapshot readiness exploded",
  );
  assert.equal(created.body.runtime_binding_readiness.report, undefined);
});
