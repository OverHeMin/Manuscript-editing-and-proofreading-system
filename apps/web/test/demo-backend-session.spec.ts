import test from "node:test";
import assert from "node:assert/strict";
import { buildAuthSessionViewModel } from "../src/features/auth/index.ts";
import {
  ensureDemoBackendSession,
  resolveDemoBackendPassword,
} from "../src/app/demo-backend-session.ts";

test("demo backend session falls back to the default local password", () => {
  assert.equal(resolveDemoBackendPassword({}), "demo-password");
  assert.equal(
    resolveDemoBackendPassword({
      VITE_DEMO_PASSWORD: "custom-pass",
    }),
    "custom-pass",
  );
});

test("demo backend session logs in with the current dev session username", async () => {
  const requests: Array<{
    url: string;
    method: string;
    credentials: RequestCredentials;
    body: unknown;
  }> = [];

  await ensureDemoBackendSession(
    buildAuthSessionViewModel({
      userId: "dev-knowledge-reviewer",
      username: "dev.knowledge-reviewer",
      displayName: "Knowledge Reviewer",
      role: "knowledge_reviewer",
    }),
    {
      VITE_API_BASE_URL: "http://127.0.0.1:3001",
      VITE_DEMO_PASSWORD: "demo-password",
    },
    async (url, init) => {
      requests.push({
        url: String(url),
        method: String(init?.method),
        credentials: init?.credentials ?? "same-origin",
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });

      return new Response(
        JSON.stringify({
          user: {
            username: "dev.knowledge-reviewer",
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    },
  );

  assert.deepEqual(requests, [
    {
      url: "http://127.0.0.1:3001/api/v1/auth/local/login",
      method: "POST",
      credentials: "include",
      body: {
        username: "dev.knowledge-reviewer",
        password: "demo-password",
      },
    },
  ]);
});
