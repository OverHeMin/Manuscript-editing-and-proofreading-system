import { expect, test, type APIRequestContext } from "@playwright/test";

const apiBaseUrl =
  process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:3001";
const seededFamilyId = "family-seeded-1";
const seededFamilyName = "Seeded Clinical Study Family";
const abstractObjectiveSource = "\u6458\u8981 \u76ee\u7684";
const abstractObjectiveNormalized = "\uff08\u6458\u8981\u3000\u76ee\u7684\uff09";
const journalObjectiveNormalized = "\uff08\u6458\u8981\u3000\u76ee\u7684\uff09\uff1a";

test("admin can create a template family and module draft from the governance console", async ({
  page,
  request,
}) => {
  await loginAsDemoUser(request, "dev.admin");

  const familyName = `Phase 8AE family ${Date.now()}`;
  const draftPrompt = `${familyName} proofreading prompt`;

  await page.goto("/#admin-console", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Admin Governance Console" })).toBeVisible();

  const createFamilyPanel = page
    .locator("article.admin-governance-panel")
    .filter({ has: page.getByRole("heading", { name: "Create Template Family" }) });
  await createFamilyPanel.getByLabel("Manuscript Type").selectOption("clinical_study");
  await createFamilyPanel.getByLabel("Family Name").fill(familyName);
  await createFamilyPanel.getByRole("button", { name: "Create Family" }).click();

  await expect(page.locator(".admin-governance-status")).toContainText(
    `Created template family: ${familyName}`,
  );

  const familiesPanel = page
    .locator("article.admin-governance-panel")
    .filter({ has: page.getByRole("heading", { name: "Template Families" }) });
  await expect(familiesPanel).toContainText(familyName);
  await familiesPanel.getByRole("button", { name: new RegExp(familyName) }).click();

  const moduleDraftPanel = page
    .locator("article.admin-governance-panel")
    .filter({ has: page.getByRole("heading", { name: "Module Template Drafts" }) });
  await moduleDraftPanel.getByLabel("Module").selectOption("proofreading");
  await moduleDraftPanel.getByLabel("Prompt").fill(draftPrompt);
  await moduleDraftPanel.getByRole("button", { name: "Create Module Draft" }).click();

  await expect(page.locator(".admin-governance-status")).toContainText(
    /Created module template draft v\d+\./,
  );
  await expect(moduleDraftPanel).toContainText(draftPrompt);
  await expect(moduleDraftPanel).toContainText("draft");
});

test("admin can preview the seeded governed execution bundle from the governance console", async ({
  page,
  request,
}) => {
  await loginAsDemoUser(request, "dev.admin");

  await page.goto("/#admin-console", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Admin Governance Console" })).toBeVisible();

  const executionPanel = page
    .locator("article.admin-governance-panel")
    .filter({ has: page.getByRole("heading", { name: "Execution Governance" }) });

  await executionPanel.getByLabel("Template Family").selectOption({ label: seededFamilyName });
  await executionPanel.getByLabel("Module").selectOption("editing");
  await executionPanel.getByRole("button", { name: "Preview Execution Bundle" }).click();

  await expect(page.locator(".admin-governance-status")).toContainText(
    "Resolved execution bundle preview.",
  );

  const resolutionGrid = executionPanel.locator(".admin-governance-resolution-grid");
  await expect(resolutionGrid).toContainText("profile-editing-1");
  await expect(resolutionGrid).toContainText("openai / editing-model");
  await expect(resolutionGrid).toContainText("rule-set-editing-1");
  await expect(resolutionGrid).toContainText("editing_mainline");
});

test("template governance supports journal-scoped abstract and table rule authoring", async ({
  page,
  request,
}) => {
  await loginAsDemoUser(request, "dev.admin");

  const familyName = `Case Report Rules ${Date.now()}`;
  const journalName = `\u300a\u6848\u4f8b\u62a5\u9053\u6d4f\u89c8 ${Date.now()}\u300b`;
  const journalKey = slugify(`case-report-journal-${Date.now()}`);

  await page.goto("/#template-governance", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Template Governance" })).toBeVisible();

  await page.getByRole("combobox", { name: "Manuscript Type", exact: true }).selectOption(
    "case_report",
  );
  await page.getByRole("textbox", { name: "Family Name", exact: true }).fill(familyName);
  await page.getByRole("button", { name: "Create Family Draft" }).click();

  await expect(page.locator(".template-governance-status")).toContainText(
    "Template family created.",
  );
  const createdFamilyButton = page.getByRole("button", { name: new RegExp(familyName) });
  await expect(createdFamilyButton).toBeVisible();
  await createdFamilyButton.click();

  await page.getByRole("textbox", { name: "Journal Name" }).fill(journalName);
  await page.getByRole("textbox", { name: "Journal Key" }).fill(journalKey);
  await page.getByRole("button", { name: "Create Journal Template" }).click();

  await expect(page.locator(".template-governance-status")).toContainText(
    "Journal template profile created.",
  );

  const journalCard = page
    .getByRole("button", { name: "Activate" })
    .locator("xpath=ancestor::article[contains(@class,'template-governance-card')]")
    .first();
  await expect(journalCard).toContainText(journalName);
  await expect(journalCard).toContainText("draft");
  await journalCard.getByRole("button", { name: "Activate" }).click();

  await expect(page.locator(".template-governance-status")).toContainText(
    "Journal template profile activated.",
  );
  await expect(page.getByText(`${journalKey} | active`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Selected Scope" })).toBeVisible();

  const navigatorCard = page
    .getByRole("heading", { name: "Rule Authoring Navigator" })
    .locator("xpath=ancestor::article[contains(@class,'template-governance-card')]")
    .first();
  const previewPanel = page
    .getByRole("heading", { name: "Rule Authoring Preview" })
    .locator("xpath=ancestor::article[contains(@class,'template-governance-card')]")
    .first();

  await navigatorCard.getByRole("combobox", { name: "Module" }).selectOption("editing");
  await navigatorCard.getByRole("button", { name: "Create Rule Set Draft" }).click();

  await expect(page.locator(".template-governance-status")).toContainText(
    "Rule set draft created.",
  );
  await expect(previewPanel).toContainText("Journal override:");
  await expect(previewPanel).toContainText(
    `${abstractObjectiveSource} -> ${abstractObjectiveNormalized}`,
  );

  await page.getByRole("button", { name: "Create Rule Draft" }).click();

  await expect(page.locator(".template-governance-status")).toContainText("Rule draft created.");
  await expect(page.locator(".template-governance-rule-layout-main")).toContainText(
    `${abstractObjectiveSource} -> ${abstractObjectiveNormalized}`,
  );

  await page.getByRole("button", { name: "Table" }).click();
  await expect(previewPanel).toContainText("Inspect only");
  await expect(previewPanel).toContainText("table=three_line_table");
  await page.getByRole("button", { name: "Create Rule Draft" }).click();

  await expect(page.locator(".template-governance-status")).toContainText("Rule draft created.");
  await expect(page.locator(".template-governance-rule-layout-main")).toContainText(
    "three_line_table",
  );
  await expect(page.locator(".template-governance-rule-layout-main")).toContainText(
    "\u7981\u7528\u7ad6\u7ebf",
  );
});

test("editing workbench saves a journal template context before running editing", async ({
  page,
  request,
}) => {
  const prepared = await prepareEditingWorkbenchJournalScenario(request, {
    label: `workbench-${Date.now()}`,
  });

  await page.goto(`/#editing?manuscriptId=${prepared.manuscriptId}`, {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "编辑工作台" })).toBeVisible();
  await expect(page.locator("body")).toContainText(prepared.manuscriptId);
  await expect(page.locator("body")).toContainText("基础模板家族");
  await expect(page.locator("body")).toContainText(seededFamilyName);

  const journalPanel = page
    .locator(".manuscript-workbench-panel")
    .filter({ has: page.getByRole("heading", { name: "期刊模板" }) });
  const journalSelect = journalPanel.getByLabel("期刊模板");

  await expect(journalSelect).toBeVisible();
  await journalSelect.selectOption({ label: prepared.journalName });
  await journalPanel.getByRole("button", { name: "保存模板上下文" }).click();

  await expect(page.locator("body")).toContainText(
    `Updated template context for ${prepared.manuscriptId}`,
  );
  await expect(page.locator("body")).toContainText(prepared.journalName);
  await expect(page.locator("body")).toContainText("期刊覆写");
  await expect(page.locator("body")).toContainText("Active");

  const parentAssetSelect = page.getByLabel("父资产");
  await expect(parentAssetSelect).toBeVisible();
  await expect(parentAssetSelect).not.toHaveValue("");

  const manuscriptResponse = await request.get(
    `${apiBaseUrl}/api/v1/manuscripts/${prepared.manuscriptId}`,
  );
  expect(manuscriptResponse.ok()).toBeTruthy();
  const manuscript = (await manuscriptResponse.json()) as {
    current_journal_template_id?: string;
  };
  expect(manuscript.current_journal_template_id).toBe(prepared.journalTemplateId);

  await page.getByRole("button", { name: "执行编辑" }).click();

  await expect(page.locator("body")).toContainText("Created asset");
  await expect(page.locator("body")).toContainText(prepared.journalName);
});

async function prepareEditingWorkbenchJournalScenario(
  request: APIRequestContext,
  input: {
    label: string;
  },
): Promise<{
  manuscriptId: string;
  journalTemplateId: string;
  journalName: string;
}> {
  await loginAsDemoUser(request, "dev.admin");

  const slug = slugify(input.label);
  const journalName = `${input.label} Journal Overlay`;
  const journalKey = `${slug}-journal`;

  const journalTemplateResponse = await request.post(
    `${apiBaseUrl}/api/v1/templates/journal-templates`,
    {
      data: {
        templateFamilyId: seededFamilyId,
        manuscriptType: "clinical_study",
        journalKey,
        journalName,
      },
    },
  );
  expect(journalTemplateResponse.ok()).toBeTruthy();
  const journalTemplate = (await journalTemplateResponse.json()) as { id: string };

  const activateJournalResponse = await request.post(
    `${apiBaseUrl}/api/v1/templates/journal-templates/${journalTemplate.id}/activate`,
    {
      data: {
        actorRole: "admin",
      },
    },
  );
  expect(activateJournalResponse.ok()).toBeTruthy();

  const ruleSetResponse = await request.post(`${apiBaseUrl}/api/v1/editorial-rules/rule-sets`, {
    data: {
      actorRole: "admin",
      templateFamilyId: seededFamilyId,
      journalTemplateId: journalTemplate.id,
      module: "editing",
    },
  });
  expect(ruleSetResponse.ok()).toBeTruthy();
  const ruleSet = (await ruleSetResponse.json()) as { id: string };

  const ruleResponse = await request.post(
    `${apiBaseUrl}/api/v1/editorial-rules/rule-sets/${ruleSet.id}/rules`,
    {
      data: {
        actorRole: "admin",
        orderNo: 10,
        ruleObject: "abstract",
        ruleType: "format",
        executionMode: "apply_and_inspect",
        scope: {
          sections: ["abstract"],
          block_kind: "heading",
        },
        selector: {
          section_selector: "abstract",
          label_selector: {
            text: abstractObjectiveSource,
          },
        },
        trigger: {
          kind: "exact_text",
          text: abstractObjectiveSource,
        },
        action: {
          kind: "replace_heading",
          to: journalObjectiveNormalized,
        },
        authoringPayload: {
          label_role: "objective",
          source_label_text: abstractObjectiveSource,
          normalized_label_text: journalObjectiveNormalized,
        },
        evidenceLevel: "high",
        confidencePolicy: "always_auto",
        severity: "error",
        enabled: true,
        exampleBefore: abstractObjectiveSource,
        exampleAfter: journalObjectiveNormalized,
      },
    },
  );
  expect(ruleResponse.ok()).toBeTruthy();

  const publishRuleSetResponse = await request.post(
    `${apiBaseUrl}/api/v1/editorial-rules/rule-sets/${ruleSet.id}/publish`,
    {
      data: {
        actorRole: "admin",
      },
    },
  );
  expect(publishRuleSetResponse.ok()).toBeTruthy();

  const uploadResponse = await request.post(`${apiBaseUrl}/api/v1/manuscripts/upload`, {
    data: {
      title: `${input.label} clinical manuscript`,
      manuscriptType: "clinical_study",
      createdBy: "ignored-by-server",
      fileName: `${slug}-source.docx`,
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      storageKey: `uploads/${slug}/${slug}-source.docx`,
    },
  });
  expect(uploadResponse.ok()).toBeTruthy();
  const uploaded = (await uploadResponse.json()) as {
    manuscript: { id: string };
  };

  return {
    manuscriptId: uploaded.manuscript.id,
    journalTemplateId: journalTemplate.id,
    journalName,
  };
}

async function loginAsDemoUser(
  request: APIRequestContext,
  username: string,
) {
  const response = await request.post(`${apiBaseUrl}/api/v1/auth/local/login`, {
    data: {
      username,
      password: "demo-password",
    },
  });
  expect(response.ok()).toBeTruthy();
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
