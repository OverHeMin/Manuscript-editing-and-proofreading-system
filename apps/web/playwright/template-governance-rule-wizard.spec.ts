import { expect, test } from "@playwright/test";

test("template governance rule wizard persists the entry draft before advancing to confirm", async ({
  page,
}) => {
  await page.goto("/#template-governance?templateGovernanceView=authoring&ruleCenterMode=authoring", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByLabel("规则名称")).toBeVisible();

  await page.getByLabel("规则名称").fill("浏览器验收规则草稿");
  await page
    .getByLabel("规则正文")
    .fill("同一篇稿件中的核心术语、缩略语与中英文名称应保持统一，不得前后混用。");
  await page
    .getByLabel("正例示例")
    .fill("全文统一使用 acute myocardial infarction（AMI）。");
  await page.getByLabel("来源依据").fill("期刊术语统一规范与编辑部内部校对规则。");

  await page.getByRole("button", { name: "下一步：整理草稿" }).click();
  await expect(page.locator(".template-governance-rule-wizard")).toContainText(
    "语义状态待人工确认",
    { timeout: 15_000 },
  );

  await page.getByRole("button", { name: "下一步：确认规则意图" }).click();

  await expect(page.getByRole("heading", { name: "人工确认 AI 结果" })).toBeVisible();
  await expect(page.locator(".template-governance-rule-wizard")).not.toContainText(
    "请先保存基础录入草稿，再继续到人工确认。",
  );
});

test("template governance rule wizard exposes exact package versions and package-kind fallback bindings", async ({
  page,
}) => {
  await page.goto("/#template-governance?templateGovernanceView=authoring&ruleCenterMode=authoring", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByLabel("规则名称")).toBeVisible();

  await page.getByLabel("规则名称").fill("浏览器验收规则绑定范围");
  await page
    .getByLabel("规则正文")
    .fill("表格、符号与格式规范应按真实运行时质量包激活，不得只看模板名称猜测。");
  await page.getByLabel("正例示例").fill("三线表要求由运行时通用包激活。");
  await page.getByLabel("来源依据").fill("期刊格式说明与规则中心治理要求。");

  await page.getByRole("button", { name: "下一步：整理草稿" }).click();
  await expect(page.locator(".template-governance-rule-wizard")).toContainText(
    "语义状态待人工确认",
    { timeout: 15_000 },
  );

  await page.getByRole("button", { name: "下一步：确认规则意图" }).click();
  await expect(page.getByRole("heading", { name: "人工确认 AI 结果" })).toBeVisible();

  await page.getByRole("button", { name: "下一步：绑定适用范围" }).click();
  await expect(page.getByRole("heading", { name: "放入模板 / 规则包" })).toBeVisible();
  await expect(page.locator(".template-governance-rule-wizard")).toContainText(
    "按通用包类型激活（不锁版本）",
  );

  const packageOptions = page
    .getByLabel("规则包条目")
    .locator("option");
  await expect(packageOptions).toContainText([
    "按通用包类型激活（不锁版本）",
  ]);

  await expect(page.locator(".template-governance-rule-wizard")).toContainText(
    "直绑期刊模板",
  );
  await expect(
    page.locator('[data-searchable-multi-select-input="rule-wizard-journal-templates"]'),
  ).toBeVisible();
  await expect(page.locator(".template-governance-rule-wizard")).toContainText(
    "Seeded Clinical Journal Overlay",
  );
  await page
    .getByRole("button", { name: /Seeded Clinical Journal Overlay/i })
    .click();
  await expect(page.locator(".template-governance-rule-wizard")).toContainText(
    "期刊模板覆盖",
  );
  await expect(page.locator(".template-governance-rule-wizard")).toContainText(
    "Seeded Clinical Journal Overlay",
  );

  await page.getByRole("button", { name: "下一步：提交发布" }).click();
  await expect(page.getByRole("heading", { name: "保存与发布" })).toBeVisible();
  await expect(page.locator(".template-governance-rule-wizard")).toContainText(
    "直绑期刊模板",
  );
  await expect(page.locator(".template-governance-rule-wizard")).toContainText(
    "Seeded Clinical Journal Overlay",
  );
});
