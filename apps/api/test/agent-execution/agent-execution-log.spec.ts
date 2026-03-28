import test from "node:test";
import assert from "node:assert/strict";
import { createAgentExecutionApi } from "../../src/modules/agent-execution/agent-execution-api.ts";
import { InMemoryAgentExecutionRepository } from "../../src/modules/agent-execution/in-memory-agent-execution-repository.ts";
import {
  AgentExecutionService,
  type CreateAgentExecutionLogInput,
} from "../../src/modules/agent-execution/agent-execution-service.ts";

function createAgentExecutionHarness() {
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
  });

  return {
    api,
  };
}

test("agent execution logs capture governed runtime metadata and can be completed with snapshot evidence", async () => {
  const { api } = createAgentExecutionHarness();
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
  assert.deepEqual(created.body.verification_evidence_ids, []);

  const completed = await api.completeLog({
    logId: created.body.id,
    executionSnapshotId: "snapshot-1",
    verificationEvidenceIds: ["evidence-1", "evidence-2"],
  });

  assert.equal(completed.status, 200);
  assert.equal(completed.body.status, "completed");
  assert.equal(completed.body.execution_snapshot_id, "snapshot-1");
  assert.deepEqual(completed.body.verification_evidence_ids, [
    "evidence-1",
    "evidence-2",
  ]);
  assert.equal(completed.body.finished_at, "2026-03-28T13:00:00.000Z");
});
