import test from "node:test";
import assert from "node:assert/strict";
import { AuthorizationError } from "../../src/auth/permission-guard.ts";
import { createAgentRuntimeApi } from "../../src/modules/agent-runtime/agent-runtime-api.ts";
import { InMemoryAgentRuntimeRepository } from "../../src/modules/agent-runtime/in-memory-agent-runtime-repository.ts";
import { AgentRuntimeService } from "../../src/modules/agent-runtime/agent-runtime-service.ts";

function createAgentRuntimeHarness() {
  const service = new AgentRuntimeService({
    repository: new InMemoryAgentRuntimeRepository(),
    createId: () => "runtime-1",
  });
  const api = createAgentRuntimeApi({
    agentRuntimeService: service,
  });

  return {
    api,
  };
}

test("only admin can create or archive an agent runtime entry", async () => {
  const { api } = createAgentRuntimeHarness();
  const runtimeInput = {
    name: "Deep Agents Runtime",
    adapter: "deepagents" as const,
    sandboxProfileId: "sandbox-eval",
    allowedModules: ["screening", "editing"],
  };

  await assert.rejects(
    () =>
      api.createRuntime({
        actorRole: "editor",
        input: runtimeInput,
      }),
    AuthorizationError,
  );

  const created = await api.createRuntime({
    actorRole: "admin",
    input: runtimeInput,
  });

  assert.equal(created.status, 201);
  assert.equal(created.body.status, "draft");
  assert.equal(created.body.admin_only, true);
  assert.deepEqual(created.body.allowed_modules, ["screening", "editing"]);

  const archived = await api.archiveRuntime({
    actorRole: "admin",
    runtimeId: created.body.id,
  });

  assert.equal(archived.status, 200);
  assert.equal(archived.body.status, "archived");
});
