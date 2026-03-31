import { expect, test } from "@playwright/test";

test("admin can submit a governed knowledge draft from learning review into knowledge review", async ({
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
      title: "Phase 8AB Knowledge Review Handoff Smoke",
      manuscriptType: "clinical_study",
      createdBy: "ignored-by-server",
      fileName: "phase8ab-source.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      storageKey: "uploads/phase8ab/phase8ab-source.docx",
    },
  });
  expect(uploadResponse.ok()).toBeTruthy();

  const uploaded = (await uploadResponse.json()) as {
    manuscript: {
      id: string;
    };
  };
  const manuscriptId = uploaded.manuscript.id;
  const knowledgeTitle = `Phase 8AB knowledge draft ${manuscriptId}`;

  await page.goto(`/#screening?manuscriptId=${manuscriptId}`, {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Screening Workbench" })).toBeVisible();
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeHidden({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Run Screening" }).click();
  await expect(page.getByRole("link", { name: "Open Editing Workbench" })).toBeVisible();

  await page.getByRole("link", { name: "Open Editing Workbench" }).click();
  await expect(page.getByRole("heading", { name: "Editing Workbench" })).toBeVisible();
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeHidden({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Run Editing" }).click();
  await expect(page.getByRole("link", { name: "Open Proofreading Workbench" })).toBeVisible();

  await page.getByRole("link", { name: "Open Proofreading Workbench" }).click();
  await expect(page.getByRole("heading", { name: "Proofreading Workbench" })).toBeVisible();
  await expect(page.locator(".manuscript-workbench-loading-card")).toBeHidden({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Create Draft" }).click();
  await page.getByRole("button", { name: "Finalize Proofreading" }).click();
  await page.getByRole("button", { name: "Publish Human Final" }).click();
  await expect(page.getByRole("link", { name: "Open Learning Review" })).toBeVisible();

  await page.getByRole("link", { name: "Open Learning Review" }).click();
  await expect(page.getByRole("heading", { name: "Governed learning review desk" })).toBeVisible();
  await page.getByRole("button", { name: "Create snapshot" }).click();
  await page.getByRole("textbox", { name: "Title", exact: true }).fill(
    `Phase 8AB candidate ${manuscriptId}`,
  );
  await page.getByRole("button", { name: "Create governed candidate" }).click();
  await page.getByRole("button", { name: "Approve selected candidate" }).click();
  await page.getByRole("button", { name: "Create writeback" }).click();
  await page.getByRole("textbox", { name: "Knowledge Title", exact: true }).fill(
    knowledgeTitle,
  );
  await page.getByRole("button", { name: "Apply writeback" }).click();

  await expect(page.getByRole("button", { name: "Submit Knowledge Draft For Review" })).toBeEnabled();
  await page.getByRole("button", { name: "Submit Knowledge Draft For Review" }).click();

  await expect(page.locator("body")).toContainText("Knowledge draft submitted for review:");
  await expect(page.getByRole("link", { name: "Open Knowledge Review" })).toBeVisible();

  await page.getByRole("link", { name: "Open Knowledge Review" }).click();
  await expect(page.getByRole("heading", { name: "Pending Review Queue" })).toBeVisible();
  await expect(page.locator("body")).toContainText(knowledgeTitle);
  await expect(page.getByRole("button", { name: "Approve" })).toBeEnabled();
});
