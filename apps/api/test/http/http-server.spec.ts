import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import {
  createApiHttpServer,
  type ApiHttpServer,
} from "../../src/http/api-http-server.ts";

async function startServer(): Promise<{
  server: ApiHttpServer;
  baseUrl: string;
}> {
  const server = createApiHttpServer({
    appEnv: "local",
    allowedOrigins: ["http://127.0.0.1:4173"],
    seedDemoKnowledgeReviewData: true,
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  assert.ok(address && typeof address !== "string", "Expected a tcp server address.");

  return {
    server,
    baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}`,
  };
}

async function stopServer(server: ApiHttpServer): Promise<void> {
  server.close();
  await once(server, "close");
}

async function loginAsDemoUser(baseUrl: string, username: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/v1/auth/local/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      password: "demo-password",
    }),
  });

  assert.equal(response.status, 200);
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie, "Expected auth login to return a session cookie.");
  return setCookie.split(";")[0] ?? "";
}

test("http server rejects protected review routes without a trusted session", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const response = await fetch(`${baseUrl}/api/v1/knowledge/review-queue`, {
      headers: {
        Origin: "http://127.0.0.1:4173",
      },
    });

    assert.equal(response.status, 401);
    assert.equal(
      response.headers.get("access-control-allow-origin"),
      "http://127.0.0.1:4173",
    );
    assert.equal(response.headers.get("access-control-allow-credentials"), "true");
    const body = (await response.json()) as { error: string };
    assert.equal(body.error, "unauthorized");
  } finally {
    await stopServer(server);
  }
});

test("http server uses the authenticated session role instead of a forged actorRole body", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.editor");
    const approveResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/knowledge-demo-1/approve`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "admin",
          reviewNote: "forged admin attempt",
        }),
      },
    );
    const approveBody = (await approveResponse.json()) as { error: string };

    assert.equal(approveResponse.status, 403);
    assert.equal(approveBody.error, "forbidden");
  } finally {
    await stopServer(server);
  }
});

test("http server exposes the seeded knowledge review queue with CORS for authenticated users", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.knowledge-reviewer");
    const response = await fetch(`${baseUrl}/api/v1/knowledge/review-queue`, {
      headers: {
        Origin: "http://127.0.0.1:4173",
        Cookie: cookie,
      },
    });

    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("access-control-allow-origin"),
      "http://127.0.0.1:4173",
    );
    assert.equal(response.headers.get("access-control-allow-credentials"), "true");

    const body = (await response.json()) as Array<{ title: string; status: string }>;

    assert.deepEqual(
      body.map((item) => ({
        title: item.title,
        status: item.status,
      })),
      [
        {
          title: "Clinical study endpoint rule",
          status: "pending_review",
        },
        {
          title: "Case report privacy checklist",
          status: "pending_review",
        },
      ],
    );
  } finally {
    await stopServer(server);
  }
});

test("http server returns review history and updates queue state after approve and reject", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.knowledge-reviewer");
    const queueResponse = await fetch(`${baseUrl}/api/v1/knowledge/review-queue`, {
      headers: {
        Cookie: cookie,
      },
    });
    const queue = (await queueResponse.json()) as Array<{ id: string }>;

    assert.equal(queue.length, 2);

    const initialHistoryResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/${queue[0]?.id}/review-actions`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const initialHistory = (await initialHistoryResponse.json()) as Array<{
      action: string;
      review_note?: string;
    }>;

    assert.deepEqual(
      initialHistory.map((record) => ({
        action: record.action,
        review_note: record.review_note,
      })),
      [
        {
          action: "submitted_for_review",
          review_note: undefined,
        },
      ],
    );

    const approveResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/${queue[0]?.id}/approve`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reviewNote: "Approved in browser validation.",
        }),
      },
    );
    const approveBody = (await approveResponse.json()) as { status: string };

    assert.equal(approveResponse.status, 200);
    assert.equal(approveBody.status, "approved");

    const rejectResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/${queue[1]?.id}/reject`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reviewNote: "Needs stronger privacy evidence.",
        }),
      },
    );
    const rejectBody = (await rejectResponse.json()) as { status: string };

    assert.equal(rejectResponse.status, 200);
    assert.equal(rejectBody.status, "draft");

    const finalQueueResponse = await fetch(`${baseUrl}/api/v1/knowledge/review-queue`, {
      headers: {
        Cookie: cookie,
      },
    });
    const finalQueue = (await finalQueueResponse.json()) as Array<unknown>;

    assert.equal(finalQueue.length, 0);

    const approvedHistoryResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/${queue[0]?.id}/review-actions`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const approvedHistory = (await approvedHistoryResponse.json()) as Array<{
      action: string;
      review_note?: string;
    }>;

    assert.deepEqual(
      approvedHistory.map((record) => ({
        action: record.action,
        review_note: record.review_note,
      })),
      [
        {
          action: "submitted_for_review",
          review_note: undefined,
        },
        {
          action: "approved",
          review_note: "Approved in browser validation.",
        },
      ],
    );
  } finally {
    await stopServer(server);
  }
});

test("http server answers preflight and health checks", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const optionsResponse = await fetch(`${baseUrl}/api/v1/knowledge/review-queue`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://127.0.0.1:4173",
        "Access-Control-Request-Method": "GET",
      },
    });

    assert.equal(optionsResponse.status, 204);
    assert.equal(
      optionsResponse.headers.get("access-control-allow-origin"),
      "http://127.0.0.1:4173",
    );

    const healthResponse = await fetch(`${baseUrl}/healthz`);
    const healthBody = (await healthResponse.json()) as { status: string };

    assert.equal(healthResponse.status, 200);
    assert.deepEqual(healthBody, {
      status: "ok",
    });
  } finally {
    await stopServer(server);
  }
});

test("http server creates and approves a governed learning candidate", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.knowledge-reviewer");
    const snapshotResponse = await fetch(
      `${baseUrl}/api/v1/learning/reviewed-case-snapshots`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          manuscriptId: "manuscript-demo-1",
          module: "editing",
          manuscriptType: "clinical_study",
          humanFinalAssetId: "human-final-demo-1",
          deidentificationPassed: true,
          requestedBy: "forged-requested-by",
          storageKey: "learning/manuscript-demo-1/snapshot.bin",
        }),
      },
    );
    const snapshot = (await snapshotResponse.json()) as {
      id: string;
      created_by: string;
    };

    assert.equal(snapshotResponse.status, 201);
    assert.ok(snapshot.id);
    assert.equal(snapshot.created_by, "dev-knowledge-reviewer");

    const candidateResponse = await fetch(
      `${baseUrl}/api/v1/learning/candidates/governed`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          snapshotId: snapshot.id,
          type: "rule_candidate",
          title: "Terminology normalization candidate",
          proposalText: "Normalize core endpoint terminology across the manuscript.",
          requestedBy: "forged-requested-by",
          deidentificationPassed: true,
          governedSource: {
            sourceKind: "evaluation_experiment",
            reviewedCaseSnapshotId: snapshot.id,
            evaluationRunId: "eval-demo-1",
            evidencePackId: "evidence-demo-1",
            sourceAssetId: "human-final-demo-1",
          },
        }),
      },
    );
    const candidate = (await candidateResponse.json()) as {
      id: string;
      status: string;
      created_by: string;
      governed_provenance_kind?: string;
    };

    assert.equal(candidateResponse.status, 201);
    assert.equal(candidate.status, "pending_review");
    assert.equal(candidate.created_by, "dev-knowledge-reviewer");
    assert.equal(candidate.governed_provenance_kind, "evaluation_experiment");

    const approveResponse = await fetch(
      `${baseUrl}/api/v1/learning/candidates/${candidate.id}/approve`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "admin",
        }),
      },
    );
    const approved = (await approveResponse.json()) as { status: string };

    assert.equal(approveResponse.status, 200);
    assert.equal(approved.status, "approved");
  } finally {
    await stopServer(server);
  }
});

test("http server preserves CORS headers on learning approval permission errors", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.editor");
    const response = await fetch(
      `${baseUrl}/api/v1/learning/candidates/learning-pending-demo-1/approve`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          Origin: "http://127.0.0.1:4173",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "editor",
        }),
      },
    );
    const body = (await response.json()) as { error: string; message: string };

    assert.equal(response.status, 403);
    assert.equal(
      response.headers.get("access-control-allow-origin"),
      "http://127.0.0.1:4173",
    );
    assert.equal(response.headers.get("access-control-allow-credentials"), "true");
    assert.equal(body.error, "forbidden");
  } finally {
    await stopServer(server);
  }
});

test("http server seeded pending learning candidates can be approved by admin", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.admin");
    const approveResponse = await fetch(
      `${baseUrl}/api/v1/learning/candidates/learning-pending-demo-1/approve`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "user",
        }),
      },
    );
    const approved = (await approveResponse.json()) as { status: string };

    assert.equal(approveResponse.status, 200);
    assert.equal(approved.status, "approved");
  } finally {
    await stopServer(server);
  }
});

test("http server creates, applies, and lists learning governance writebacks", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.admin");
    const createResponse = await fetch(
      `${baseUrl}/api/v1/learning-governance/writebacks`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "admin",
          input: {
            learningCandidateId: "learning-approved-demo-1",
            targetType: "knowledge_item",
            createdBy: "forged-created-by",
          },
        }),
      },
    );
    const created = (await createResponse.json()) as {
      id: string;
      status: string;
      created_by: string;
    };

    assert.equal(createResponse.status, 201);
    assert.equal(created.status, "draft");
    assert.equal(created.created_by, "dev-admin");

    const applyResponse = await fetch(
      `${baseUrl}/api/v1/learning-governance/writebacks/${created.id}/apply`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actorRole: "admin",
          input: {
            targetType: "knowledge_item",
            appliedBy: "forged-applied-by",
            title: "Screening endpoint governance rule",
            canonicalText:
              "Clinical study submissions must disclose the primary endpoint and analysis method.",
            knowledgeKind: "rule",
            moduleScope: "screening",
            manuscriptTypes: ["clinical_study"],
          },
        }),
      },
    );
    const applied = (await applyResponse.json()) as {
      status: string;
      created_draft_asset_id?: string;
      applied_by?: string;
    };

    assert.equal(applyResponse.status, 200);
    assert.equal(applied.status, "applied");
    assert.ok(applied.created_draft_asset_id);
    assert.equal(applied.applied_by, "dev-admin");

    const listResponse = await fetch(
      `${baseUrl}/api/v1/learning-governance/candidates/learning-approved-demo-1/writebacks`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const writebacks = (await listResponse.json()) as Array<{
      id: string;
      status: string;
      created_draft_asset_id?: string;
    }>;

    assert.equal(listResponse.status, 200);
    assert.equal(writebacks.length, 1);
    assert.equal(writebacks[0]?.status, "applied");
    assert.equal(writebacks[0]?.id, created.id);
    assert.ok(writebacks[0]?.created_draft_asset_id);
  } finally {
    await stopServer(server);
  }
});

test("http server lists seeded learning review candidates and exposes candidate detail", async () => {
  const { server, baseUrl } = await startServer();

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.knowledge-reviewer");
    const queueResponse = await fetch(`${baseUrl}/api/v1/learning/candidates/review-queue`, {
      headers: {
        Cookie: cookie,
      },
    });
    const queue = (await queueResponse.json()) as Array<{
      id: string;
      title?: string;
      status: string;
    }>;

    assert.equal(queueResponse.status, 200);
    assert.deepEqual(
      queue.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
      })),
      [
        {
          id: "learning-pending-demo-1",
          title: "Pending terminology normalization",
          status: "pending_review",
        },
        {
          id: "learning-pending-demo-2",
          title: "Pending checklist update",
          status: "pending_review",
        },
      ],
    );

    const detailResponse = await fetch(
      `${baseUrl}/api/v1/learning/candidates/learning-approved-demo-1`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    const detail = (await detailResponse.json()) as {
      id: string;
      status: string;
      title?: string;
      governed_provenance_kind?: string;
    };

    assert.equal(detailResponse.status, 200);
    assert.deepEqual(
      {
        id: detail.id,
        status: detail.status,
        title: detail.title,
        governed_provenance_kind: detail.governed_provenance_kind,
      },
      {
      id: "learning-approved-demo-1",
      status: "approved",
      title: "Approved learning candidate demo",
      governed_provenance_kind: "evaluation_experiment",
      },
    );
  } finally {
    await stopServer(server);
  }
});
