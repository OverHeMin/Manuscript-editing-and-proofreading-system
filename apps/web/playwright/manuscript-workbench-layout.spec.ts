import { expect, test } from "@playwright/test";
import { semanticTableDocxBase64 } from "../../../test-support/semantic-table-docx.ts";

const apiBaseUrl =
  process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:3001";

test.use({
  viewport: {
    width: 1366,
    height: 768,
  },
});

test("screening intake keeps the upload button within the visible batch slab", async ({
  page,
}) => {
  await page.goto("/#screening", {
    waitUntil: "domcontentloaded",
  });
  await maybeLogin(page);
  await page.waitForSelector('[data-layout="manuscript-desk-family"]');

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
    const batchSlab = document.querySelector('[data-pane="batch-slab"]');

    if (
      !(uploadButtonElement instanceof HTMLElement) ||
      !(batchSlab instanceof HTMLElement)
    ) {
      return null;
    }

    const uploadButtonBox = uploadButtonElement.getBoundingClientRect();
    const batchSlabBox = batchSlab.getBoundingClientRect();
    return {
      uploadButtonBottom: uploadButtonBox.bottom,
      batchSlabBottom: batchSlabBox.bottom,
    };
  });

  expect(metrics).not.toBeNull();
  expect(metrics!.uploadButtonBottom).toBeLessThanOrEqual(
    metrics!.batchSlabBottom,
  );
});

test("screening primary canvas keeps the module action button within the visible focus panel", async ({
  page,
  request,
}) => {
  const loginResponse = await request.post(`${apiBaseUrl}/api/v1/auth/local/login`, {
    data: {
      username: "dev.admin",
      password: "demo-password",
    },
  });
  expect(loginResponse.ok()).toBeTruthy();

  const uploadResponse = await request.post(`${apiBaseUrl}/api/v1/manuscripts/upload`, {
    data: {
      title: "Layout regression manuscript",
      fileName: "layout-regression.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileContentBase64: semanticTableDocxBase64,
      storageKey: "",
    },
  });
  expect(uploadResponse.ok()).toBeTruthy();
  const uploadPayload = (await uploadResponse.json()) as {
    manuscript: {
      id: string;
    };
  };

  await page.goto(`/#screening?manuscriptId=${uploadPayload.manuscript.id}`, {
    waitUntil: "domcontentloaded",
  });
  await maybeLogin(page);
  await page.waitForSelector('[data-focus-canvas="manuscript-first"]');

  const actionButton = page.getByRole("button", { name: "执行初筛" }).first();
  await expect(actionButton).toBeVisible();

  const metrics = await page.evaluate(() => {
    const actionButtonElement = Array.from(document.querySelectorAll("button")).find(
      (element) => element.textContent?.trim() === "执行初筛",
    );
    const focusPanel = document.querySelector(".manuscript-workbench-focus-panel");

    if (
      !(actionButtonElement instanceof HTMLElement) ||
      !(focusPanel instanceof HTMLElement)
    ) {
      return null;
    }

    const actionButtonBox = actionButtonElement.getBoundingClientRect();
    const focusPanelBox = focusPanel.getBoundingClientRect();
    return {
      actionButtonBottom: actionButtonBox.bottom,
      focusPanelBottom: focusPanelBox.bottom,
    };
  });

  expect(metrics).not.toBeNull();
  expect(metrics!.actionButtonBottom).toBeLessThanOrEqual(
    metrics!.focusPanelBottom,
  );
});

test("screening focus card exposes direct current asset shortcuts without requiring export first", async ({
  page,
  request,
}) => {
  const loginResponse = await request.post(`${apiBaseUrl}/api/v1/auth/local/login`, {
    data: {
      username: "dev.admin",
      password: "demo-password",
    },
  });
  expect(loginResponse.ok()).toBeTruthy();

  const uploadResponse = await request.post(`${apiBaseUrl}/api/v1/manuscripts/upload`, {
    data: {
      title: "Direct asset shortcut manuscript",
      fileName: "direct-asset-shortcut.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileContentBase64: semanticTableDocxBase64,
      storageKey: "",
    },
  });
  expect(uploadResponse.ok()).toBeTruthy();
  const uploadPayload = (await uploadResponse.json()) as {
    manuscript: {
      id: string;
    };
    asset: {
      id: string;
    };
  };

  await page.goto(`/#screening?manuscriptId=${uploadPayload.manuscript.id}`, {
    waitUntil: "domcontentloaded",
  });
  await maybeLogin(page);
  await page.waitForSelector('[data-focus-canvas="manuscript-first"]');

  const viewShortcut = page.getByRole("link", { name: "查看当前稿件" }).first();
  const downloadShortcut = page.getByRole("link", { name: "下载当前稿件" }).first();
  await expect(viewShortcut).toBeVisible();
  await expect(downloadShortcut).toBeVisible();
  await expect(viewShortcut).toHaveAttribute(
    "href",
    `${apiBaseUrl}/api/v1/document-assets/${uploadPayload.asset.id}/download`,
  );
  await expect(downloadShortcut).toHaveAttribute(
    "href",
    `${apiBaseUrl}/api/v1/document-assets/${uploadPayload.asset.id}/download`,
  );
});

async function maybeLogin(page: Parameters<typeof test>[0]["page"]) {
  const username = page.locator('input[name="username"]');
  if (!(await username.first().isVisible().catch(() => false))) {
    return;
  }

  await username.first().fill("dev.admin");
  await page.locator('input[name="password"]').first().fill("demo-password");
  await page.getByRole("button", { name: "登录" }).click();
}
