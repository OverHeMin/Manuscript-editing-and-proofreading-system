import test from "node:test";
import assert from "node:assert/strict";
import { ExecutionTrackingService } from "../../src/modules/execution-tracking/execution-tracking-service.ts";
import { InMemoryExecutionTrackingRepository } from "../../src/modules/execution-tracking/in-memory-execution-tracking-repository.ts";

function createExecutionTrackingHarness() {
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

  return {
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
