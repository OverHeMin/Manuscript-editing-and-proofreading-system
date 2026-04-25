import { expect, test } from "@playwright/test";
import { semanticTableDocxBase64 } from "../../../test-support/semantic-table-docx.ts";

const apiBaseUrl =
  process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:3001";

test("manuscript harness page exposes governed matrix, deep proofreading, editing gate, and route actions", async ({
  page,
  request,
}) => {
  await request.post(`${apiBaseUrl}/api/v1/auth/local/login`, {
    data: {
      username: "dev.admin",
      password: "demo-password",
    },
  });

  const uploadResponse = await request.post(`${apiBaseUrl}/api/v1/manuscripts/upload`, {
    data: {
      title: `Harness Acceptance ${Date.now()}`,
      manuscriptType: "clinical_study",
      createdBy: "ignored-by-server",
      fileName: "harness-acceptance.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileContentBase64: semanticTableDocxBase64,
    },
  });
  expect(uploadResponse.ok()).toBeTruthy();
  const uploaded = (await uploadResponse.json()) as {
    manuscript: { id: string };
    asset: { id: string };
  };

  const screeningResponse = await request.post(
    `${apiBaseUrl}/api/v1/modules/screening/run`,
    {
      data: {
        manuscriptId: uploaded.manuscript.id,
        parentAssetId: uploaded.asset.id,
        storageKey: "runs/browser-acceptance/screening.md",
        fileName: "browser-acceptance-screening.md",
      },
    },
  );
  expect(screeningResponse.ok()).toBeTruthy();
  const screening = (await screeningResponse.json()) as {
    snapshot_id: string;
    asset: { id: string };
  };

  const governedHitResponse = await request.post(
    `${apiBaseUrl}/api/v1/review-items/governed-hits`,
    {
      data: {
        manuscriptId: uploaded.manuscript.id,
        manuscriptType: "clinical_study",
        module: "screening",
        snapshotId: screening.snapshot_id,
        sourceAssetId: screening.asset.id,
        feedbackCategory: "missed_hit",
        feedbackText: "Browser acceptance governed hit for Harness route actions.",
        candidatePosture: "inspect_only",
        decisionSource: "manual_feedback",
      },
    },
  );
  expect(governedHitResponse.ok()).toBeTruthy();

  const editingResponse = await request.post(`${apiBaseUrl}/api/v1/modules/editing/run`, {
    data: {
      manuscriptId: uploaded.manuscript.id,
      parentAssetId: uploaded.asset.id,
      storageKey: "runs/browser-acceptance/editing.docx",
      fileName: "browser-acceptance-editing.docx",
    },
  });
  expect(editingResponse.ok()).toBeTruthy();

  const proofreadingResponse = await request.post(
    `${apiBaseUrl}/api/v1/modules/proofreading/draft`,
    {
      data: {
        manuscriptId: uploaded.manuscript.id,
        parentAssetId: uploaded.asset.id,
        storageKey: "runs/browser-acceptance/proofreading.md",
        fileName: "browser-acceptance-proofreading.md",
      },
    },
  );
  expect(proofreadingResponse.ok()).toBeTruthy();

  await page.goto(`/#manuscript-harness?manuscriptId=${uploaded.manuscript.id}`, {
    waitUntil: "domcontentloaded",
  });

  await expect(page.locator(".manuscript-workbench-loading-card")).toHaveCount(0);
  await expect(page.locator("body")).toContainText(uploaded.manuscript.id);
  await expect(page.locator("body")).toContainText("筛稿");
  await expect(page.locator("body")).toContainText("编辑");
  await expect(page.locator("body")).toContainText("校对");
  await expect(page.locator("body")).toContainText("编辑完成门禁");
  await expect(page.locator("body")).toContainText("深度校对轮次");
  await expect(page.locator("body")).toContainText("转规则");
  await expect(page.locator("body")).toContainText("转知识");
  await expect(page.locator("body")).toContainText("转 Prompt");
  await expect(page.locator("body")).toContainText("提交为漏检项");
  expect(await page.locator(".manuscript-harness-item").count()).toBeGreaterThan(10);
});
