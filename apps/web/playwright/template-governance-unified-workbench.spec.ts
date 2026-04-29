import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const apiBaseUrl =
  process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:3001";

const ruleCenterRoutes = [
  {
    hash: "/#template-governance?templateGovernanceView=overview",
    section: "dashboard",
    queue: "dashboard",
  },
  {
    hash: "/#template-governance?templateGovernanceView=rule-ledger",
    section: "rules",
    queue: "rules",
  },
  {
    hash: "/#template-governance?templateGovernanceView=rule-ledger&ruleCenterMode=learning",
    section: "recovery",
    queue: "recovery",
  },
  {
    hash: "/#template-governance?templateGovernanceView=rule-ledger&ruleCenterMode=ai-intake",
    section: "ai-intake",
    queue: "ai-intake",
    panel: "ai-intake",
  },
  {
    hash: "/#template-governance?templateGovernanceView=authoring&ruleCenterMode=authoring",
    section: "rules",
    queue: "rules",
    panel: "rule-wizard",
  },
  {
    hash: "/#template-governance?templateGovernanceView=classic",
    section: "advanced",
    queue: "advanced",
    panel: "advanced-compatibility",
  },
  {
    hash: "/#template-governance?templateGovernanceView=large-template-ledger",
    section: "templates",
    queue: "templates",
    subtype: "large",
  },
  {
    hash: "/#template-governance?templateGovernanceView=journal-template-ledger",
    section: "templates",
    queue: "templates",
    subtype: "journal",
  },
  {
    hash: "/#template-governance?templateGovernanceView=general-package-ledger",
    section: "packages",
    queue: "packages",
    subtype: "general",
  },
  {
    hash: "/#template-governance?templateGovernanceView=medical-package-ledger",
    section: "packages",
    queue: "packages",
    subtype: "medical",
  },
  {
    hash: "/#template-governance?templateGovernanceView=extraction-ledger",
    section: "extraction",
    queue: "extraction",
  },
  {
    hash: "/#template-governance?templateGovernanceView=template-ledger",
    section: "templates",
    queue: "templates",
    subtype: "large",
  },
  {
    hash: "/#template-governance?templateGovernanceView=general-module-ledger",
    section: "packages",
    queue: "packages",
    subtype: "general",
  },
  {
    hash: "/#template-governance?templateGovernanceView=medical-module-ledger",
    section: "packages",
    queue: "packages",
    subtype: "medical",
  },
] as const;

const removedInstructionCopy = [
  "保持左侧导航、当前工作台焦点",
  "规则台账、回流候选与规则包协作入口",
  "集中管理模板、规则与提示词",
  "规则中心操作说明",
  "先分清规则本体",
  "三者配合完成治理",
  "输入自然语言规则描述，AI 只生成待审核草稿",
  "先带入候选并整理规则草稿",
  "当前步骤聚焦一个治理决定",
  "至少补充正文、一个示例和来源依据",
  "规则包决定这条规则先落到哪个复用容器",
  "直接发布只适合已经确认无误的场景",
  "按块组织正文、表格与图片",
  "表格支持直接粘贴 Excel / WPS",
  "如果只想补充图注、表注或规则备注",
  "还没有证据材料，可以先添加",
];

test.describe("rule center unified V2 workbench", () => {
  for (const route of ruleCenterRoutes) {
    test(`routes ${route.hash} into the V2 ${route.section} section`, async ({
      page,
      request,
    }) => {
      await openRuleCenter(page, request, route.hash);

      const shell = page.locator(".rule-center-v2");
      await expect(shell).toHaveAttribute("data-active-section", route.section);
      await expect(page.getByRole("heading", { name: "规则工作台" })).toBeVisible();
      await expect(
        page.locator(`.rule-center-v2__rail button.is-active[data-section="${route.section}"]`),
      ).toBeVisible();
      await expect(
        page.locator(`[data-v2-queue-section="${route.queue}"]`),
      ).toHaveCount(1);

      if ("subtype" in route) {
        await expect(
          page.locator(`[data-v2-queue-section="${route.queue}"]`),
        ).toHaveAttribute("data-v2-subtype", route.subtype);
      }

      if ("panel" in route) {
        await expect(
          page.locator(`[data-v2-detail-panel="${route.panel}"]`),
        ).toBeVisible();
      }

      await expect(
        page.locator(".workbench-content--template-governance > .rule-center-v2"),
      ).toBeVisible();
      await expect(
        page.locator(".workbench-content--template-governance > .template-governance-workbench"),
      ).toHaveCount(0);
      await expect(
        page.locator(".workbench-content--template-governance > .template-governance-overview-page"),
      ).toHaveCount(0);
      await expect(
        page.locator(
          ".workbench-content--template-governance > .template-governance-extraction-ledger-page",
        ),
      ).toHaveCount(0);
    });
  }
});

test("rule center V2 command bar keeps creation, AI intake, extraction, recovery, and release actions", async ({
  page,
  request,
}) => {
  await openRuleCenter(
    page,
    request,
    "/#template-governance?templateGovernanceView=rule-ledger",
  );

  const shell = page.locator(".rule-center-v2");
  await expect(page.getByRole("button", { name: "新建规则" })).toBeVisible();
  await expect(page.getByRole("button", { name: "新建 AI 规则草稿" })).toBeVisible();
  await expect(page.getByRole("button", { name: "导入提取任务" })).toBeVisible();
  await expect(page.getByRole("button", { name: "复核候选" })).toBeVisible();
  await expect(page.getByRole("button", { name: "发布检查" })).toBeVisible();

  await page.getByRole("button", { name: "新建 AI 规则草稿" }).click();
  await expect(shell).toHaveAttribute("data-active-section", "ai-intake");
  await expect(page.locator('[data-v2-detail-panel="ai-intake"]')).toContainText("解析规则");
  await expect(page.locator('[data-v2-detail-panel="ai-intake"]')).toContainText("应用到向导");

  await page.getByRole("button", { name: "导入提取任务" }).click();
  await expect(shell).toHaveAttribute("data-active-section", "extraction");
  await expect(page.locator('[data-v2-queue-section="extraction"]')).toBeVisible();

  await page.getByRole("button", { name: "复核候选" }).click();
  await expect(shell).toHaveAttribute("data-active-section", "recovery");
  await expect(page.locator('[data-v2-queue-section="recovery"]')).toBeVisible();

  await page.getByRole("button", { name: "新建规则" }).click();
  await expect(shell).toHaveAttribute("data-active-section", "rules");
  await expect(page.locator('[data-v2-detail-panel="rule-wizard"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "保存草稿" })).toBeVisible();
});

test("rule center V2 follows hash changes inside an already mounted workbench page", async ({
  page,
  request,
}) => {
  await openRuleCenter(
    page,
    request,
    "/#template-governance?templateGovernanceView=rule-ledger",
  );

  const shell = page.locator(".rule-center-v2");
  await expect(shell).toHaveAttribute("data-active-section", "rules");

  await page.goto(
    "/#template-governance?templateGovernanceView=rule-ledger&ruleCenterMode=ai-intake",
    { waitUntil: "domcontentloaded" },
  );

  await expect(shell).toHaveAttribute("data-active-section", "ai-intake");
  await expect(page.locator('[data-v2-detail-panel="ai-intake"]')).toContainText("解析规则");
});

test("rule center V2 surface removes page teaching copy", async ({
  page,
  request,
}) => {
  await openRuleCenter(
    page,
    request,
    "/#template-governance?templateGovernanceView=rule-ledger",
  );

  await expect(page.locator(".rule-center-v2")).toBeVisible();
  await expect(page.locator(".template-governance-ledger-section-header > p")).toHaveCount(0);
  await expect(
    page.locator(
      ".template-governance-ledger-toolbar-copy > p:not(.template-governance-eyebrow)",
    ),
  ).toHaveCount(0);
  await expect(page.locator(".template-governance-rule-hint-list")).toHaveCount(0);

  for (const text of removedInstructionCopy) {
    await expect(page.locator("body")).not.toContainText(text);
  }
});

test("rule wizard remains usable inside the V2 detail panel", async ({
  page,
  request,
}) => {
  await openRuleCenter(
    page,
    request,
    "/#template-governance?templateGovernanceView=authoring&ruleCenterMode=authoring",
  );

  await expect(page.locator('[data-v2-detail-panel="rule-wizard"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "规则草稿向导" })).toBeVisible();
  await expect(page.getByRole("button", { name: "保存草稿" })).toBeVisible();
  await expect(page.getByRole("button", { name: /下一步/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "完成并返回规则中心" })).toBeVisible();

  await page.getByLabel("规则名称").fill("无解释文案回归规则");
  await page
    .getByLabel("规则正文")
    .fill("摘要标题、正文字段和术语规范需要按规则中心治理结果保持一致。");
  await page.getByLabel("正例示例").fill("摘要 目的");
  await page.getByLabel("来源依据").fill("编辑部规则中心回归用例。");
  await page.getByRole("button", { name: "下一步：整理草稿" }).click();
  await expect(page.getByRole("heading", { name: "AI 语义层结果" })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "下一步：确认规则意图" }).click();
  await expect(page.getByRole("heading", { name: "人工确认 AI 结果" })).toBeVisible();
  await page.getByRole("button", { name: "下一步：绑定适用范围" }).click();
  await expect(page.getByRole("heading", { name: "放入模板 / 规则包" })).toBeVisible();
  await page.getByRole("button", { name: "下一步：提交发布" }).click();
  await expect(page.getByRole("heading", { name: "保存与发布" })).toBeVisible();

  for (const text of removedInstructionCopy) {
    await expect(page.locator("body")).not.toContainText(text);
  }
});

async function openRuleCenter(
  page: Page,
  request: APIRequestContext,
  hash: string,
): Promise<void> {
  await loginBrowserSession(page, request, "dev.admin");
  await page.goto(hash, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".rule-center-v2")).toBeVisible({ timeout: 15_000 });
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
