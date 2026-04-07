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

test("system settings controller loads account overview from the user list endpoint", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createSystemSettingsWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

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
    ["GET /api/v1/system-settings/users"],
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
      "POST /api/v1/system-settings/users/editor-1/enable",
      "GET /api/v1/system-settings/users",
    ],
  );
});
