import test from "node:test";
import assert from "node:assert/strict";
import { BrowserHttpClientError } from "../src/lib/browser-http-client.ts";
import {
  bootstrapPersistentWorkbenchSession,
  loginPersistentWorkbenchSession,
  logoutPersistentWorkbenchSession,
  resolveWorkbenchRuntimeMode,
} from "../src/app/persistent-session.ts";
import { buildAuthSessionViewModel } from "../src/features/auth/index.ts";

test("workbench runtime mode treats local as demo and non-local envs as persistent", () => {
  assert.equal(resolveWorkbenchRuntimeMode({ VITE_APP_ENV: "local" }), "demo");
  assert.equal(resolveWorkbenchRuntimeMode({ VITE_APP_ENV: "dev" }), "persistent");
  assert.equal(resolveWorkbenchRuntimeMode({ VITE_APP_ENV: "staging" }), "persistent");
  assert.equal(resolveWorkbenchRuntimeMode({ VITE_APP_ENV: "prod" }), "persistent");
  assert.equal(resolveWorkbenchRuntimeMode({}), "demo");
});

test("persistent session bootstrap maps backend session payload into workbench session", async () => {
  const session = await bootstrapPersistentWorkbenchSession({
    request: async () => ({
      status: 200,
      body: {
        provider: "local",
        user: {
          id: "persistent-knowledge-reviewer",
          username: "persistent.reviewer",
          displayName: "Persistent Reviewer",
          role: "knowledge_reviewer",
        },
        issuedAt: "2026-03-30T10:00:00.000Z",
        expiresAt: "2026-03-30T18:00:00.000Z",
        refreshAt: "2026-03-30T10:30:00.000Z",
      },
    }),
  });

  assert.deepEqual(
    session,
    buildAuthSessionViewModel({
      userId: "persistent-knowledge-reviewer",
      username: "persistent.reviewer",
      displayName: "Persistent Reviewer",
      role: "knowledge_reviewer",
      expiresAt: "2026-03-30T18:00:00.000Z",
    }),
  );
});

test("persistent session bootstrap returns null on unauthorized current-session reads", async () => {
  const session = await bootstrapPersistentWorkbenchSession({
    request: async () => {
      throw new BrowserHttpClientError({
        method: "GET",
        requestUrl: "http://127.0.0.1:3001/api/v1/auth/session",
        status: 401,
        responseBody: {
          error: "unauthorized",
        },
      });
    },
  });

  assert.equal(session, null);
});

test("persistent session login and logout use auth session routes", async () => {
  const requests: Array<{
    method: string;
    url: string;
    body?: unknown;
  }> = [];
  const client = {
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.url === "/api/v1/auth/local/login") {
        return {
          status: 200,
          body: {
            provider: "local",
            user: {
              id: "persistent-knowledge-reviewer",
              username: "persistent.reviewer",
              displayName: "Persistent Reviewer",
              role: "knowledge_reviewer",
            },
            issuedAt: "2026-03-30T10:00:00.000Z",
            expiresAt: "2026-03-30T18:00:00.000Z",
            refreshAt: "2026-03-30T10:30:00.000Z",
          } as TResponse,
        };
      }

      return {
        status: 204,
        body: null as TResponse,
      };
    },
  };

  const session = await loginPersistentWorkbenchSession(client, {
    username: "persistent.reviewer",
    password: "demo-password",
  });
  await logoutPersistentWorkbenchSession(client);

  assert.equal(session.username, "persistent.reviewer");
  assert.deepEqual(requests, [
    {
      method: "POST",
      url: "/api/v1/auth/local/login",
      body: {
        username: "persistent.reviewer",
        password: "demo-password",
      },
    },
    {
      method: "POST",
      url: "/api/v1/auth/logout",
    },
  ]);
});
