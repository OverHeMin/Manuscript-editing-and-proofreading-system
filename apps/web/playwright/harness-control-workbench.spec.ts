import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const apiBaseUrl =
  process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:3001";

test("admin can run the compact harness control workbench across all task modes", async ({
  page,
  request,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });

  const cookie = await loginAsDemoUser(request, "dev.admin");
  await seedHarnessAcceptanceSampleSet(request, cookie);
  await seedHarnessDatasetVersion(request, cookie);

  await page.goto("/#evaluation-workbench?harnessMode=release_gate", {
    waitUntil: "domcontentloaded",
  });
  await waitForHarnessWorkbench(page, "release_gate");
  await expect(page.getByRole("heading", { name: "Harness 控制" })).toBeVisible();
  await expect(page.locator(".harness-control-mode-tabs")).toContainText("A/B 验收");
  await expect(page.locator(".harness-control-mode-tabs")).toContainText("回归巡检");
  await expect(page.locator(".harness-control-mode-tabs")).toContainText("发布门");
  await expect(page.locator(".harness-control-mode-tabs")).toContainText("单稿诊断");
  await expect(page.locator(".harness-control-mode-tabs")).toContainText("验证样本集");
  await expect(page.locator(".harness-control-workbench")).toContainText(
    "发布门将基于所选发布配置生成证据包",
  );

  await page.locator('[data-harness-primary-action="release_gate"]').click();
  await expect(page.locator(".harness-control-operator-panel")).toContainText(
    "候选预览、运行发起、激活与回滚",
  );
  await expect(page.locator(".harness-control-workbench")).toContainText(
    "请先在真实执行面板生成候选预览",
  );
  await page.getByLabel("检索预设").selectOption("retrieval-editing-preview-2");
  await page.getByRole("button", { name: "预览候选环境" }).click();
  await expect(page.locator(".harness-control-active-strip")).toContainText("候选主差异");
  await page.locator('[data-harness-primary-action="release_gate"]').click();
  await expect(page.locator(".harness-control-workbench")).toContainText(
    /发布门已创建运行/,
  );
  await expect(page.locator(".harness-control-workbench")).toContainText("待复核");

  await page.getByRole("button", { name: "回归巡检" }).click();
  await waitForHarnessWorkbench(page, "regression_inspection");
  await expect(page.locator(".harness-control-workbench")).toContainText(
    "将使用当前 Active 作为单路候选绑定",
  );
  await expect(page.locator('[data-harness-primary-action="regression_inspection"]')).toBeEnabled();
  await page.locator('[data-harness-primary-action="regression_inspection"]').click();
  await expect(page.locator(".harness-control-workbench")).toContainText(
    /回归巡检已创建运行/,
  );
  await expect(page.locator(".harness-control-workbench")).toContainText("待复核");

  await page.getByRole("button", { name: "A/B 验收" }).click();
  await waitForHarnessWorkbench(page, "ab_acceptance");
  await page.locator('[data-harness-primary-action="ab_acceptance"]').click();
  await expect(page.locator(".harness-control-workbench")).toContainText(
    /A\/B 验收已创建运行|请先在真实执行面板生成候选预览/,
  );

  await page.getByRole("button", { name: "单稿诊断" }).click();
  await waitForHarnessWorkbench(page, "single_manuscript_diagnosis");
  await page.getByPlaceholder("输入 manuscript ID").fill("manuscript-demo-1");
  await page.locator('[data-harness-primary-action="single_manuscript_diagnosis"]').click();
  await expect(page.locator(".harness-control-workbench")).toContainText(
    /单稿诊断命中|当前诊断稿件：manuscript-demo-1/,
  );

  await page.getByRole("button", { name: "验证样本集" }).click();
  await waitForHarnessWorkbench(page, "validation_sample_sets");
  await expect(page.locator(".harness-control-workbench")).toContainText("验证样本集草稿");
  await expect(page.getByRole("button", { name: "复制为草稿" }).first()).toBeVisible();
  await page.locator('[data-harness-primary-action="validation_sample_sets"]').click();
  await expect(page.locator(".harness-control-workbench")).toContainText(
    "验证样本集已在右侧显示",
  );

  await expectNoOverlaps(page.locator(".harness-control-mode-tabs button"));
  await expectNoOverlaps(page.locator(".harness-control-primary-action"));
  expect(consoleErrors).toEqual([]);
});

async function waitForHarnessWorkbench(
  page: Page,
  mode:
    | "ab_acceptance"
    | "regression_inspection"
    | "release_gate"
    | "single_manuscript_diagnosis"
    | "validation_sample_sets",
) {
  await expect(page.locator(".workbench-placeholder")).toHaveCount(0);
  await expect(page.locator(".harness-control-workbench")).toHaveAttribute(
    "data-harness-mode",
    mode,
  );
}

async function loginAsDemoUser(
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

  const setCookie = response.headers()["set-cookie"];
  expect(setCookie).toBeTruthy();
  return setCookie.split(";")[0] ?? "";
}

async function seedHarnessAcceptanceSampleSet(
  request: APIRequestContext,
  cookie: string,
) {
  const createResponse = await request.post(
    `${apiBaseUrl}/api/v1/verification-ops/evaluation-sample-sets`,
    {
      headers: { Cookie: cookie },
      data: {
        actorRole: "admin",
        input: {
          name: `Harness Browser Samples ${Date.now()}`,
          module: "editing",
          sampleItemInputs: [
            {
              reviewedCaseSnapshotId: "reviewed-case-snapshot-demo-1",
              riskTags: ["browser-harness"],
            },
          ],
        },
      },
    },
  );
  expect(createResponse.ok()).toBeTruthy();
  const sampleSet = (await createResponse.json()) as { id: string };

  const publishResponse = await request.post(
    `${apiBaseUrl}/api/v1/verification-ops/evaluation-sample-sets/${sampleSet.id}/publish`,
    {
      headers: { Cookie: cookie },
      data: { actorRole: "admin" },
    },
  );
  expect(publishResponse.ok()).toBeTruthy();
}

async function seedHarnessDatasetVersion(
  request: APIRequestContext,
  cookie: string,
) {
  const headers = { Cookie: cookie };
  const familyResponse = await request.post(
    `${apiBaseUrl}/api/v1/harness-datasets/gold-set-families`,
    {
      headers,
      data: {
        input: {
          name: `Browser gold set ${Date.now()}`,
          scope: {
            module: "editing",
            manuscriptTypes: ["clinical_study"],
            measureFocus: "conformance",
            templateFamilyId: "family-seeded-1",
          },
        },
      },
    },
  );
  expect(familyResponse.ok()).toBeTruthy();
  const family = (await familyResponse.json()) as { id: string };

  const rubricResponse = await request.post(`${apiBaseUrl}/api/v1/harness-datasets/rubrics`, {
    headers,
    data: {
      input: {
        name: `Browser rubric ${Date.now()}`,
        scope: {
          module: "editing",
          manuscriptTypes: ["clinical_study"],
        },
        scoringDimensions: [
          {
            key: "conformance",
            label: "Conformance",
            weight: 1,
          },
        ],
      },
    },
  });
  expect(rubricResponse.ok()).toBeTruthy();
  const rubric = (await rubricResponse.json()) as { id: string };

  const publishRubricResponse = await request.post(
    `${apiBaseUrl}/api/v1/harness-datasets/rubrics/${rubric.id}/publish`,
    {
      headers,
      data: {},
    },
  );
  expect(publishRubricResponse.ok()).toBeTruthy();

  const versionResponse = await request.post(
    `${apiBaseUrl}/api/v1/harness-datasets/gold-set-versions`,
    {
      headers,
      data: {
        input: {
          familyId: family.id,
          rubricDefinitionId: rubric.id,
          items: [
            {
              sourceKind: "reviewed_case_snapshot",
              sourceId: "reviewed-case-snapshot-demo-1",
              manuscriptId: "manuscript-demo-1",
              manuscriptType: "clinical_study",
              deidentificationPassed: true,
              humanReviewed: true,
              riskTags: ["browser-harness"],
            },
          ],
        },
      },
    },
  );
  expect(versionResponse.ok()).toBeTruthy();
  const version = (await versionResponse.json()) as { id: string };

  const publishVersionResponse = await request.post(
    `${apiBaseUrl}/api/v1/harness-datasets/gold-set-versions/${version.id}/publish`,
    {
      headers,
      data: {},
    },
  );
  expect(publishVersionResponse.ok()).toBeTruthy();
}

async function expectNoOverlaps(locator: ReturnType<Page["locator"]>) {
  const boxes = (await locator.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        text: element.textContent?.trim() ?? "",
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    }),
  )) as Array<{
    text: string;
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  }>;

  for (let index = 0; index < boxes.length; index += 1) {
    const box = boxes[index];
    expect(box.width, `${box.text} should have a usable width`).toBeGreaterThan(24);
    expect(box.height, `${box.text} should have a usable height`).toBeGreaterThan(24);

    for (let nextIndex = index + 1; nextIndex < boxes.length; nextIndex += 1) {
      const other = boxes[nextIndex];
      const overlaps =
        Math.max(0, Math.min(box.right, other.right) - Math.max(box.left, other.left)) *
          Math.max(0, Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top)) >
        1;
      expect(
        overlaps,
        `${box.text} should not overlap ${other.text}`,
      ).toBeFalsy();
    }
  }
}
