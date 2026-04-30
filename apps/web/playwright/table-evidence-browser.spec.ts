import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const apiBaseUrl =
  process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:3001";
const titleFieldLabel = "\u6807\u9898";
const canonicalTextFieldLabel =
  "\u7b80\u8981\u8bf4\u660e\u6216\u6807\u51c6\u7b54\u6848";

test("knowledge library can upload, select, confirm, and bind DOCX table evidence", async ({
  page,
  request,
}) => {
  const title = `knowledge-table-evidence-${Date.now()}`;
  let uploadCalled = false;
  let patchCalled = false;
  let confirmCalled = false;
  let bindingCalled = false;
  let patchRequestBody: unknown = null;
  let confirmRequestBody: unknown = null;
  let bindingRequestBody: unknown = null;

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
  await page.route("**/api/v1/table-evidence/revisions/*/patch", async (route) => {
    patchCalled = true;
    patchRequestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      json: createPendingTableEvidenceRevision({
        id: "rev-2-patched",
        assetId: "asset-2",
        tableId: "table-2",
        revisionNo: 2,
      }),
    });
  });
  await page.route("**/api/v1/table-evidence/revisions/*/confirm", async (route) => {
    confirmCalled = true;
    confirmRequestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      json: createConfirmedTableEvidenceRevision({
        id: "rev-2-confirmed",
        assetId: "asset-2",
        tableId: "table-2",
        revisionNo: 3,
      }),
    });
  });
  await page.route("**/api/v1/table-evidence/bindings", async (route) => {
    bindingCalled = true;
    bindingRequestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      json: {
        id: "binding-1",
        table_evidence_asset_id: "asset-2",
        table_evidence_revision_id: "rev-2-confirmed",
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
  await openTableEvidencePanelIfNeeded(page);
  await expect(page.locator(".table-evidence-upload-entry")).toBeVisible();

  await page.locator('[data-table-evidence-upload-input="true"]').setInputFiles({
    name: "tables.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: Buffer.from("fake docx content"),
  });

  await expect(page.locator(".table-evidence-table-list")).toContainText("表格 2");
  await page.locator('[data-table-id="table-2"]').click();
  await expect(page.locator(".table-evidence-workspace")).toBeVisible();
  await expect(page.locator(".table-evidence-workspace")).toHaveAttribute(
    "data-asset-id",
    "asset-2",
  );
  await expect(page.locator(".table-evidence-workspace")).toHaveAttribute(
    "data-table-evidence-workspace-layout",
    "responsive",
  );
  await expect(page.locator(".table-evidence-workspace")).toContainText("Table 2");
  await assertTableEvidenceWorkspaceLayout(page);

  await page.locator('[data-confirmation-kind="invisible_chars"]').check();
  await page.locator('[data-confirmation-kind="special_symbols"]').check();
  await page.getByRole("button", { name: "确认表格证据" }).click();

  await expect(page.locator('[data-block-type="table_evidence_block"]')).toContainText(
    "\u5df2\u786e\u8ba4",
  );
  await expect(page.locator('[data-entry-evidence-gate="knowledge"]')).toContainText(
    "\u8868\u683c\u8bc1\u636e\u72b6\u6001\u5df2\u786e\u8ba4",
  );
  expect(uploadCalled).toBeTruthy();
  expect(patchCalled).toBeTruthy();
  expect(confirmCalled).toBeTruthy();
  expect(bindingCalled).toBeTruthy();
  expect(patchRequestBody).toMatchObject({
    patch: {
      operations: [
        { op: "confirm_invisible_chars" },
        { op: "confirm_special_symbols" },
      ],
    },
  });
  expect(confirmRequestBody).toEqual({
    confirmations: {
      invisibleCharsConfirmed: true,
      specialSymbolsConfirmed: true,
    },
  });
  expect(bindingRequestBody).toMatchObject({
    revisionId: "rev-2-confirmed",
    targetType: "knowledge_revision",
    bindingRole: "source_evidence",
  });
});

test("rule center lays out uploaded DOCX table evidence workspace inside the entry step", async ({
  page,
  request,
}) => {
  await loginBrowserSession(page, request, "dev.admin");
  await page.route(
    "**/api/v1/table-evidence/assets/from-docx-upload",
    async (route) => {
      await route.fulfill({
        status: 201,
        json: createPendingTableEvidenceResponse(),
      });
    },
  );

  await page.goto("/#template-governance?templateGovernanceView=rule-ledger", {
    waitUntil: "domcontentloaded",
  });
  await page.getByRole("button", { name: "新建规则" }).click();
  await expect(page.locator(".table-evidence-upload-entry")).toBeVisible();

  await page.locator('[data-table-evidence-upload-input="true"]').setInputFiles({
    name: "tables.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: Buffer.from("fake docx content"),
  });

  await expect(page.locator(".table-evidence-workspace")).toBeVisible();
  await expect(page.locator(".table-evidence-workspace")).toHaveAttribute(
    "data-table-evidence-workspace-layout",
    "responsive",
  );
  await expect(page.locator(".table-evidence-workspace")).toContainText("Table 1");
  await assertTableEvidenceWorkspaceLayout(page);
});

async function openTableEvidencePanelIfNeeded(page: Page): Promise<void> {
  const uploadEntry = page.locator(".table-evidence-upload-entry");
  if (!(await uploadEntry.isVisible())) {
    await page.locator('[data-block-action="add-table-evidence"]').click();
  }
}

async function assertTableEvidenceWorkspaceLayout(page: Page): Promise<void> {
  const metrics = await page.locator(".table-evidence-workspace").evaluate((workspace) => {
    const grid = workspace.querySelector(".table-evidence-workspace-grid");
    const toolbarStack = workspace.querySelector(".table-evidence-toolbar-stack");
    const previewPane = workspace.querySelector(".table-evidence-preview-pane");
    const toolbarButtons = Array.from(workspace.querySelectorAll(".table-evidence-toolbar button"));
    if (!grid || !toolbarStack || !previewPane || toolbarButtons.length === 0) {
      return null;
    }

    const gridStyle = getComputedStyle(grid);
    const previewStyle = getComputedStyle(previewPane);
    const buttonRects = toolbarButtons.map((button) => button.getBoundingClientRect());
    return {
      gridColumnCount: gridStyle.gridTemplateColumns.split(" ").filter(Boolean).length,
      previewOverflowX: previewStyle.overflowX,
      previewWidth: previewPane.getBoundingClientRect().width,
      toolbarStackWidth: toolbarStack.getBoundingClientRect().width,
      shortestButtonWidth: Math.min(...buttonRects.map((rect) => rect.width)),
      tallestButtonHeight: Math.max(...buttonRects.map((rect) => rect.height)),
    };
  });

  expect(metrics).not.toBeNull();
  expect(metrics?.gridColumnCount).toBe(1);
  expect(["auto", "scroll"]).toContain(metrics?.previewOverflowX);
  expect(metrics?.toolbarStackWidth).toBeGreaterThan(280);
  expect(metrics?.previewWidth).toBeGreaterThan(280);
  expect(metrics?.shortestButtonWidth).toBeGreaterThan(24);
  expect(metrics?.tallestButtonHeight).toBeLessThan(44);
}

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
      file_name: "tables.docx",
      mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      byte_length: 17,
      sha256: "hash",
      uploaded_by: "user-1",
      uploaded_at: "2026-04-29T00:00:00.000Z",
    },
    asset: createTableEvidenceAsset("asset-1", "rev-1", "Table 1"),
    assets: [
      createTableEvidenceAsset("asset-1", "rev-1", "Table 1"),
      createTableEvidenceAsset("asset-2", "rev-2", "Table 2"),
    ],
    revisions: [
      createPendingTableEvidenceRevision({
        id: "rev-1",
        assetId: "asset-1",
        tableId: "table-1",
      }),
      createPendingTableEvidenceRevision({
        id: "rev-2",
        assetId: "asset-2",
        tableId: "table-2",
      }),
    ],
    tables: [
      createTableSourceSnapshot("table-1", "Baseline"),
      createTableSourceSnapshot("table-2", "Endpoint"),
    ],
  };
}

function createTableEvidenceAsset(
  id: string,
  activeRevisionId: string,
  title: string,
) {
  return {
    id,
    title,
    source_file_asset_id: "file-1",
    source_file_name: "tables.docx",
    source_kind: "docx_upload",
    parser: "python_docx_ooxml",
    parser_version: "table-evidence-v1",
    active_revision_id: activeRevisionId,
    fidelity_status: "pending",
    created_by: "user-1",
    created_at: "2026-04-29T00:00:00.000Z",
    updated_at: "2026-04-29T00:00:00.000Z",
  };
}

function createPendingTableEvidenceRevision(input: {
  id: string;
  assetId: string;
  tableId: string;
  revisionNo?: number;
}) {
  return {
    id: input.id,
    table_evidence_asset_id: input.assetId,
    revision_no: input.revisionNo ?? 1,
    source_snapshot: createTableSourceSnapshot(
      input.tableId,
      input.tableId === "table-2" ? "Endpoint" : "Baseline",
    ),
    correction_patch: { patch_id: `patch-${input.id}`, operations: [] },
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
  };
}

function createConfirmedTableEvidenceRevision(input: {
  id: string;
  assetId: string;
  tableId: string;
  revisionNo: number;
}) {
  const sourceSnapshot = createTableSourceSnapshot(input.tableId, "Endpoint");
  const fidelityReport = {
    status: "confirmed",
    failure_codes: [],
    unsupported_fact_groups: [],
    required_confirmations: ["invisible_chars", "special_symbols"],
    invisible_chars_confirmed: true,
    special_symbols_confirmed: true,
  };
  return {
    ...createPendingTableEvidenceRevision(input),
    confirmation_status: "confirmed",
    confirmed_at: "2026-04-29T00:00:00.000Z",
    confirmed_by: "dev.admin",
    fidelity_report: fidelityReport,
    confirmed_snapshot: {
      snapshot_id: `confirmed-${input.tableId}`,
      source_snapshot_id: sourceSnapshot.snapshot_id,
      row_count: sourceSnapshot.row_count,
      column_count: sourceSnapshot.column_count,
      notes: sourceSnapshot.notes,
      grid_cells: sourceSnapshot.grid_cells,
    },
    ai_table_package: {
      package_id: "pkg-2",
      asset_id: input.assetId,
      revision_id: input.id,
      revision_no: input.revisionNo,
      source_file_asset_id: "file-1",
      authority: "authoritative",
      confirmation_status: "confirmed",
      fidelity_status: "confirmed",
      confirmed_by_human: true,
      confirmed_by: "dev.admin",
      confirmed_at: "2026-04-29T00:00:00.000Z",
      parser: "python_docx_ooxml",
      parser_version: "table-evidence-v1",
      source_snapshot_hash: "source-hash",
      confirmed_snapshot_hash: "confirmed-hash",
      ai_table_package_hash: "package-hash",
      notes: [],
      structure: {
        row_count: sourceSnapshot.row_count,
        column_count: sourceSnapshot.column_count,
        header_depth: 1,
        merged_cells: [],
      },
      cells: sourceSnapshot.grid_cells,
      fidelity_report: fidelityReport,
    },
  };
}

function createTableSourceSnapshot(tableId: string, text: string) {
  return {
    snapshot_id: `source-${tableId}`,
    table_id: tableId,
    source_file_asset_id: "file-1",
    parser: "python_docx_ooxml",
    parser_version: "table-evidence-v1",
    row_count: 1,
    column_count: 1,
    notes: [],
    object_evidence: [],
    warnings: [],
    grid_cells: [
      {
        cell_id: `${tableId}-cell-1`,
        row: 0,
        column: 0,
        rowspan: 1,
        colspan: 1,
        role: "data",
        text,
        display_text: text,
        codepoints: Array.from(text).map((char) =>
          char.codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0") ?? "",
        ),
        paragraphs: [],
        runs: [],
        header_path: [],
        row_header_path: [],
        column_header_path: [],
        invisible_chars: [],
        style_summary: {},
      },
    ],
  };
}
