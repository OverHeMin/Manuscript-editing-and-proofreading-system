import test from "node:test";
import assert from "node:assert/strict";
import { createApiHttpServer, type ApiHttpServer } from "../../src/http/api-http-server.ts";
import {
  createWorkbenchRuntime,
  loginAsDemoUser,
  stopServer,
} from "./support/workbench-runtime.ts";

test("proofreader can load manuscript-scoped proofreading governance handoff", async () => {
  const runtime = createWorkbenchRuntime();
  const observedCalls: Array<{ manuscriptId: string; actorRole: string }> = [];
  (
    runtime.proofreadingApi as Record<string, unknown>
  ).getGovernanceHandoff = async (input: {
    manuscriptId: string;
    actorRole: string;
  }) => {
    observedCalls.push(input);
    return {
      status: 200,
      body: {
        residualReviewItems: [
          {
            id: "residual-proof-1",
            source_kind: "residual_issue",
            source_status: "validation_pending",
            review_status: "pending",
            module: "proofreading",
            manuscript_id: input.manuscriptId,
            manuscript_type: "clinical_study",
            execution_snapshot_id: "snapshot-proof-1",
            title: "Proofreading residual issue",
            recommended_route: "rule_candidate",
            harness_validation_status: "queued",
            available_actions: ["validate"],
            created_at: "2026-04-22T03:40:00.000Z",
            updated_at: "2026-04-22T03:41:00.000Z",
            issue_type: "terminology_gap",
          },
        ],
        ruleCandidates: [
          {
            id: "candidate-proof-1",
            type: "rule_candidate",
            status: "pending_review",
            manuscript_id: input.manuscriptId,
            module: "proofreading",
            manuscript_type: "clinical_study",
            governed_provenance_kind: "human_feedback",
            title: "Proofreading confirmation correction-1",
            proposal_text: "proofreading-final.docx [proofread]",
            created_by: "dev-proofreader",
            created_at: "2026-04-22T03:42:00.000Z",
            updated_at: "2026-04-22T03:42:00.000Z",
          },
        ],
      },
    };
  };

  const server = createApiHttpServer({
    appEnv: "local",
    allowedOrigins: ["http://127.0.0.1:4173"],
    runtime: runtime as never,
  });
  server.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.proofreader");
    const response = await fetch(
      `${baseUrl}/api/v1/modules/proofreading/governance-handoff?manuscriptId=manuscript-seeded-1`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      residualReviewItems: Array<{ manuscript_id?: string }>;
      ruleCandidates: Array<{ manuscript_id?: string }>;
    };
    assert.equal(body.residualReviewItems.length, 1);
    assert.equal(body.ruleCandidates.length, 1);
    assert.equal(body.residualReviewItems[0]?.manuscript_id, "manuscript-seeded-1");
    assert.equal(body.ruleCandidates[0]?.manuscript_id, "manuscript-seeded-1");
    assert.deepEqual(observedCalls, [
      {
        manuscriptId: "manuscript-seeded-1",
        actorRole: "proofreader",
      },
    ]);
  } finally {
    await stopServer(server as ApiHttpServer);
  }
});

test("proofreader can load snapshot-scoped proofreading governance handoff", async () => {
  const runtime = createWorkbenchRuntime();
  const observedCalls: Array<{
    manuscriptId: string;
    snapshotId?: string;
    actorRole: string;
  }> = [];
  (
    runtime.proofreadingApi as Record<string, unknown>
  ).getGovernanceHandoff = async (input: {
    manuscriptId: string;
    snapshotId?: string;
    actorRole: string;
  }) => {
    observedCalls.push(input);
    return {
      status: 200,
      body: {
        residualReviewItems: [],
        ruleCandidates: [],
      },
    };
  };

  const server = createApiHttpServer({
    appEnv: "local",
    allowedOrigins: ["http://127.0.0.1:4173"],
    runtime: runtime as never,
  });
  server.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.proofreader");
    const response = await fetch(
      `${baseUrl}/api/v1/modules/proofreading/governance-handoff?manuscriptId=manuscript-seeded-1&snapshotId=snapshot-proof-1`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(observedCalls, [
      {
        manuscriptId: "manuscript-seeded-1",
        snapshotId: "snapshot-proof-1",
        actorRole: "proofreader",
      },
    ]);
  } finally {
    await stopServer(server as ApiHttpServer);
  }
});
