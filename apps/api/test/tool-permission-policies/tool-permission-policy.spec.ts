import test from "node:test";
import assert from "node:assert/strict";
import { AuthorizationError } from "../../src/auth/permission-guard.ts";
import { createToolGatewayApi } from "../../src/modules/tool-gateway/tool-gateway-api.ts";
import { InMemoryToolGatewayRepository } from "../../src/modules/tool-gateway/in-memory-tool-gateway-repository.ts";
import { ToolGatewayService } from "../../src/modules/tool-gateway/tool-gateway-service.ts";
import { createToolPermissionPolicyApi } from "../../src/modules/tool-permission-policies/tool-permission-policy-api.ts";
import { InMemoryToolPermissionPolicyRepository } from "../../src/modules/tool-permission-policies/in-memory-tool-permission-policy-repository.ts";
import {
  ToolPermissionPolicyService,
  type CreateToolPermissionPolicyInput,
} from "../../src/modules/tool-permission-policies/tool-permission-policy-service.ts";

function createToolPermissionPolicyHarness() {
  const ids = {
    tool: ["tool-1", "tool-2", "tool-3"],
    policy: ["policy-1", "policy-2"],
  };
  const toolGatewayRepository = new InMemoryToolGatewayRepository();
  const toolGatewayApi = createToolGatewayApi({
    toolGatewayService: new ToolGatewayService({
      repository: toolGatewayRepository,
      createId: () => {
        const value = ids.tool.shift();
        assert.ok(value, "Expected a tool id to be available.");
        return value;
      },
    }),
  });
  const toolPermissionPolicyApi = createToolPermissionPolicyApi({
    toolPermissionPolicyService: new ToolPermissionPolicyService({
      repository: new InMemoryToolPermissionPolicyRepository(),
      toolGatewayRepository,
      createId: () => {
        const value = ids.policy.shift();
        assert.ok(value, "Expected a tool permission policy id to be available.");
        return value;
      },
    }),
  });

  return {
    toolGatewayApi,
    toolPermissionPolicyApi,
  };
}

test("tool permission policies are admin-only and default to read-first execution", async () => {
  const { toolGatewayApi, toolPermissionPolicyApi } =
    createToolPermissionPolicyHarness();

  const tool = await toolGatewayApi.createTool({
    actorRole: "admin",
    input: {
      name: "knowledge.search",
      scope: "knowledge",
    },
  });

  const input: CreateToolPermissionPolicyInput = {
    name: "Read First Policy",
    allowedToolIds: [tool.body.id],
    highRiskToolIds: [],
  };

  await assert.rejects(
    () =>
      toolPermissionPolicyApi.createPolicy({
        actorRole: "editor",
        input,
      }),
    AuthorizationError,
  );

  const created = await toolPermissionPolicyApi.createPolicy({
    actorRole: "admin",
    input,
  });

  assert.equal(created.status, 201);
  assert.equal(created.body.status, "draft");
  assert.equal(created.body.default_mode, "read");
  assert.equal(created.body.write_requires_confirmation, true);

  const activated = await toolPermissionPolicyApi.activatePolicy({
    actorRole: "admin",
    policyId: created.body.id,
  });

  assert.equal(activated.status, 200);
  assert.equal(activated.body.status, "active");
});

test("high-risk tools must be explicitly allowlisted before a policy can activate", async () => {
  const { toolGatewayApi, toolPermissionPolicyApi } =
    createToolPermissionPolicyHarness();

  const readTool = await toolGatewayApi.createTool({
    actorRole: "admin",
    input: {
      name: "knowledge.search",
      scope: "knowledge",
    },
  });
  const highRiskTool = await toolGatewayApi.createTool({
    actorRole: "admin",
    input: {
      name: "assets.write",
      scope: "assets",
      accessMode: "write",
    },
  });

  const created = await toolPermissionPolicyApi.createPolicy({
    actorRole: "admin",
    input: {
      name: "Restricted Write Policy",
      allowedToolIds: [readTool.body.id],
      highRiskToolIds: [highRiskTool.body.id],
    },
  });

  await assert.rejects(
    () =>
      toolPermissionPolicyApi.activatePolicy({
        actorRole: "admin",
        policyId: created.body.id,
      }),
    /allowlist|high-risk/i,
  );
});
