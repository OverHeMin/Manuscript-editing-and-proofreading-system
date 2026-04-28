import { expect, test, type Page } from "@playwright/test";
import { semanticTableDocxBase64 } from "../../../test-support/semantic-table-docx.ts";

const apiBaseUrl =
  process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:3001";

test.use({
  viewport: {
    width: 1366,
    height: 768,
  },
});

test("screening main page keeps upload controls inside the shared workspace stage", async ({
  page,
}) => {
  await page.goto("/#screening", {
    waitUntil: "domcontentloaded",
  });
  await maybeLogin(page);

  await expect(page.locator('[data-layout="manuscript-desk-family"]')).toBeVisible();
  await expect(page.locator('[data-pane="workspace-stage"]').first()).toBeVisible();
  await expect(page.locator('[data-pane="result-stage"]').first()).toBeVisible();

  await page.getByLabel("标题").first().fill("Layout regression manuscript");
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "layout-regression.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: Buffer.from(semanticTableDocxBase64, "base64"),
  });

  const uploadButton = page.getByRole("button", { name: "上传稿件" }).first();
  await expect(uploadButton).toBeEnabled();

  const metrics = await page.evaluate(() => {
    const uploadButtonElement = Array.from(document.querySelectorAll("button")).find(
      (element) => element.textContent?.trim() === "上传稿件",
    );
    const operationPanel = document.querySelector(".manuscript-workbench-operation-panel");

    if (
      !(uploadButtonElement instanceof HTMLElement) ||
      !(operationPanel instanceof HTMLElement)
    ) {
      return null;
    }

    const uploadButtonBox = uploadButtonElement.getBoundingClientRect();
    const operationPanelBox = operationPanel.getBoundingClientRect();
    return {
      uploadButtonBottom: uploadButtonBox.bottom,
      operationPanelBottom: operationPanelBox.bottom,
    };
  });

  expect(metrics).not.toBeNull();
  expect(metrics!.uploadButtonBottom).toBeLessThanOrEqual(
    metrics!.operationPanelBottom,
  );
});

test("screening workbench keeps the module action reachable inside the scrollable operation panel", async ({
  page,
  request,
}) => {
  const uploadPayload = await createUploadedManuscript(request, "Layout regression manuscript");

  await page.goto(`/#screening?manuscriptId=${uploadPayload.manuscript.id}`, {
    waitUntil: "domcontentloaded",
  });
  await maybeLogin(page);

  await expect(page.locator(".manuscript-workbench-operation-panel")).toBeVisible();
  await expect(page.locator(".manuscript-workbench-result-panel")).toBeVisible();

  const actionButton = page.getByRole("button", { name: "执行初筛" }).first();
  await actionButton.scrollIntoViewIfNeeded();
  await expect(actionButton).toBeVisible();

  const metrics = await page.evaluate(() => {
    const actionButtonElement = Array.from(document.querySelectorAll("button")).find(
      (element) => element.textContent?.trim() === "执行初筛",
    );
    const operationPanel = document.querySelector(".manuscript-workbench-operation-panel");

    if (
      !(actionButtonElement instanceof HTMLElement) ||
      !(operationPanel instanceof HTMLElement)
    ) {
      return null;
    }

    const actionButtonBox = actionButtonElement.getBoundingClientRect();
    const operationPanelBox = operationPanel.getBoundingClientRect();
    return {
      actionButtonTop: actionButtonBox.top,
      actionButtonBottom: actionButtonBox.bottom,
      operationPanelTop: operationPanelBox.top,
      operationPanelBottom: operationPanelBox.bottom,
    };
  });

  expect(metrics).not.toBeNull();
  expect(metrics!.actionButtonTop).toBeGreaterThanOrEqual(
    metrics!.operationPanelTop,
  );
  expect(metrics!.actionButtonBottom).toBeLessThanOrEqual(
    metrics!.operationPanelBottom,
  );
});

test("screening result panel exposes current manuscript shortcuts without requiring export first", async ({
  page,
  request,
}) => {
  const uploadPayload = await createUploadedManuscript(
    request,
    "Direct asset shortcut manuscript",
  );

  await page.goto(`/#screening?manuscriptId=${uploadPayload.manuscript.id}`, {
    waitUntil: "domcontentloaded",
  });
  await maybeLogin(page);

  await expect(page.locator(".manuscript-workbench-result-panel")).toBeVisible();
  await expectLoadedManuscript(page, "Direct asset shortcut manuscript");

  const viewShortcut = page.getByRole("link", { name: "查看稿件" }).first();
  const downloadShortcut = page.getByRole("link", { name: "下载稿件" }).first();
  await expect(viewShortcut).toBeVisible();
  await expect(downloadShortcut).toBeVisible();
  await expect(viewShortcut).toHaveAttribute(
    "href",
    new RegExp(`#screening\\?manuscriptId=${uploadPayload.manuscript.id}&assetId=[0-9a-f-]+`),
  );
  const viewHref = await viewShortcut.getAttribute("href");
  const displayedAssetId = viewHref
    ? new URLSearchParams(viewHref.split("?")[1] ?? "").get("assetId")
    : null;
  expect(displayedAssetId).toBeTruthy();
  await expect(downloadShortcut).toHaveAttribute(
    "href",
    `${apiBaseUrl}/api/v1/document-assets/${displayedAssetId}/download`,
  );
});

async function createUploadedManuscript(
  request: Parameters<typeof test>[0]["request"],
  title: string,
) {
  const loginResponse = await request.post(`${apiBaseUrl}/api/v1/auth/local/login`, {
    data: {
      username: "dev.admin",
      password: "demo-password",
    },
  });
  expect(loginResponse.ok()).toBeTruthy();

  const uploadResponse = await request.post(`${apiBaseUrl}/api/v1/manuscripts/upload`, {
    data: {
      title,
      fileName: `${title.replaceAll(" ", "-").toLowerCase()}.docx`,
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileContentBase64: semanticTableDocxBase64,
      storageKey: "",
    },
  });
  expect(uploadResponse.ok()).toBeTruthy();

  return (await uploadResponse.json()) as {
    manuscript: {
      id: string;
    };
    asset: {
      id: string;
    };
  };
}

async function expectLoadedManuscript(page: Page, title: string) {
  const workspaceStage = page.locator('[data-pane="workspace-stage"]').first();
  await expect(workspaceStage).toContainText("当前稿件");
  await expect(workspaceStage).toContainText(title);
}

async function maybeLogin(page: Parameters<typeof test>[0]["page"]) {
  const username = page.locator('input[name="username"]');
  if (!(await username.first().isVisible().catch(() => false))) {
    return;
  }

  await username.first().fill("dev.admin");
  await page.locator('input[name="password"]').first().fill("demo-password");
  await page.getByRole("button", { name: "登录" }).click();
}
