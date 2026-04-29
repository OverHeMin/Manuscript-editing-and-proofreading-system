import assert from "node:assert/strict";
import test from "node:test";
import {
  createApiHttpServer,
  createInMemoryApiRuntime,
} from "../../src/http/api-http-server.ts";
import { EditorialRuleSetStatusTransitionError } from "../../src/modules/editorial-rules/editorial-rule-service.ts";
import { TableEvidenceService } from "../../src/modules/table-evidence/table-evidence-service.ts";
import {
  startHttpTestServer,
  stopHttpTestServer,
} from "./support/http-test-server.ts";

test("in-memory runtime editorial rule publish gate accepts confirmed table evidence revisions", async () => {
  const originalAssertConfirmedRevision =
    TableEvidenceService.prototype.assertConfirmedRevision;
  const assertCalls: string[] = [];
  TableEvidenceService.prototype.assertConfirmedRevision = async function (
    revisionId: string,
  ) {
    assertCalls.push(revisionId);
    return { id: revisionId } as never;
  };

  const runtime = createInMemoryApiRuntime({
    appEnv: "local",
    seedDemoData: true,
    uploadRootDir: process.cwd(),
  });

  try {
    const ruleSetId = await createRuleSetWithLinkedTableEvidence(
      runtime.editorialRuleApi,
      "rev-confirmed-runtime",
    );

    const published = await runtime.editorialRuleApi.publishRuleSet({
      actorRole: "admin",
      ruleSetId,
    });

    assert.equal(published.body.status, "published");
    assert.deepEqual(assertCalls, ["rev-confirmed-runtime"]);
  } finally {
    TableEvidenceService.prototype.assertConfirmedRevision =
      originalAssertConfirmedRevision;
  }
});

test("in-memory runtime editorial rule publish gate rejects unconfirmed table evidence revisions", async () => {
  const originalAssertConfirmedRevision =
    TableEvidenceService.prototype.assertConfirmedRevision;
  const assertCalls: string[] = [];
  TableEvidenceService.prototype.assertConfirmedRevision = async function (
    revisionId: string,
  ) {
    assertCalls.push(revisionId);
    throw new Error("revision is pending");
  };

  const runtime = createInMemoryApiRuntime({
    appEnv: "local",
    seedDemoData: true,
    uploadRootDir: process.cwd(),
  });

  try {
    const ruleSetId = await createRuleSetWithLinkedTableEvidence(
      runtime.editorialRuleApi,
      "rev-pending-runtime",
    );

    await assert.rejects(
      () =>
        runtime.editorialRuleApi.publishRuleSet({
          actorRole: "admin",
          ruleSetId,
        }),
      (error) => {
        assert.ok(error instanceof EditorialRuleSetStatusTransitionError);
        assert.equal(
          (error as { failure_code?: string }).failure_code,
          "table_evidence_revision_not_confirmed",
        );
        return true;
      },
    );
    assert.deepEqual(assertCalls, ["rev-pending-runtime"]);
  } finally {
    TableEvidenceService.prototype.assertConfirmedRevision =
      originalAssertConfirmedRevision;
  }
});

test("editorial rule publish HTTP table evidence gate failure includes structured details", async () => {
  const originalAssertConfirmedRevision =
    TableEvidenceService.prototype.assertConfirmedRevision;
  TableEvidenceService.prototype.assertConfirmedRevision = async function () {
    throw new Error("revision is pending");
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
    const cookie = await loginAsDemoUser(baseUrl, "dev.admin");
    const ruleSetId = await createRuleSetWithLinkedTableEvidence(
      runtime.editorialRuleApi,
      "rev-pending-http",
    );

    const response = await fetch(
      `${baseUrl}/api/v1/editorial-rules/rule-sets/${ruleSetId}/publish`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
        },
      },
    );
    const body = (await response.json()) as {
      error?: string;
      failure_code?: string;
      failures?: Array<{ code?: string; revision_id?: string }>;
    };

    assert.equal(response.status, 409);
    assert.equal(body.error, "state_conflict");
    assert.equal(body.failure_code, "table_evidence_revision_not_confirmed");
    assert.deepEqual(body.failures, [
      {
        code: "table_evidence_revision_not_confirmed",
        revision_id: "rev-pending-http",
      },
    ]);
  } finally {
    TableEvidenceService.prototype.assertConfirmedRevision =
      originalAssertConfirmedRevision;
    await stopHttpTestServer(server);
  }
});

async function createRuleSetWithLinkedTableEvidence(
  editorialRuleApi: ReturnType<typeof createInMemoryApiRuntime>["editorialRuleApi"],
  revisionId: string,
): Promise<string> {
  const ruleSet = await editorialRuleApi.createRuleSet({
    actorRole: "admin",
    input: {
      templateFamilyId: "family-seeded-1",
      module: "editing",
    },
  });

  await editorialRuleApi.createRule({
    actorRole: "admin",
    input: {
      ruleSetId: ruleSet.body.id,
      orderNo: 10,
      ruleObject: "table",
      ruleType: "format",
      executionMode: "inspect",
      scope: {
        sections: ["results"],
      },
      selector: {
        semantic_target: "header_cell",
      },
      trigger: {
        kind: "table_header",
      },
      action: {
        kind: "inspect_table_header",
      },
      linkagePayload: {
        table_evidence_revision_ids: [revisionId],
      },
      confidencePolicy: "manual_only",
      severity: "warning",
    },
  });

  return ruleSet.body.id;
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
