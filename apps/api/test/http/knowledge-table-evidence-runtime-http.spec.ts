import test from "node:test";
import assert from "node:assert/strict";
import {
  createApiHttpServer,
  createInMemoryApiRuntime,
} from "../../src/http/api-http-server.ts";
import { TableEvidenceService } from "../../src/modules/table-evidence/table-evidence-service.ts";
import {
  startHttpTestServer,
  stopHttpTestServer,
} from "./support/http-test-server.ts";

test("in-memory HTTP runtime gates table evidence using its constructed table evidence service", async () => {
  const originalAssertConfirmedRevision =
    TableEvidenceService.prototype.assertConfirmedRevision;
  const originalResolveConfirmedPackagesForTarget =
    TableEvidenceService.prototype.resolveConfirmedPackagesForTarget;
  const assertCalls: string[] = [];
  const resolveCalls: Array<{ targetType: string; targetId: string }> = [];
  TableEvidenceService.prototype.assertConfirmedRevision = async function (
    revisionId: string,
  ) {
    assertCalls.push(revisionId);
    return {
      id: revisionId,
      table_evidence_asset_id: "table-asset-1",
      confirmation_status: "confirmed",
      fidelity_report: { status: "confirmed" },
      ai_table_package: { authority: "authoritative" },
    } as never;
  };
  TableEvidenceService.prototype.resolveConfirmedPackagesForTarget = async function (
    targetType,
    targetId,
  ) {
    resolveCalls.push({ targetType, targetId });
    return [
      {
        revision_id: "rev-confirmed",
        authority: "authoritative",
      },
    ] as never;
  };

  const runtime = createInMemoryApiRuntime({
    appEnv: "local",
    seedDemoData: true,
    uploadRootDir: process.cwd(),
  });
  const server = createApiHttpServer({
    appEnv: "local",
    runtime,
  });
  const { baseUrl } = await startHttpTestServer(server);

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.knowledge-reviewer");
    const revisionId = await createDraftWithTableEvidenceBlock(baseUrl, cookie, {
      table_evidence_asset_id: "table-asset-1",
      table_evidence_revision_id: "rev-confirmed",
    });

    const submitResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/revisions/${revisionId}/submit`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({}),
      },
    );

    assert.equal(submitResponse.status, 200);
    assert.deepEqual(assertCalls, ["rev-confirmed"]);
    assert.deepEqual(resolveCalls, [
      {
        targetType: "knowledge_revision",
        targetId: revisionId,
      },
    ]);
  } finally {
    TableEvidenceService.prototype.assertConfirmedRevision =
      originalAssertConfirmedRevision;
    TableEvidenceService.prototype.resolveConfirmedPackagesForTarget =
      originalResolveConfirmedPackagesForTarget;
    await stopHttpTestServer(server);
  }
});

test("in-memory HTTP runtime resolves AI table packages through its constructed table evidence service", async () => {
  const originalResolveConfirmedPackagesForTarget =
    TableEvidenceService.prototype.resolveConfirmedPackagesForTarget;
  const resolveCalls: Array<{ targetType: string; targetId: string }> = [];
  TableEvidenceService.prototype.resolveConfirmedPackagesForTarget = async function (
    targetType,
    targetId,
  ) {
    resolveCalls.push({ targetType, targetId });
    return [
      {
        authority: "authoritative",
        table_evidence_revision_id: "rev-confirmed",
      },
    ] as never;
  };

  const runtime = createInMemoryApiRuntime({
    appEnv: "local",
    seedDemoData: true,
    uploadRootDir: process.cwd(),
  });
  const server = createApiHttpServer({
    appEnv: "local",
    runtime,
  });
  const { baseUrl } = await startHttpTestServer(server);

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.knowledge-reviewer");
    const revisionId = await createDraftWithTableEvidenceBlock(baseUrl, cookie, {
      table_evidence_asset_id: "table-asset-1",
      table_evidence_revision_id: "rev-confirmed",
    });

    const assistResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/revisions/${revisionId}/semantic-layer/assist`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({
          instructionText: "Use confirmed table evidence.",
        }),
      },
    );

    assert.equal(assistResponse.status, 200);
    assert.deepEqual(resolveCalls, [
      {
        targetType: "knowledge_revision",
        targetId: revisionId,
      },
    ]);
  } finally {
    TableEvidenceService.prototype.resolveConfirmedPackagesForTarget =
      originalResolveConfirmedPackagesForTarget;
    await stopHttpTestServer(server);
  }
});

test("HTTP table evidence gate failures include structured failure details", async () => {
  const runtime = createInMemoryApiRuntime({
    appEnv: "local",
    seedDemoData: true,
    uploadRootDir: process.cwd(),
  });
  const server = createApiHttpServer({
    appEnv: "local",
    runtime,
  });
  const { baseUrl } = await startHttpTestServer(server);

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.knowledge-reviewer");
    const { revisionId, blockId } =
      await createDraftWithTableEvidenceBlockAndReturnBlock(baseUrl, cookie, {
        table_evidence_asset_id: "table-asset-1",
        table_evidence_revision_id: "rev-pending",
      });

    const submitResponse = await fetch(
      `${baseUrl}/api/v1/knowledge/revisions/${revisionId}/submit`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({}),
      },
    );
    const body = (await submitResponse.json()) as {
      error?: string;
      revisionId?: string;
      phase?: string;
      failures?: Array<{
        code?: string;
        block_id?: string;
        revision_id?: string;
      }>;
    };

    assert.equal(submitResponse.status, 400);
    assert.equal(body.error, "invalid_request");
    assert.equal(body.revisionId, revisionId);
    assert.equal(body.phase, "submit_for_review");
    assert.deepEqual(body.failures, [
      {
        code: "table_evidence_revision_not_confirmed",
        message: `Table evidence block #0 revision rev-pending is not confirmed`,
        block_id: blockId,
        revision_id: "rev-pending",
      },
    ]);
  } finally {
    await stopHttpTestServer(server);
  }
});

async function createDraftWithTableEvidenceBlock(
  baseUrl: string,
  cookie: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const { revisionId } = await createDraftWithTableEvidenceBlockAndReturnBlock(
    baseUrl,
    cookie,
    payload,
  );
  return revisionId;
}

async function createDraftWithTableEvidenceBlockAndReturnBlock(
  baseUrl: string,
  cookie: string,
  payload: Record<string, unknown>,
): Promise<{ revisionId: string; blockId: string }> {
  const createResponse = await fetch(`${baseUrl}/api/v1/knowledge/assets/drafts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({
      title: "Confirmed table evidence gate",
      canonicalText:
        "Table-backed knowledge can only enter review with confirmed table evidence.",
      knowledgeKind: "reference",
      moduleScope: "editing",
      manuscriptTypes: ["clinical_study"],
    }),
  });
  assert.equal(createResponse.status, 201);
  const created = (await createResponse.json()) as {
    selected_revision: { id: string };
  };
  const revisionId = created.selected_revision.id;

  const blocksResponse = await fetch(
    `${baseUrl}/api/v1/knowledge/revisions/${revisionId}/content-blocks/replace`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        blocks: [
          {
            blockType: "table_evidence_block",
            orderNo: 0,
            contentPayload: payload,
          },
        ],
      }),
    },
  );
  assert.equal(blocksResponse.status, 200);
  const updated = (await blocksResponse.json()) as {
    content_blocks: Array<{ id: string }>;
  };
  assert.ok(updated.content_blocks[0]?.id);

  return {
    revisionId,
    blockId: updated.content_blocks[0].id,
  };
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
