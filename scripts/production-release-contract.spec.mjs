import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPredeploySteps,
  verifyPostdeployHealth,
} from "./production-release-contract.mjs";

test("buildPredeploySteps returns the standard production verification order", () => {
  const steps = buildPredeploySteps();

  assert.deepEqual(
    steps.map((step) => step.command),
    [
      "pnpm lint",
      "pnpm typecheck",
      "pnpm test",
      "pnpm --filter @medical/api run smoke:boot",
      "pnpm --filter @medsys/web run smoke:boot",
      "pnpm --filter @medical/worker-py run smoke:boot",
      "pnpm verify:manuscript-workbench",
    ],
  );
});

test("verifyPostdeployHealth returns a compact summary when healthz and readyz are healthy", async () => {
  const result = await verifyPostdeployHealth({
    baseUrl: "http://127.0.0.1:3001",
    fetchImpl: createFetchStub({
      "/healthz": { status: 200, body: { status: "ok" } },
      "/readyz": {
        status: 200,
        body: {
          status: "ready",
          components: {
            runtimeContract: "ok",
            database: "ok",
            uploadRoot: "ok",
          },
        },
      },
    }),
  });

  assert.deepEqual(result, {
    status: "ready",
    baseUrl: "http://127.0.0.1:3001",
    healthz: { statusCode: 200, body: { status: "ok" } },
    readyz: {
      statusCode: 200,
      body: {
        status: "ready",
        components: {
          runtimeContract: "ok",
          database: "ok",
          uploadRoot: "ok",
        },
      },
    },
  });
});

test("verifyPostdeployHealth fails when healthz is not 200", async () => {
  await assert.rejects(
    () =>
      verifyPostdeployHealth({
        baseUrl: "http://127.0.0.1:3001",
        fetchImpl: createFetchStub({
          "/healthz": { status: 503, body: { status: "failed" } },
          "/readyz": {
            status: 200,
            body: { status: "ready", components: { runtimeContract: "ok" } },
          },
        }),
      }),
    /healthz.*503/i,
  );
});

test("verifyPostdeployHealth fails when readyz is not 200 and includes the compact readiness payload", async () => {
  await assert.rejects(
    () =>
      verifyPostdeployHealth({
        baseUrl: "http://127.0.0.1:3001",
        fetchImpl: createFetchStub({
          "/healthz": { status: 200, body: { status: "ok" } },
          "/readyz": {
            status: 503,
            body: {
              status: "not_ready",
              components: {
                runtimeContract: "ok",
                database: "failed",
                uploadRoot: "ok",
              },
            },
          },
        }),
      }),
    /readyz.*"database":"failed"/i,
  );
});

function createFetchStub(routeMap) {
  return async (input) => {
    const url = new URL(input);
    const route = routeMap[url.pathname];

    if (!route) {
      throw new Error(`Unexpected fetch target: ${url.pathname}`);
    }

    return createResponse(route);
  };
}

function createResponse({ status, body, headers = { "content-type": "application/json" } }) {
  const textBody = typeof body === "string" ? body : JSON.stringify(body);

  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get(name) {
        return headers[name.toLowerCase()] ?? headers[name] ?? null;
      },
    },
    async text() {
      return textBody;
    },
  };
}
