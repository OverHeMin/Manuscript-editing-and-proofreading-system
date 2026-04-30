import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const apiBaseUrl =
  process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:3001";
const seededFamilyId = "family-seeded-1";
const seededFamilyName = "Seeded Clinical Study Family";
const abstractObjectiveSource = "\u6458\u8981 \u76ee\u7684";
const abstractObjectiveNormalized = "\uff08\u6458\u8981\u3000\u76ee\u7684\uff09";
const journalObjectiveNormalized = "\uff08\u6458\u8981\u3000\u76ee\u7684\uff09\uff1a";

test("management navigation exposes three direct entries and can hand off to harness", async ({
  page,
  request,
}) => {
  await loginAsDemoUser(request, "dev.admin");

  await page.goto("/#screening", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "管理区" })).toBeVisible();
  await expect(page.locator("body")).toContainText("3 项");
  await expect(page.getByRole("button", { name: "AI 接入" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Harness 控制" })).toBeVisible();
  await expect(page.getByRole("button", { name: "账号与权限" })).toBeVisible();
  await expect(page.getByRole("button", { name: "管理总览" })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("AI 接入快照");
  await expect(page.locator("body")).not.toContainText("管理总览");

  await page.getByRole("button", { name: "Harness 控制" }).click();
  await expect(page).toHaveURL(/#evaluation-workbench\?harnessMode=ab_acceptance/);
  await expect(page.getByRole("heading", { name: "Harness 控制" })).toBeVisible();
  await expect(page.locator(".harness-control-workbench")).toHaveAttribute(
    "data-harness-mode",
    "ab_acceptance",
  );
});

test("management navigation opens settings pages and keeps removed overview out of the shell", async ({
  page,
  request,
}) => {
  await loginAsDemoUser(request, "dev.admin");

  await page.goto("/#screening", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "管理区" })).toBeVisible();
  await expect(page.getByRole("button", { name: "管理总览" })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("AI 接入快照");
  await expect(page.locator("body")).not.toContainText("Harness 运行体征");
  await expect(page.locator("body")).not.toContainText("当前提醒");
  await expect(page.getByRole("heading", { name: "治理资产快照" })).toHaveCount(0);
  await expect(page.getByText("查看治理资产明细")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Harness Control Plane");
  await expect(page.locator("body")).not.toContainText("Environment Editor");
  await expect(page.locator("body")).not.toContainText("Quality Lab");
  await expect(page.locator("body")).not.toContainText("Activation Gate");

  await page.getByRole("button", { name: "AI 接入" }).click();
  await expect(page).toHaveURL(/#system-settings\?settingsSection=ai-access/);
  await expect(page.getByRole("heading", { name: "AI 接入" })).toBeVisible();

  await page.getByRole("button", { name: "账号与权限" }).click();
  await expect(page).toHaveURL(/#system-settings\?settingsSection=accounts/);
  await expect(page.getByRole("heading", { name: "账号与权限" })).toBeVisible();
});

test("template governance authoring route opens the five-step rule wizard", async ({
  page,
  request,
}) => {
  await loginAsDemoUser(request, "dev.admin");

  const ruleName = `Case Report Rule ${Date.now()}`;

  await page.goto("/#template-governance?templateGovernanceView=authoring&ruleCenterMode=authoring", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "规则草稿向导" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "五步流" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "基础录入与证据补充" })).toBeVisible();
  await expect(page.getByRole("button", { name: "返回规则台账" })).toBeVisible();

  const ruleNameField = page.getByRole("textbox", { name: "规则名称" });
  await expect(ruleNameField).toBeVisible();
  await ruleNameField.fill(ruleName);
  await page.getByRole("textbox", { name: "规则正文" }).fill("病例报告摘要标题需要统一。");
  await page.getByRole("textbox", { name: "正例示例" }).fill("摘要 目的");
  await page.getByRole("textbox", { name: "来源依据" }).fill("期刊格式规范第 2 节");

  await expect(ruleNameField).toHaveValue(ruleName);
  await expect(page.getByRole("combobox", { name: "适用模块" })).toBeVisible();
  await expect(page.getByRole("button", { name: "保存草稿" })).toBeVisible();
  await expect(page.getByRole("button", { name: "下一步：整理草稿" })).toBeVisible();
  await expect(page.getByRole("button", { name: "完成并返回规则中心" })).toBeVisible();
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

  await expect(page.getByRole("heading", { name: /编辑工作区/ })).toBeVisible();
  await expectLoadedManuscript(page, prepared.manuscriptTitle);
  await expect(page.locator("body")).toContainText("基础模板家族");
  await expect(page.locator("body")).toContainText(seededFamilyName);

  const journalSelect = page.getByLabel("期刊模板（小期刊/场景）");

  await expect(journalSelect).toBeVisible();
  await journalSelect.selectOption({ label: prepared.journalName });
  await page
    .getByRole("button", {
      name: /保存模板上下文|确认当前模板上下文|保存人工修正/,
    })
    .click();

  await expect(page.locator("body")).toContainText(
    `已保存 ${prepared.manuscriptId} 的人工模板修正`,
  );
  await expect(page.locator("body")).toContainText(prepared.journalName);
  await expect(page.locator("body")).toContainText("期刊覆写");
  const resultDetails = page.locator(".manuscript-workbench-result-details");
  await expect(resultDetails).toBeVisible();
  await resultDetails
    .locator("summary")
    .evaluate((element: HTMLElement) => element.click());
  const governanceTraceCard = page.locator(".manuscript-workbench-summary-card", {
    has: page.getByRole("heading", { name: "治理链路" }),
  });
  await expect(governanceTraceCard).toContainText("目标模型版本");
  await expect(governanceTraceCard).toContainText("质量包");
  await expect(governanceTraceCard).toContainText("规则层栈");
  await expect(governanceTraceCard).toContainText("知识激活");

  const inputAssetSelect = page.getByLabel(/输入稿件资产|父资产/);
  await expect(inputAssetSelect).toBeVisible();
  await expect(inputAssetSelect).not.toHaveValue("");

  const manuscriptResponse = await request.get(
    `${apiBaseUrl}/api/v1/manuscripts/${prepared.manuscriptId}`,
  );
  expect(manuscriptResponse.ok()).toBeTruthy();
  const manuscript = (await manuscriptResponse.json()) as {
    current_journal_template_id?: string;
  };
  expect(manuscript.current_journal_template_id).toBe(prepared.journalTemplateId);

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/modules/editing/run") && response.ok(),
    ),
    page.getByRole("button", { name: "执行编辑" }).click(),
  ]);

  await expect(page.locator("body")).toContainText("已生成编辑稿件", {
    timeout: 15_000,
  });
  await expect(page.locator("body")).toContainText(prepared.journalName);
});

async function expectLoadedManuscript(page: Page, title: string) {
  const workspaceStage = page.locator('[data-pane="workspace-stage"]').first();
  await expect(workspaceStage).toContainText("当前稿件");
  await expect(workspaceStage).toContainText(title);
}

async function prepareEditingWorkbenchJournalScenario(
  request: APIRequestContext,
  input: {
    label: string;
  },
): Promise<{
  manuscriptId: string;
  manuscriptTitle: string;
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
    manuscriptTitle: `${input.label} clinical manuscript`,
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
