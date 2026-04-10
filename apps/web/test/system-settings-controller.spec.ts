import assert from "node:assert/strict";
import test from "node:test";
import {
  createSystemSettingsWorkbenchController,
} from "../src/features/system-settings/system-settings-controller.ts";

const baseUsers = [
  {
    id: "admin-1",
    username: "admin.one",
    displayName: "主管理员",
    role: "admin",
    status: "active",
    createdAt: "2026-04-07T09:00:00.000Z",
    updatedAt: "2026-04-07T09:00:00.000Z",
  },
  {
    id: "editor-1",
    username: "editor.one",
    displayName: "编辑一号",
    role: "editor",
    status: "active",
    createdAt: "2026-04-07T09:05:00.000Z",
    updatedAt: "2026-04-07T09:05:00.000Z",
  },
  {
    id: "proofreader-1",
    username: "proofreader.one",
    displayName: "校对一号",
    role: "proofreader",
    status: "disabled",
    createdAt: "2026-04-07T09:10:00.000Z",
    updatedAt: "2026-04-07T09:10:00.000Z",
  },
] as const;

const baseProviderConnections = [
  {
    id: "provider-qwen-1",
    name: "Qwen Production",
    provider_kind: "qwen",
    compatibility_mode: "openai_chat_compatible",
    base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    enabled: true,
    connection_metadata: {
      test_model_name: "qwen-max",
    },
    last_test_status: "passed",
    last_test_at: "2026-04-10T08:00:00.000Z",
    credential_summary: {
      mask: "sk-***a562",
      version: 1,
    },
  },
  {
    id: "provider-deepseek-1",
    name: "DeepSeek Staging",
    provider_kind: "deepseek",
    compatibility_mode: "openai_chat_compatible",
    base_url: "https://api.deepseek.com",
    enabled: false,
    connection_metadata: {
      test_model_name: "deepseek-chat",
    },
    last_test_status: "failed",
    last_error_summary: "HTTP 401",
    credential_summary: {
      mask: "sk-***c101",
      version: 3,
    },
  },
] as const;

test("system settings controller loads account overview from the user list endpoint", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createSystemSettingsWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.url === "/api/v1/system-settings/ai-providers") {
        return {
          status: 200,
          body: [] as TResponse,
        };
      }

      return {
        status: 200,
        body: [...baseUsers] as TResponse,
      };
    },
  });

  const overview = await controller.loadOverview();

  assert.equal(overview.summary.totalUsers, 3);
  assert.equal(overview.summary.activeUsers, 2);
  assert.equal(overview.summary.disabledUsers, 1);
  assert.equal(overview.summary.adminUsers, 1);
  assert.equal(overview.selectedUserId, "admin-1");
  assert.equal(overview.selectedUser?.username, "admin.one");
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "GET /api/v1/system-settings/users",
      "GET /api/v1/system-settings/ai-providers",
    ],
  );
});

test("system settings controller creates a user and reloads around the new selection", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createSystemSettingsWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.method === "POST" && input.url === "/api/v1/system-settings/users") {
        return {
          status: 201,
          body: {
            id: "editor-2",
            username: "editor.two",
            displayName: "编辑二号",
            role: "editor",
            status: "active",
            createdAt: "2026-04-07T10:00:00.000Z",
            updatedAt: "2026-04-07T10:00:00.000Z",
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/system-settings/ai-providers") {
        return {
          status: 200,
          body: [] as TResponse,
        };
      }

      return {
        status: 200,
        body: [
          ...baseUsers,
          {
            id: "editor-2",
            username: "editor.two",
            displayName: "编辑二号",
            role: "editor",
            status: "active",
            createdAt: "2026-04-07T10:00:00.000Z",
            updatedAt: "2026-04-07T10:00:00.000Z",
          },
        ] as TResponse,
      };
    },
  });

  const result = await controller.createUserAndReload({
    username: "editor.two",
    displayName: "编辑二号",
    role: "editor",
    password: "secret-123",
  });

  assert.equal(result.createdUser.id, "editor-2");
  assert.equal(result.overview.selectedUserId, "editor-2");
  assert.equal(result.overview.selectedUser?.displayName, "编辑二号");
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "POST /api/v1/system-settings/users",
      "GET /api/v1/system-settings/users",
      "GET /api/v1/system-settings/ai-providers",
    ],
  );
  assert.deepEqual(requests[0]?.body, {
    username: "editor.two",
    displayName: "编辑二号",
    role: "editor",
    password: "secret-123",
  });
});

test("system settings controller updates the selected user profile and reloads with the same selection", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createSystemSettingsWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (
        input.method === "POST" &&
        input.url === "/api/v1/system-settings/users/editor-1/profile"
      ) {
        return {
          status: 200,
          body: {
            ...baseUsers[1],
            displayName: "编辑主管",
            role: "proofreader",
            updatedAt: "2026-04-07T10:30:00.000Z",
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/system-settings/ai-providers") {
        return {
          status: 200,
          body: [] as TResponse,
        };
      }

      return {
        status: 200,
        body: [
          baseUsers[0],
          {
            ...baseUsers[1],
            displayName: "编辑主管",
            role: "proofreader",
            updatedAt: "2026-04-07T10:30:00.000Z",
          },
          baseUsers[2],
        ] as TResponse,
      };
    },
  });

  const result = await controller.updateUserProfileAndReload({
    userId: "editor-1",
    input: {
      displayName: "编辑主管",
      role: "proofreader",
    },
    selectedUserId: "editor-1",
  });

  assert.equal(result.updatedUser.role, "proofreader");
  assert.equal(result.overview.selectedUserId, "editor-1");
  assert.equal(result.overview.selectedUser?.displayName, "编辑主管");
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "POST /api/v1/system-settings/users/editor-1/profile",
      "GET /api/v1/system-settings/users",
      "GET /api/v1/system-settings/ai-providers",
    ],
  );
  assert.deepEqual(requests[0]?.body, {
    displayName: "编辑主管",
    role: "proofreader",
  });
});

test("system settings controller resets a password and reloads the current selection", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createSystemSettingsWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (
        input.method === "POST" &&
        input.url === "/api/v1/system-settings/users/editor-1/reset-password"
      ) {
        return {
          status: 200,
          body: {
            ...baseUsers[1],
            updatedAt: "2026-04-07T10:40:00.000Z",
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/system-settings/ai-providers") {
        return {
          status: 200,
          body: [] as TResponse,
        };
      }

      return {
        status: 200,
        body: [
          baseUsers[0],
          {
            ...baseUsers[1],
            updatedAt: "2026-04-07T10:40:00.000Z",
          },
          baseUsers[2],
        ] as TResponse,
      };
    },
  });

  const result = await controller.resetUserPasswordAndReload({
    userId: "editor-1",
    nextPassword: "reset-456",
    selectedUserId: "editor-1",
  });

  assert.equal(result.updatedUser.id, "editor-1");
  assert.equal(result.overview.selectedUserId, "editor-1");
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "POST /api/v1/system-settings/users/editor-1/reset-password",
      "GET /api/v1/system-settings/users",
      "GET /api/v1/system-settings/ai-providers",
    ],
  );
  assert.deepEqual(requests[0]?.body, {
    nextPassword: "reset-456",
  });
});

test("system settings controller disables and re-enables a user while keeping the selection stable", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  let disabled = false;
  const controller = createSystemSettingsWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (
        input.method === "POST" &&
        input.url === "/api/v1/system-settings/users/editor-1/disable"
      ) {
        disabled = true;
        return {
          status: 200,
          body: {
            ...baseUsers[1],
            status: "disabled",
            updatedAt: "2026-04-07T10:50:00.000Z",
          } as TResponse,
        };
      }

      if (
        input.method === "POST" &&
        input.url === "/api/v1/system-settings/users/editor-1/enable"
      ) {
        disabled = false;
        return {
          status: 200,
          body: {
            ...baseUsers[1],
            status: "active",
            updatedAt: "2026-04-07T10:55:00.000Z",
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/system-settings/ai-providers") {
        return {
          status: 200,
          body: [] as TResponse,
        };
      }

      return {
        status: 200,
        body: [
          baseUsers[0],
          {
            ...baseUsers[1],
            status: disabled ? "disabled" : "active",
            updatedAt: disabled
              ? "2026-04-07T10:50:00.000Z"
              : "2026-04-07T10:55:00.000Z",
          },
          baseUsers[2],
        ] as TResponse,
      };
    },
  });

  const disabledResult = await controller.disableUserAndReload({
    userId: "editor-1",
    selectedUserId: "editor-1",
  });
  const enabledResult = await controller.enableUserAndReload({
    userId: "editor-1",
    selectedUserId: "editor-1",
  });

  assert.equal(disabledResult.updatedUser.status, "disabled");
  assert.equal(disabledResult.overview.selectedUser?.status, "disabled");
  assert.equal(enabledResult.updatedUser.status, "active");
  assert.equal(enabledResult.overview.selectedUser?.status, "active");
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "POST /api/v1/system-settings/users/editor-1/disable",
      "GET /api/v1/system-settings/users",
      "GET /api/v1/system-settings/ai-providers",
      "POST /api/v1/system-settings/users/editor-1/enable",
      "GET /api/v1/system-settings/users",
      "GET /api/v1/system-settings/ai-providers",
    ],
  );
});

test("system settings controller loads ai provider connections alongside the account overview", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createSystemSettingsWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.url === "/api/v1/system-settings/ai-providers") {
        return {
          status: 200,
          body: [...baseProviderConnections] as TResponse,
        };
      }

      return {
        status: 200,
        body: [...baseUsers] as TResponse,
      };
    },
  });

  const overview = await controller.loadOverview();
  const providerOverview = overview as typeof overview & {
    providerConnections?: Array<{ id: string; name: string }>;
    selectedConnectionId?: string | null;
    selectedConnection?: { id: string; name: string } | null;
  };

  assert.deepEqual(
    providerOverview.providerConnections?.map((connection) => connection.id),
    ["provider-qwen-1", "provider-deepseek-1"],
  );
  assert.equal(providerOverview.selectedConnectionId, "provider-qwen-1");
  assert.equal(providerOverview.selectedConnection?.name, "Qwen Production");
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "GET /api/v1/system-settings/users",
      "GET /api/v1/system-settings/ai-providers",
    ],
  );
});

test("system settings controller creates an ai provider connection and reloads around the new selection", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createSystemSettingsWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.method === "POST" && input.url === "/api/v1/system-settings/ai-providers") {
        return {
          status: 201,
          body: {
            id: "provider-qwen-2",
            name: "Qwen Fallback",
            provider_kind: "qwen",
            compatibility_mode: "openai_chat_compatible",
            base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
            enabled: true,
            connection_metadata: {
              test_model_name: "qwen-plus",
            },
            last_test_status: "unknown",
            credential_summary: {
              mask: "sk-***z999",
              version: 1,
            },
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/system-settings/ai-providers") {
        return {
          status: 200,
          body: [
            ...baseProviderConnections,
            {
              id: "provider-qwen-2",
              name: "Qwen Fallback",
              provider_kind: "qwen",
              compatibility_mode: "openai_chat_compatible",
              base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
              enabled: true,
              connection_metadata: {
                test_model_name: "qwen-plus",
              },
              last_test_status: "unknown",
              credential_summary: {
                mask: "sk-***z999",
                version: 1,
              },
            },
          ] as TResponse,
        };
      }

      return {
        status: 200,
        body: [...baseUsers] as TResponse,
      };
    },
  });

  const result = await (controller as typeof controller & {
    createProviderConnectionAndReload: (input: {
      name: string;
      providerKind: string;
      baseUrl: string;
      testModelName: string;
      apiKey: string;
      enabled: boolean;
    }) => Promise<{
      createdConnection: { id: string };
      overview: {
        selectedConnectionId?: string | null;
        selectedConnection?: { name: string } | null;
      };
    }>;
  }).createProviderConnectionAndReload({
    name: "Qwen Fallback",
    providerKind: "qwen",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    testModelName: "qwen-plus",
    apiKey: "secret-key",
    enabled: true,
  });

  assert.equal(result.createdConnection.id, "provider-qwen-2");
  assert.equal(result.overview.selectedConnectionId, "provider-qwen-2");
  assert.equal(result.overview.selectedConnection?.name, "Qwen Fallback");
  assert.deepEqual(requests[0]?.body, {
    name: "Qwen Fallback",
    provider_kind: "qwen",
    base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    enabled: true,
    connection_metadata: {
      test_model_name: "qwen-plus",
    },
    credentials: {
      apiKey: "secret-key",
    },
  });
});

test("system settings controller rotates and tests the selected ai provider connection before reloading it", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  let credentialVersion = 2;
  let lastTestStatus = "passed";
  const controller = createSystemSettingsWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (
        input.method === "POST" &&
        input.url === "/api/v1/system-settings/ai-providers/provider-qwen-1/rotate-credential"
      ) {
        credentialVersion += 1;
        return {
          status: 200,
          body: {
            ...baseProviderConnections[0],
            credential_summary: {
              mask: "sk-***b777",
              version: credentialVersion,
            },
          } as TResponse,
        };
      }

      if (
        input.method === "POST" &&
        input.url === "/api/v1/system-settings/ai-providers/provider-qwen-1/test"
      ) {
        lastTestStatus = "failed";
        return {
          status: 200,
          body: {
            ...baseProviderConnections[0],
            last_test_status: "failed",
            last_test_at: "2026-04-10T09:30:00.000Z",
            last_error_summary: "HTTP 429",
            credential_summary: {
              mask: "sk-***b777",
              version: credentialVersion,
            },
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/system-settings/ai-providers") {
        return {
          status: 200,
          body: [
            {
              ...baseProviderConnections[0],
              last_test_status: lastTestStatus,
              ...(lastTestStatus === "failed"
                ? {
                    last_test_at: "2026-04-10T09:30:00.000Z",
                    last_error_summary: "HTTP 429",
                  }
                : {}),
              credential_summary: {
                mask: "sk-***b777",
                version: credentialVersion,
              },
            },
            baseProviderConnections[1],
          ] as TResponse,
        };
      }

      return {
        status: 200,
        body: [...baseUsers] as TResponse,
      };
    },
  });

  const rotateResult = await (controller as typeof controller & {
    rotateProviderCredentialAndReload: (input: {
      connectionId: string;
      nextApiKey: string;
      selectedConnectionId?: string | null;
    }) => Promise<{
      updatedConnection: { credential_summary?: { version: number } };
      overview: { selectedConnection?: { credential_summary?: { version: number } } | null };
    }>;
  }).rotateProviderCredentialAndReload({
    connectionId: "provider-qwen-1",
    nextApiKey: "rotated-secret",
    selectedConnectionId: "provider-qwen-1",
  });

  const testResult = await (controller as typeof controller & {
    testProviderConnectionAndReload: (input: {
      connectionId: string;
      testModelName: string;
      selectedConnectionId?: string | null;
    }) => Promise<{
      updatedConnection: {
        last_test_status?: string;
        last_error_summary?: string;
      };
      overview: {
        selectedConnection?: {
          last_test_status?: string;
          last_error_summary?: string;
        } | null;
      };
    }>;
  }).testProviderConnectionAndReload({
    connectionId: "provider-qwen-1",
    testModelName: "qwen-max",
    selectedConnectionId: "provider-qwen-1",
  });

  assert.equal(rotateResult.updatedConnection.credential_summary?.version, 3);
  assert.equal(rotateResult.overview.selectedConnection?.credential_summary?.version, 3);
  assert.equal(testResult.updatedConnection.last_test_status, "failed");
  assert.equal(testResult.overview.selectedConnection?.last_error_summary, "HTTP 429");
  assert.deepEqual(
    requests
      .filter((request) => request.method === "POST")
      .map((request) => ({ url: request.url, body: request.body })),
    [
      {
        url: "/api/v1/system-settings/ai-providers/provider-qwen-1/rotate-credential",
        body: {
          credentials: {
            apiKey: "rotated-secret",
          },
        },
      },
      {
        url: "/api/v1/system-settings/ai-providers/provider-qwen-1/test",
        body: {
          connection_metadata: {
            test_model_name: "qwen-max",
          },
        },
      },
    ],
  );
});
