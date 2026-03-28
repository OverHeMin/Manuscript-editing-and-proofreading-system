import test from "node:test";
import assert from "node:assert/strict";
import { AuthorizationError } from "../../src/auth/permission-guard.ts";
import { createAgentRuntimeApi } from "../../src/modules/agent-runtime/agent-runtime-api.ts";
import { InMemoryAgentRuntimeRepository } from "../../src/modules/agent-runtime/in-memory-agent-runtime-repository.ts";
import {
  AgentRuntimeService,
  type CreateAgentRuntimeInput,
} from "../../src/modules/agent-runtime/agent-runtime-service.ts";

function createAgentRuntimeHarness() {
  const ids = ["runtime-1", "runtime-2"];
  const service = new AgentRuntimeService({
    repository: new InMemoryAgentRuntimeRepository(),
    createId: () => {
      const value = ids.shift();
      assert.ok(value, "Expected an agent runtime id to be available.");
      return value;
    },
  });
  const api = createAgentRuntimeApi({
    agentRuntimeService: service,
  });

  return {
    api,
  };
}

test("only admin can create publish and archive an agent runtime entry", async () => {
  const { api } = createAgentRuntimeHarness();
  const runtimeInput: CreateAgentRuntimeInput = {
    name: "Deep Agents Runtime",
    adapter: "deepagents",
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

  await assert.rejects(
    () =>
      api.publishRuntime({
        actorRole: "editor",
        runtimeId: created.body.id,
      }),
    AuthorizationError,
  );

  const published = await api.publishRuntime({
    actorRole: "admin",
    runtimeId: created.body.id,
  });

  assert.equal(published.status, 200);
  assert.equal(published.body.status, "active");

  const archived = await api.archiveRuntime({
    actorRole: "admin",
    runtimeId: created.body.id,
  });

  assert.equal(archived.status, 200);
  assert.equal(archived.body.status, "archived");
});

test("publishing a runtime archives the previous active runtime for the same adapter and runtime lookups can be filtered by module", async () => {
  const { api } = createAgentRuntimeHarness();

  const first = await api.createRuntime({
    actorRole: "admin",
    input: {
      name: "Deep Agents Runtime V1",
      adapter: "deepagents",
      sandboxProfileId: "sandbox-safe",
      allowedModules: ["screening"],
    },
  });
  await api.publishRuntime({
    actorRole: "admin",
    runtimeId: first.body.id,
  });

  const second = await api.createRuntime({
    actorRole: "admin",
    input: {
      name: "Deep Agents Runtime V2",
      adapter: "deepagents",
      sandboxProfileId: "sandbox-safe",
      allowedModules: ["screening", "editing"],
    },
  });
  const secondPublished = await api.publishRuntime({
    actorRole: "admin",
    runtimeId: second.body.id,
  });

  const activeForEditing = await api.listRuntimesByModule({
    module: "editing",
    activeOnly: true,
  });
  const activeForScreening = await api.listRuntimesByModule({
    module: "screening",
    activeOnly: true,
  });
  const firstReloaded = await api.getRuntime({
    runtimeId: first.body.id,
  });

  assert.equal(secondPublished.body.status, "active");
  assert.equal(activeForEditing.status, 200);
  assert.deepEqual(activeForEditing.body.map((record) => record.id), ["runtime-2"]);
  assert.deepEqual(activeForScreening.body.map((record) => record.id), ["runtime-2"]);
  assert.equal(firstReloaded.body.status, "archived");
});
