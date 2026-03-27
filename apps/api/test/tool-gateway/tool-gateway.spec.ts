import test from "node:test";
import assert from "node:assert/strict";
import { AuthorizationError } from "../../src/auth/permission-guard.ts";
import { createToolGatewayApi } from "../../src/modules/tool-gateway/tool-gateway-api.ts";
import { InMemoryToolGatewayRepository } from "../../src/modules/tool-gateway/in-memory-tool-gateway-repository.ts";
import { ToolGatewayService } from "../../src/modules/tool-gateway/tool-gateway-service.ts";

function createToolGatewayHarness() {
  const service = new ToolGatewayService({
    repository: new InMemoryToolGatewayRepository(),
    createId: () => "tool-1",
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
