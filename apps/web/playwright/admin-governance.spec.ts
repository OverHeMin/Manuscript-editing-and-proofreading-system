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

  await page.goto("/#admin-console", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "管理总览" })).toBeVisible();
  await expect(page.locator("body")).toContainText("AI 接入");
  await expect(page.locator("body")).toContainText("账号与权限");
  await expect(page.locator("body")).toContainText("Harness 控制");
  await expect(page.locator("body")).toContainText("规则中心");

  await expect(page.getByRole("link", { name: "进入 AI 接入" })).toHaveAttribute(
    "href",
    /#system-settings\?settingsSection=ai-access/,
  );
  await expect(page.getByRole("link", { name: "进入账号与权限" })).toHaveAttribute(
    "href",
    /#system-settings\?settingsSection=accounts/,
  );
  await expect(page.getByRole("link", { name: "进入 Harness 控制" })).toHaveAttribute(
    "href",
    /#evaluation-workbench\?harnessSection=overview/,
  );
  await expect(page.getByRole("link", { name: "打开规则中心" })).toHaveAttribute(
    "href",
    /#template-governance\?ruleCenterMode=authoring/,
  );

  await page.getByRole("link", { name: "进入 Harness 控制" }).click();
  await expect(page).toHaveURL(/#evaluation-workbench\?harnessSection=overview/);
});

test("admin can preview, verify, activate, and roll back the seeded harness environment from the control plane", async ({
  page,
  request,
}) => {
  await loginAsDemoUser(request, "dev.admin");

  await page.goto("/#admin-console", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "AI 接入快照" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Harness 运行体征" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "治理资产快照" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "当前提醒" })).toBeVisible();
  await expect(page.locator("body")).toContainText("查看治理资产明细");
  await expect(page.locator("body")).not.toContainText("Harness Control Plane");
  await expect(page.locator("body")).not.toContainText("Environment Editor");
  await expect(page.locator("body")).not.toContainText("Quality Lab");
  await expect(page.locator("body")).not.toContainText("Activation Gate");

  await page.getByText("查看治理资产明细").click();
  await expect(page.getByRole("heading", { name: "模板与执行明细" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "AI 路由摘要" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "最近运行摘要" })).toBeVisible();
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

  await expect(page.getByRole("heading", { name: "规则中心" })).toBeVisible();

  await page.getByRole("combobox", { name: "稿件类型", exact: true }).selectOption(
    "case_report",
  );
  await page.getByRole("textbox", { name: "族名称", exact: true }).fill(familyName);
  await page.getByRole("button", { name: "新建模板族草稿" }).click();

  await expect(page.locator(".template-governance-status")).toContainText(
    "模板族草稿已创建。",
  );
  const createdFamilyButton = page.getByRole("button", { name: new RegExp(familyName) });
  await expect(createdFamilyButton).toBeVisible();
  await createdFamilyButton.click();
  await page.getByRole("button", { name: "展开高级规则编辑器" }).click();
  await expect(page.getByRole("heading", { name: "规则导航" })).toBeVisible();

  await page.getByRole("textbox", { name: "期刊名称" }).fill(journalName);
  await page.getByRole("textbox", { name: "期刊标识" }).fill(journalKey);
  await page.getByRole("button", { name: "新建期刊模板" }).click();

  await expect(page.locator(".template-governance-status")).toContainText(
    "期刊模板画像已创建。",
  );

  const journalCard = page
    .getByRole("button", { name: "启用" })
    .locator("xpath=ancestor::article[contains(@class,'template-governance-card')]")
    .first();
  await expect(journalCard).toContainText(journalName);
  await expect(journalCard).toContainText("草稿");
  await journalCard.getByRole("button", { name: "启用" }).click();

  await expect(page.locator(".template-governance-status")).toContainText(
    "期刊模板画像已启用。",
  );
  await expect(page.getByText(`${journalKey} | 启用中`)).toBeVisible();
  await expect(page.getByRole("button", { name: "当前范围" })).toBeVisible();

  const navigatorCard = page
    .getByRole("heading", { name: "规则导航" })
    .locator("xpath=ancestor::article[contains(@class,'template-governance-card')]")
    .first();
  const previewPanel = page
    .getByRole("heading", { name: "规则预览" })
    .locator("xpath=ancestor::article[contains(@class,'template-governance-card')]")
    .first();

  await navigatorCard.getByRole("combobox", { name: "模块" }).selectOption("editing");
  await navigatorCard.getByRole("button", { name: "新建规则集草稿" }).click();

  await expect(page.locator(".template-governance-status")).toContainText(
    "规则集草稿已创建。",
  );
  await expect(previewPanel).toContainText("期刊加层：");
  await expect(previewPanel).toContainText(
    `${abstractObjectiveSource} -> ${abstractObjectiveNormalized}`,
  );

  await page.getByRole("button", { name: "新建规则草稿" }).click();

  await expect(page.locator(".template-governance-status")).toContainText("规则草稿已创建。");
  await expect(page.locator(".template-governance-rule-layout-main")).toContainText(
    `${abstractObjectiveSource} -> ${abstractObjectiveNormalized}`,
  );

  await page.getByRole("button", { name: "表格" }).click();
  await page.getByLabel("语义目标").selectOption("header_cell");
  await page.getByLabel("表头路径").fill("Treatment group > n (%)");
  await page.getByLabel("列标识").fill("Treatment group > n (%)");
  await expect(previewPanel).toContainText("仅检查");
  await expect(previewPanel).toContainText("semantic_target=header_cell");
  await expect(previewPanel).toContainText("header_path=Treatment group > n (%)");
  await expect(previewPanel).toContainText("table_id=runtime-resolved");
  await expect(previewPanel).toContainText("期刊加层");
  await page.getByRole("button", { name: "新建规则草稿" }).click();

  await expect(page.locator(".template-governance-status")).toContainText("规则草稿已创建。");
  await expect(page.locator(".template-governance-rule-layout-main")).toContainText(
    "header_cell",
  );
  await expect(page.locator(".template-governance-rule-layout-main")).toContainText(
    "Treatment group",
  );
  await expect(page.locator(".template-governance-rule-layout-main")).toContainText(
    "n (%)",
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
