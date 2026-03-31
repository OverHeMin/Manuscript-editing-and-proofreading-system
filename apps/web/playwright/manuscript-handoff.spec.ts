import { expect, test } from "@playwright/test";

test("admin can follow screening to proofreading handoffs with visible prefill loading state", async ({
  page,
  request,
}) => {
  await request.post("http://127.0.0.1:3001/api/v1/auth/local/login", {
    data: {
      username: "dev.user",
      password: "demo-password",
    },
  });

  const uploadResponse = await request.post("http://127.0.0.1:3001/api/v1/manuscripts/upload", {
    data: {
      title: "Phase 8T Browser QA Manuscript",
      manuscriptType: "clinical_study",
      createdBy: "ignored-by-server",
      fileName: "phase8t-source.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      storageKey: "uploads/phase8t/phase8t-source.docx",
    },
  });
  expect(uploadResponse.ok()).toBeTruthy();

  const uploaded = (await uploadResponse.json()) as {
    manuscript: {
      id: string;
      current_template_family_id?: string;
    };
    asset: {
      id: string;
    };
  };
  const manuscriptId = uploaded.manuscript.id;
  expect(uploaded.manuscript.current_template_family_id).toBe("family-seeded-1");

  await page.route(`**/api/v1/manuscripts/${manuscriptId}`, async (route) => {
    await page.waitForTimeout(600);
    await route.continue();
  });
  await page.route(`**/api/v1/manuscripts/${manuscriptId}/assets`, async (route) => {
    await page.waitForTimeout(600);
    await route.continue();
  });

  await page.goto(`/#screening?manuscriptId=${manuscriptId}`, {
    waitUntil: "domcontentloaded",
  });

  await expect(page).toHaveTitle(/Medical Manuscript System - Web/i);
  await expect(page.locator("body")).toContainText("Signed in as Admin");
  await expect(page.getByRole("heading", { name: "Screening Workbench" })).toBeVisible();
  await expect(page.locator("body")).toContainText(`Loading manuscript ${manuscriptId}...`);
  await expect(page.locator("body")).toContainText(
    "Fetching workspace assets and latest governed state before enabling actions.",
  );
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeVisible();
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeHidden({
    timeout: 10_000,
  });
  await expect(page.locator("body")).toContainText(`Auto-loaded manuscript ${manuscriptId}`);

  const runScreeningButton = page.getByRole("button", { name: "Run Screening" });
  await expect(runScreeningButton).toBeEnabled();
  await runScreeningButton.click();
  await expect(page.locator("body")).toContainText("Action Complete");
  await expect(page.locator("body")).toContainText("Created asset");
  await expect(page.getByRole("link", { name: "Open Editing Workbench" })).toBeVisible();

  await page.getByRole("link", { name: "Open Editing Workbench" }).click();
  await expect(page.getByRole("heading", { name: "Editing Workbench" })).toBeVisible();
  await expect(page.locator("body")).toContainText(`Loading manuscript ${manuscriptId}...`);
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeHidden({
    timeout: 10_000,
  });
  await expect(page.locator("body")).toContainText(`Auto-loaded manuscript ${manuscriptId}`);

  const runEditingButton = page.getByRole("button", { name: "Run Editing" });
  await expect(runEditingButton).toBeEnabled();
  await runEditingButton.click();
  await expect(page.locator("body")).toContainText("Created asset");
  await expect(page.getByRole("link", { name: "Open Proofreading Workbench" })).toBeVisible();

  await page.getByRole("link", { name: "Open Proofreading Workbench" }).click();
  await expect(page.getByRole("heading", { name: "Proofreading Workbench" })).toBeVisible();
  await expect(page.locator("body")).toContainText(`Loading manuscript ${manuscriptId}...`);
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeHidden({
    timeout: 10_000,
  });
  await expect(page.locator("body")).toContainText(`Auto-loaded manuscript ${manuscriptId}`);

  const createDraftButton = page.getByRole("button", { name: "Create Draft" });
  await expect(createDraftButton).toBeEnabled();
  await createDraftButton.click();
  await expect(page.locator("body")).toContainText("proofreading_draft_report");
  await expect(page.locator("body")).toContainText(
    "Human confirmation is still required before producing the proofreading final.",
  );
  await expect(page.getByRole("button", { name: "Finalize Proofreading" })).toBeEnabled();

  await page.getByRole("button", { name: "Finalize Proofreading" }).click();
  await expect(page.locator("body")).toContainText("Finalized asset");
  await expect(page.locator("body")).toContainText(
    "The proofreading final is active and ready for downstream delivery.",
  );

  await page.getByRole("button", { name: "Export Current Asset" }).click();
  await expect(page.locator("body")).toContainText("Prepared export");
  await expect(page.locator("body")).toContainText("Export File Name");
  await expect(page.locator("body")).toContainText("proofreading-final.docx");
  await expect(page.locator("body")).toContainText("Download MIME Type");
  await expect(page.locator("body")).toContainText(
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  await expect(page.locator("body")).toContainText(
    `runs/${manuscriptId}/proofreading/final`,
  );
  const downloadLink = page.getByRole("link", { name: "Download Latest Export" });
  await expect(downloadLink).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await downloadLink.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("proofreading-final.docx");
});
