import { expect, test } from "@playwright/test";

const templateGovernanceViews = [
  {
    hash: "/#template-governance?templateGovernanceView=overview",
    expected: "规则中心",
  },
  {
    hash: "/#template-governance?templateGovernanceView=rule-ledger",
    expected: "规则台账",
  },
  {
    hash: "/#template-governance?templateGovernanceView=rule-ledger&ruleCenterMode=learning",
    expected: "统一复核中心",
  },
  {
    hash: "/#template-governance?templateGovernanceView=authoring&ruleCenterMode=authoring",
    expected: "规则草稿向导",
  },
  {
    hash: "/#template-governance?templateGovernanceView=classic",
    expected: "高级规则编辑器",
  },
  {
    hash: "/#template-governance?templateGovernanceView=large-template-ledger",
    expected: "大模板台账",
  },
  {
    hash: "/#template-governance?templateGovernanceView=journal-template-ledger",
    expected: "期刊模板台账",
  },
  {
    hash: "/#template-governance?templateGovernanceView=general-package-ledger",
    expected: "通用包台账",
  },
  {
    hash: "/#template-governance?templateGovernanceView=medical-package-ledger",
    expected: "医学专用包台账",
  },
  {
    hash: "/#template-governance?templateGovernanceView=extraction-ledger",
    expected: "原稿/编辑稿提取",
  },
] as const;

test.describe("rule center unified workbench", () => {
  for (const view of templateGovernanceViews) {
    test(`keeps route reachable: ${view.hash}`, async ({ page }) => {
      await page.goto(view.hash, { waitUntil: "domcontentloaded" });
      await expect(page.locator("body")).toContainText(view.expected);
    });
  }
});

test("rule ledger removes explanatory instruction copy", async ({ page }) => {
  await page.goto("/#template-governance?templateGovernanceView=rule-ledger", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("button", { name: "新建规则" })).toBeVisible();
  await expect(page.getByRole("button", { name: "新建 AI 规则草稿" })).toBeVisible();
  await expect(page.locator(".template-governance-ledger-section-header > p")).toHaveCount(0);

  const removedCopy = [
    "保持左侧导航、当前工作台焦点",
    "规则台账、回流候选与规则包协作入口",
    "集中管理模板、规则与提示词",
    "规则中心操作说明",
    "先分清规则本体",
    "三者配合完成治理",
  ];

  for (const text of removedCopy) {
    await expect(page.locator("body")).not.toContainText(text);
  }

  await page.getByRole("button", { name: "新建 AI 规则草稿" }).click();
  const aiPanel = page.locator(".template-governance-ledger-section", {
    hasText: "规则 AI 草稿生成",
  });
  await expect(aiPanel).toBeVisible();
  await expect(aiPanel).not.toContainText(
    "输入自然语言规则描述，AI 只生成待审核草稿",
  );
});

test("rule wizard keeps actions but removes teaching copy", async ({ page }) => {
  await page.goto(
    "/#template-governance?templateGovernanceView=authoring&ruleCenterMode=authoring",
    { waitUntil: "domcontentloaded" },
  );

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

  const removedCopy = [
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

  for (const text of removedCopy) {
    await expect(page.locator("body")).not.toContainText(text);
  }
});

test("template and package ledgers keep controls without page teaching copy", async ({
  page,
}) => {
  const routes = [
    "/#template-governance?templateGovernanceView=large-template-ledger",
    "/#template-governance?templateGovernanceView=journal-template-ledger",
    "/#template-governance?templateGovernanceView=general-package-ledger",
    "/#template-governance?templateGovernanceView=medical-package-ledger",
    "/#template-governance?templateGovernanceView=extraction-ledger",
  ];

  for (const route of routes) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".template-governance-ledger-toolbar")).toBeVisible();
    await expect(
      page.locator(
        ".template-governance-ledger-toolbar-copy > p:not(.template-governance-eyebrow)",
      ),
    ).toHaveCount(0);
    await expect(page.locator(".template-governance-ledger-section-header > p")).toHaveCount(0);
    await expect(page.locator(".template-governance-rule-hint-list")).toHaveCount(0);
  }
});
