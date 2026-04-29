import assert from "node:assert/strict";
import test from "node:test";
import {
  createApiHttpServer,
  createInMemoryApiRuntime,
} from "../../src/http/api-http-server.ts";
import { createTableEvidenceApi } from "../../src/modules/table-evidence/index.ts";
import {
  startHttpTestServer,
  stopHttpTestServer,
} from "../http/support/http-test-server.ts";
import type {
  TableEvidenceConfirmationStatus,
  TableEvidenceRevision,
  TableEvidenceService,
} from "../../src/modules/table-evidence/index.ts";

test("table evidence api exposes upload, patch, confirm, bind, and target package resolution", async () => {
  const calls: string[] = [];
  const createInput = {
    fileName: "tables.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    fileContentBase64: "ZmFrZQ==",
    actorId: "user-1",
  };
  const patchInput = {
    revisionId: "rev-1",
    patch: {
      patch_id: "patch-1",
      operations: [],
    },
  };
  const confirmInput = {
    revisionId: "rev-1",
    actorId: "user-1",
    confirmations: {
      invisibleCharsConfirmed: true,
      specialSymbolsConfirmed: true,
    },
  };
  const bindInput = {
    revisionId: "rev-1",
    targetType: "knowledge_revision",
    targetId: "knowledge-rev-1",
    bindingRole: "source_evidence",
  };
  const captured: Record<string, unknown> = {};
  const api = createTableEvidenceApi({
    tableEvidenceService: {
      createAssetFromDocxUpload: async (
        input: Parameters<TableEvidenceService["createAssetFromDocxUpload"]>[0],
      ) => {
        calls.push("create");
        captured.create = input;
        return { asset: { id: "asset-1" }, revisions: [{ id: "rev-1" }], tables: [] };
      },
      saveCorrectionPatch: async (
        input: Parameters<TableEvidenceService["saveCorrectionPatch"]>[0],
      ) => {
        calls.push("patch");
        captured.patch = input;
        return { id: "rev-1", confirmation_status: "needs_review" };
      },
      confirmRevision: async (
        input: Parameters<TableEvidenceService["confirmRevision"]>[0],
      ) => {
        calls.push("confirm");
        captured.confirm = input;
        return { id: "rev-1", confirmation_status: "confirmed" };
      },
      bindRevision: async (
        input: Parameters<TableEvidenceService["bindRevision"]>[0],
      ) => {
        calls.push("bind");
        captured.bind = input;
        return { id: "binding-1" };
      },
      resolveConfirmedPackagesForTarget: async (
        targetType: Parameters<
          TableEvidenceService["resolveConfirmedPackagesForTarget"]
        >[0],
        targetId: Parameters<
          TableEvidenceService["resolveConfirmedPackagesForTarget"]
        >[1],
      ) => {
        calls.push("packages");
        captured.packages = { targetType, targetId };
        return [];
      },
    } as never,
  });

  assert.equal((await api.createAssetFromDocxUpload(createInput as never)).status, 201);
  assert.equal((await api.saveCorrectionPatch(patchInput as never)).status, 200);
  assert.equal((await api.confirmRevision(confirmInput)).status, 200);
  assert.equal((await api.bindRevision(bindInput as never)).status, 201);
  assert.equal(
    (
      await api.listConfirmedPackagesForTarget({
        targetType: "knowledge_revision",
        targetId: "knowledge-rev-1",
      })
    ).status,
    200,
  );
  assert.deepEqual(calls, ["create", "patch", "confirm", "bind", "packages"]);
  assert.deepEqual(captured.create, createInput);
  assert.deepEqual(captured.patch, patchInput);
  assert.deepEqual(captured.confirm, confirmInput);
  assert.deepEqual(captured.bind, bindInput);
  assert.deepEqual(captured.packages, {
    targetType: "knowledge_revision",
    targetId: "knowledge-rev-1",
  });
});

test("table evidence REST routes prefer URL params and reviewer actor context", async () => {
  const runtime = createInMemoryApiRuntime({
    appEnv: "local",
    seedDemoData: true,
    uploadRootDir: process.cwd(),
  });
  const calls: Record<string, unknown> = {};
  runtime.tableEvidenceApi = {
    ...runtime.tableEvidenceApi,
    async saveCorrectionPatch(input) {
      calls.patch = input;
      return {
        status: 200,
        body: buildTableEvidenceRevision(input.revisionId, "needs_review"),
      };
    },
    async confirmRevision(input) {
      calls.confirm = input;
      return {
        status: 200,
        body: buildTableEvidenceRevision(input.revisionId, "confirmed"),
      };
    },
    async listConfirmedPackagesForTarget(input) {
      calls.packages = input;
      return {
        status: 200,
        body: [],
      };
    },
  };
  const server = createApiHttpServer({
    appEnv: "local",
    runtime,
  });
  const { baseUrl } = await startHttpTestServer(server);

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.knowledge-reviewer");
    const patchResponse = await fetch(
      `${baseUrl}/api/v1/table-evidence/revisions/url-rev/patch`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({
          revisionId: "body-rev",
          patch: { patch_id: "patch-1", operations: [] },
        }),
      },
    );
    assert.equal(patchResponse.status, 200);

    const confirmResponse = await fetch(
      `${baseUrl}/api/v1/table-evidence/revisions/url-rev/confirm`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({
          revisionId: "body-rev",
          actorId: "forged-user",
          confirmations: {
            invisibleCharsConfirmed: true,
            specialSymbolsConfirmed: true,
          },
        }),
      },
    );
    assert.equal(confirmResponse.status, 200);

    const packagesResponse = await fetch(
      `${baseUrl}/api/v1/table-evidence/targets/knowledge_revision/target-from-url/packages`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    assert.equal(packagesResponse.status, 200);

    assert.deepEqual(calls.patch, {
      revisionId: "url-rev",
      patch: { patch_id: "patch-1", operations: [] },
    });
    assert.deepEqual(calls.confirm, {
      revisionId: "url-rev",
      actorId: "dev-knowledge-reviewer",
      confirmations: {
        invisibleCharsConfirmed: true,
        specialSymbolsConfirmed: true,
      },
    });
    assert.deepEqual(calls.packages, {
      targetType: "knowledge_revision",
      targetId: "target-from-url",
    });
  } finally {
    await stopHttpTestServer(server);
  }
});

test("table evidence REST routes require knowledge review permission", async () => {
  const runtime = createInMemoryApiRuntime({
    appEnv: "local",
    seedDemoData: true,
    uploadRootDir: process.cwd(),
  });
  const calls: string[] = [];
  runtime.tableEvidenceApi = {
    ...runtime.tableEvidenceApi,
    async confirmRevision(input) {
      calls.push(`confirm:${input.revisionId}`);
      return {
        status: 200,
        body: buildTableEvidenceRevision(input.revisionId, "confirmed"),
      };
    },
    async listConfirmedPackagesForTarget(input) {
      calls.push(`packages:${input.targetType}:${input.targetId}`);
      return {
        status: 200,
        body: [],
      };
    },
  };
  const server = createApiHttpServer({
    appEnv: "local",
    runtime,
  });
  const { baseUrl } = await startHttpTestServer(server);

  try {
    const cookie = await loginAsDemoUser(baseUrl, "dev.user");
    const confirmResponse = await fetch(
      `${baseUrl}/api/v1/table-evidence/revisions/url-rev/confirm`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({
          revisionId: "body-rev",
          actorId: "forged-user",
          confirmations: {
            invisibleCharsConfirmed: true,
            specialSymbolsConfirmed: true,
          },
        }),
      },
    );
    assert.equal(confirmResponse.status, 403);

    const packagesResponse = await fetch(
      `${baseUrl}/api/v1/table-evidence/targets/knowledge_revision/target-from-url/packages`,
      {
        headers: {
          Cookie: cookie,
        },
      },
    );
    assert.equal(packagesResponse.status, 403);
    assert.deepEqual(calls, []);
  } finally {
    await stopHttpTestServer(server);
  }
});

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

function buildTableEvidenceRevision(
  id: string,
  confirmationStatus: TableEvidenceConfirmationStatus,
): TableEvidenceRevision {
  return {
    id,
    table_evidence_asset_id: "asset-1",
    revision_no: 1,
    source_snapshot: {
      snapshot_id: "snapshot-1",
      table_id: "table-1",
      source_file_asset_id: "source-file-1",
      parser: "python_docx_ooxml",
      parser_version: "table-evidence-v1",
      row_count: 0,
      column_count: 0,
      notes: [],
      grid_cells: [],
      object_evidence: [],
      warnings: [],
    },
    correction_patch: {
      patch_id: "patch-1",
      operations: [],
    },
    fidelity_report: {
      status: confirmationStatus === "confirmed" ? "confirmed" : "needs_review",
      failure_codes: [],
      unsupported_fact_groups: [],
      required_confirmations: [],
      invisible_chars_confirmed: confirmationStatus === "confirmed",
      special_symbols_confirmed: confirmationStatus === "confirmed",
    },
    confirmation_status: confirmationStatus,
    created_at: "2026-04-29T00:00:00.000Z",
  };
}
