import test from "node:test";
import assert from "node:assert/strict";
import { AuthorizationError } from "../../src/auth/permission-guard.ts";
import { createToolGatewayApi } from "../../src/modules/tool-gateway/tool-gateway-api.ts";
import { InMemoryToolGatewayRepository } from "../../src/modules/tool-gateway/in-memory-tool-gateway-repository.ts";
import { ToolGatewayService } from "../../src/modules/tool-gateway/tool-gateway-service.ts";

function createToolGatewayHarness() {
  const ids = ["tool-1", "tool-2", "tool-3"];
  const service = new ToolGatewayService({
    repository: new InMemoryToolGatewayRepository(),
    createId: () => {
      const value = ids.shift();
      assert.ok(value, "Expected a tool gateway id to be available.");
      return value;
    },
  });
  const api = createToolGatewayApi({
    toolGatewayService: service,
  });

  return {
    api,
  };
}

test("tool gateway stores admin-approved read/write policies and defaults to read-only", async () => {
  const { api } = createToolGatewayHarness();

  await assert.rejects(
    () =>
      api.createTool({
        actorRole: "editor",
        input: {
          name: "knowledge.search",
          scope: "knowledge",
        },
      }),
    AuthorizationError,
  );

  const created = await api.createTool({
    actorRole: "admin",
    input: {
      name: "knowledge.search",
      scope: "knowledge",
    },
  });

  assert.equal(created.status, 201);
  assert.equal(created.body.access_mode, "read");
  assert.equal(created.body.admin_only, true);
});

test("tool gateway supports phase 4 verification scopes and can filter tools by scope", async () => {
  const { api } = createToolGatewayHarness();

  await api.createTool({
    actorRole: "admin",
    input: {
      name: "gstack.browser-qa",
      scope: "browser_qa",
    },
  });
  await api.createTool({
    actorRole: "admin",
    input: {
      name: "gstack.benchmark",
      scope: "benchmark",
      accessMode: "write",
    },
  });
  await api.createTool({
    actorRole: "admin",
    input: {
      name: "gstack.deploy-verify",
      scope: "deploy_verification",
    },
  });

  const browserTools = await api.listToolsByScope({
    scope: "browser_qa",
  });
  const releaseTools = await api.listToolsByScope({
    scope: "deploy_verification",
  });

  assert.deepEqual(browserTools.body.map((record) => record.name), [
    "gstack.browser-qa",
  ]);
  assert.deepEqual(releaseTools.body.map((record) => record.name), [
    "gstack.deploy-verify",
  ]);
});
