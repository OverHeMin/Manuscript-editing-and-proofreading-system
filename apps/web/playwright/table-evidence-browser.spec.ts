import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const apiBaseUrl =
  process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:3001";
const titleFieldLabel = "\u6807\u9898";
const canonicalTextFieldLabel =
  "\u7b80\u8981\u8bf4\u660e\u6216\u6807\u51c6\u7b54\u6848";

test("knowledge library can upload pending DOCX table evidence for confirmation", async ({
  page,
  request,
}) => {
  const title = `knowledge-table-evidence-${Date.now()}`;
  let uploadCalled = false;
  let bindingCalled = false;

  await loginBrowserSession(page, request, "dev.admin");
  await page.route("**/api/v1/knowledge/duplicate-check", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });
  await page.route(
    "**/api/v1/table-evidence/assets/from-docx-upload",
    async (route) => {
      uploadCalled = true;
      await route.fulfill({
        status: 201,
        json: createPendingTableEvidenceResponse(),
      });
    },
  );
  await page.route("**/api/v1/table-evidence/bindings", async (route) => {
    bindingCalled = true;
    await route.fulfill({
      status: 200,
      json: {
        id: "binding-1",
        table_evidence_asset_id: "asset-1",
        table_evidence_revision_id: "rev-1",
        target_type: "knowledge_revision",
        target_id: "knowledge-revision-1",
        binding_role: "source_evidence",
        created_at: "2026-04-29T00:00:00.000Z",
      },
    });
  });

  await page.goto("/#knowledge-library?knowledgeView=ledger", {
    waitUntil: "domcontentloaded",
  });

  await page.locator('[data-toolbar-action="create"]').click();
  await page.getByRole("textbox", { name: titleFieldLabel }).fill(title);
  await page
    .getByRole("textbox", { name: canonicalTextFieldLabel })
    .fill("Use exact DOCX table evidence before submitting this knowledge item.");
  await page.locator('[data-board-action="save-draft"]').click();

  await page.locator('[data-board-tab="materials"]').click();
  await page.locator('[data-block-action="add-table-evidence"]').click();
  await expect(page.getByRole("heading", { name: "\u4e0a\u4f20 Word \u8868\u683c\u8bc1\u636e" })).toBeVisible();

  await page.locator('[data-table-evidence-upload-input="true"]').setInputFiles({
    name: "table.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: Buffer.from("fake docx content"),
  });

  await expect(page.locator(".table-evidence-table-list")).toContainText("Table 1");
  await expect(page.locator(".table-evidence-table-list")).toContainText("table.docx");
  await expect(page.locator('[data-block-type="table_evidence_block"]')).toContainText(
    "\u5f85\u786e\u8ba4",
  );
  await expect(page.locator('[data-entry-evidence-gate="knowledge"]')).toContainText(
    "\u8868\u683c\u8bc1\u636e\u72b6\u6001\u672a\u786e\u8ba4\uff1apending",
  );
  expect(uploadCalled).toBeTruthy();
  expect(bindingCalled).toBeFalsy();
});

async function loginApiSession(
  request: APIRequestContext,
  username: string,
): Promise<string> {
  const response = await request.post(`${apiBaseUrl}/api/v1/auth/local/login`, {
    data: {
      username,
      password: "demo-password",
    },
  });
  expect(response.ok()).toBeTruthy();

  const setCookie =
    response.headersArray().find((header) => header.name.toLowerCase() === "set-cookie")
      ?.value ?? response.headers()["set-cookie"];
  expect(setCookie).toBeTruthy();

  return ((setCookie ?? "").split(";", 1)[0] ?? "").trim();
}

async function loginBrowserSession(
  page: Page,
  request: APIRequestContext,
  username: string,
): Promise<void> {
  const cookiePair = await loginApiSession(request, username);
  const separatorIndex = cookiePair.indexOf("=");
  expect(separatorIndex).toBeGreaterThan(0);

  await page.context().clearCookies();
  await page.context().addCookies([
    {
      name: cookiePair.slice(0, separatorIndex),
      value: cookiePair.slice(separatorIndex + 1),
      url: `${apiBaseUrl}/`,
    },
  ]);
}

function createPendingTableEvidenceResponse() {
  return {
    sourceFile: {
      id: "file-1",
      storage_key: "table-evidence/file-1.docx",
      file_name: "table.docx",
      mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      byte_length: 17,
      sha256: "hash",
      uploaded_by: "user-1",
      uploaded_at: "2026-04-29T00:00:00.000Z",
    },
    asset: {
      id: "asset-1",
      title: "Table 1",
      source_file_asset_id: "file-1",
      source_file_name: "table.docx",
      source_kind: "docx_upload",
      parser: "python_docx_ooxml",
      parser_version: "table-evidence-v1",
      active_revision_id: "rev-1",
      fidelity_status: "pending",
      created_by: "user-1",
      created_at: "2026-04-29T00:00:00.000Z",
      updated_at: "2026-04-29T00:00:00.000Z",
    },
    revisions: [
      {
        id: "rev-1",
        table_evidence_asset_id: "asset-1",
        revision_no: 1,
        source_snapshot: {
          snapshot_id: "source-1",
          table_id: "table-1",
          source_file_asset_id: "file-1",
          parser: "python_docx_ooxml",
          parser_version: "table-evidence-v1",
          row_count: 1,
          column_count: 1,
          notes: [],
          object_evidence: [],
          warnings: [],
          grid_cells: [],
        },
        correction_patch: { patch_id: "patch-1", operations: [] },
        fidelity_report: {
          status: "pending",
          failure_codes: [],
          unsupported_fact_groups: [],
          required_confirmations: ["invisible_chars", "special_symbols"],
          invisible_chars_confirmed: false,
          special_symbols_confirmed: false,
        },
        confirmation_status: "pending",
        created_at: "2026-04-29T00:00:00.000Z",
      },
    ],
    tables: [
      {
        snapshot_id: "source-1",
        table_id: "table-1",
        source_file_asset_id: "file-1",
        parser: "python_docx_ooxml",
        parser_version: "table-evidence-v1",
        row_count: 1,
        column_count: 1,
        notes: [],
        object_evidence: [],
        warnings: [],
        grid_cells: [],
      },
    ],
  };
}
