import { expect, test, type APIRequestContext } from "@playwright/test";

const apiBaseUrl =
  process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:3001";

const defaultBaselineBinding = {
  lane: "baseline",
  modelId: "demo-model-prod-1",
  runtimeId: "demo-runtime-prod-1",
  promptTemplateId: "demo-prompt-prod-1",
  skillPackageIds: ["demo-skill-prod-1"],
  moduleTemplateId: "demo-template-prod-1",
} as const;

interface PrepareEvaluationOperationsInput {
  label: string;
}

interface PreparedEvaluationOperationsScenario {
  cookie: string;
  suiteId: string;
  suiteName: string;
  sampleSetId: string;
  latestRunId: string;
  needsReviewRunId: string;
  rejectedRunId: string;
}

test("admin can inspect the delta-first evaluation operations surface with harness-owned controls", async ({
  page,
  request,
}) => {
  const prepared = await prepareSuiteWithFinalizedHistory(request, {
    label: `Phase 10C ${Date.now()}`,
  });

  await page.goto("/#evaluation-workbench", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Harness 控制概览" })).toBeVisible();
  await expect(page.locator(".evaluation-workbench")).toContainText(prepared.suiteName);
  await page.getByRole("button", { name: prepared.suiteName }).click();

  const workbench = page.locator(".evaluation-workbench");
  const historyPanel = page
    .locator(".evaluation-workbench-panel")
    .filter({ has: page.getByRole("heading", { name: "历史结果" }) });
  const comparisonPanel = page
    .locator(".evaluation-workbench-panel")
    .filter({ has: page.getByRole("heading", { name: "结果对照" }) });
  const signalPanel = page
    .locator(".evaluation-workbench-panel")
    .filter({ has: page.getByRole("heading", { name: "套件信号摘要" }) });
  const historyButtons = historyPanel.locator(".evaluation-workbench-history-list button");

  await expect(workbench).toContainText("运行总览");
  await expect(workbench).toContainText("变化分类：改善");
  await expect(workbench).toContainText("本次变化判定为改善");
  await expect(workbench).toContainText(
    `默认对照：${prepared.latestRunId} 对 ${prepared.needsReviewRunId}`,
  );
  await expect(workbench).toContainText("当前时间窗口展示 3 / 3 条已定稿运行");

  await expect(comparisonPanel).toContainText(`对照基线：${prepared.needsReviewRunId}`);
  await expect(comparisonPanel).toContainText("平均加权得分 97.0（共 1 条）");
  await expect(comparisonPanel).toContainText("当前证据：Latest browser QA");
  await expect(comparisonPanel).toContainText("基线证据：Needs review browser QA");

  const historyWindow = page.getByLabel("时间窗口");
  await expect(historyWindow.locator("option")).toContainText([
    "最近 10 次",
    "最近 7 天",
    "最近 30 天",
    "全部套件历史",
  ]);
  await expect(historyWindow).toHaveValue("latest_10");
  await expect(historyWindow.locator("option:checked")).toHaveText("最近 10 次");
  await historyWindow.selectOption("last_7_days");
  await expect(historyWindow).toHaveValue("last_7_days");
  await expect(historyWindow.locator("option:checked")).toHaveText("最近 7 天");
  await historyWindow.selectOption("last_30_days");
  await expect(historyWindow).toHaveValue("last_30_days");
  await expect(historyWindow.locator("option:checked")).toHaveText("最近 30 天");
  await historyWindow.selectOption("all_suite");
  await expect(historyWindow).toHaveValue("all_suite");
  await expect(historyWindow.locator("option:checked")).toHaveText("全部套件历史");
  await historyWindow.selectOption("latest_10");
  await expect(historyWindow).toHaveValue("latest_10");
  await expect(historyWindow.locator("option:checked")).toHaveText("最近 10 次");

  await expect(historyPanel).toContainText("默认最新运行");
  await expect(historyPanel).toContainText("默认基线");

  const recommendationFilter = page.getByLabel("建议筛选");
  await expect(recommendationFilter.locator("option")).toContainText([
    "全部",
    "可推荐",
    "待复核",
    "已拒绝",
  ]);
  await expect(recommendationFilter.locator("option:checked")).toHaveText("全部");
  await recommendationFilter.selectOption("recommended");
  await expect(recommendationFilter.locator("option:checked")).toHaveText("可推荐");
  await expect(historyPanel).toContainText(prepared.latestRunId);
  await expect(historyPanel).not.toContainText(prepared.needsReviewRunId);
  await expect(historyPanel).not.toContainText(prepared.rejectedRunId);

  await recommendationFilter.selectOption("needs_review");
  await expect(recommendationFilter.locator("option:checked")).toHaveText("待复核");
  await expect(historyPanel).toContainText(prepared.needsReviewRunId);
  await expect(historyPanel).not.toContainText(prepared.latestRunId);
  await expect(historyPanel).not.toContainText(prepared.rejectedRunId);

  await recommendationFilter.selectOption("rejected");
  await expect(recommendationFilter.locator("option:checked")).toHaveText("已拒绝");
  await expect(historyPanel).toContainText(prepared.rejectedRunId);
  await expect(historyPanel).not.toContainText(prepared.latestRunId);
  await expect(historyPanel).not.toContainText(prepared.needsReviewRunId);

  await recommendationFilter.selectOption("all");
  await expect(recommendationFilter.locator("option:checked")).toHaveText("全部");
  await expect(historyPanel).toContainText(prepared.latestRunId);
  await expect(historyPanel).toContainText(prepared.needsReviewRunId);
  await expect(historyPanel).toContainText(prepared.rejectedRunId);

  const sortMode = page.getByLabel("排序方式");
  await expect(sortMode.locator("option")).toContainText([
    "最新优先",
    "失败优先",
  ]);
  await sortMode.selectOption("failures_first");
  await expect(sortMode).toHaveValue("failures_first");
  await expect(sortMode.locator("option:checked")).toHaveText("失败优先");
  await expect(historyButtons.first()).toContainText(prepared.rejectedRunId);

  await sortMode.selectOption("newest");
  await expect(sortMode).toHaveValue("newest");
  await expect(sortMode.locator("option:checked")).toHaveText("最新优先");
  await expect(historyButtons.first()).toContainText(prepared.latestRunId);

  await expect(signalPanel).toContainText("建议分布");
  await expect(signalPanel).toContainText("1 可推荐 / 1 待复核 / 1 已拒绝");
  await expect(signalPanel).toContainText("证据包结果");
  await expect(signalPanel).toContainText("复发信号");
  await expect(signalPanel).toContainText("1 次回归提及 / 1 次失败提及 / 1 次运行被标记");

  await expect(page.getByRole("heading", { name: "Environment Editor" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Quality Lab" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Activation Gate" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Launch Candidate Run" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Activate Candidate Environment" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Complete And Finalize Run" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Finalize Recommendation" })).toHaveCount(0);
});

async function prepareSuiteWithFinalizedHistory(
  request: APIRequestContext,
  input: PrepareEvaluationOperationsInput,
): Promise<PreparedEvaluationOperationsScenario> {
  const prepared = await prepareActiveEvaluationScenario(request, input);

  const rejectedRunId = await createFinalizedEvaluationRun(request, {
    cookie: prepared.cookie,
    suiteId: prepared.suiteId,
    sampleSetId: prepared.sampleSetId,
    evidenceLabel: "Rejected browser QA",
    evidenceUrl: "https://example.test/evidence/rejected-browser-qa",
    candidateModelId: "candidate-model-rejected",
    weightedScore: 58,
    hardGatePassed: false,
    failureKind: "regression_failed",
    failureReason: "Structure regression triggered the hard gate.",
    diffSummary: "Rejected run regressed on approved structure.",
    completeStatus: "failed",
    expectedRecommendationStatus: "rejected",
  });

  const needsReviewRunId = await createFinalizedEvaluationRun(request, {
    cookie: prepared.cookie,
    suiteId: prepared.suiteId,
    sampleSetId: prepared.sampleSetId,
    evidenceLabel: "Needs review browser QA",
    evidenceUrl: "https://example.test/evidence/needs-review-browser-qa",
    candidateModelId: "candidate-model-needs-review",
    diffSummary: "Scoring intentionally left incomplete for manual review.",
    expectedRecommendationStatus: "needs_review",
  });

  const latestRunId = await createFinalizedEvaluationRun(request, {
    cookie: prepared.cookie,
    suiteId: prepared.suiteId,
    sampleSetId: prepared.sampleSetId,
    evidenceLabel: "Latest browser QA",
    evidenceUrl: "https://example.test/evidence/latest-browser-qa",
    candidateModelId: "candidate-model-latest",
    weightedScore: 97,
    diffSummary: "Latest run improved structure stability.",
    expectedRecommendationStatus: "recommended",
  });

  return {
    cookie: prepared.cookie,
    suiteId: prepared.suiteId,
    suiteName: prepared.suiteName,
    sampleSetId: prepared.sampleSetId,
    latestRunId,
    needsReviewRunId,
    rejectedRunId,
  };
}

async function prepareActiveEvaluationScenario(
  request: APIRequestContext,
  input: PrepareEvaluationOperationsInput,
): Promise<{
  cookie: string;
  suiteId: string;
  suiteName: string;
  sampleSetId: string;
}> {
  const cookie = await loginAsDemoUser(request, "dev.admin");
  const storagePrefix = input.label.toLowerCase().replace(/\s+/g, "-");

  const snapshotResponse = await request.post(
    `${apiBaseUrl}/api/v1/learning/reviewed-case-snapshots`,
    {
      headers: {
        Cookie: cookie,
      },
      data: {
        manuscriptId: "manuscript-demo-1",
        module: "editing",
        manuscriptType: "clinical_study",
        humanFinalAssetId: "human-final-demo-1",
        deidentificationPassed: true,
        requestedBy: "ignored-by-server",
        storageKey: `learning/${storagePrefix}/snapshot-1.bin`,
      },
    },
  );
  if (!snapshotResponse.ok()) {
    throw new Error(
      `create reviewed snapshot failed (${snapshotResponse.status()}): ${await snapshotResponse.text()}`,
    );
  }
  const snapshot = (await snapshotResponse.json()) as { id: string };

  const sampleSetResponse = await request.post(
    `${apiBaseUrl}/api/v1/verification-ops/evaluation-sample-sets`,
    {
      headers: {
        Cookie: cookie,
      },
      data: {
        actorRole: "admin",
        input: {
          name: `${input.label} Editing Samples`,
          module: "editing",
          sampleItemInputs: [
            {
              reviewedCaseSnapshotId: snapshot.id,
              riskTags: ["structure"],
            },
          ],
        },
      },
    },
  );
  if (!sampleSetResponse.ok()) {
    throw new Error(
      `create sample set failed (${sampleSetResponse.status()}): ${await sampleSetResponse.text()}`,
    );
  }
  const sampleSet = (await sampleSetResponse.json()) as { id: string };

  const publishSampleSetResponse = await request.post(
    `${apiBaseUrl}/api/v1/verification-ops/evaluation-sample-sets/${sampleSet.id}/publish`,
    {
      headers: {
        Cookie: cookie,
      },
      data: {
        actorRole: "admin",
      },
    },
  );
  if (!publishSampleSetResponse.ok()) {
    throw new Error(
      `publish sample set failed (${publishSampleSetResponse.status()}): ${await publishSampleSetResponse.text()}`,
    );
  }

  const checkProfileResponse = await request.post(
    `${apiBaseUrl}/api/v1/verification-ops/check-profiles`,
    {
      headers: {
        Cookie: cookie,
      },
      data: {
        actorRole: "admin",
        input: {
          name: `${input.label} Browser QA Check`,
          checkType: "browser_qa",
        },
      },
    },
  );
  if (!checkProfileResponse.ok()) {
    throw new Error(
      `create check profile failed (${checkProfileResponse.status()}): ${await checkProfileResponse.text()}`,
    );
  }
  const checkProfile = (await checkProfileResponse.json()) as { id: string };

  const publishCheckProfileResponse = await request.post(
    `${apiBaseUrl}/api/v1/verification-ops/check-profiles/${checkProfile.id}/publish`,
    {
      headers: {
        Cookie: cookie,
      },
      data: {
        actorRole: "admin",
      },
    },
  );
  if (!publishCheckProfileResponse.ok()) {
    throw new Error(
      `publish check profile failed (${publishCheckProfileResponse.status()}): ${await publishCheckProfileResponse.text()}`,
    );
  }

  const suiteName = `${input.label} Active Evaluation Suite`;
  const suiteResponse = await request.post(
    `${apiBaseUrl}/api/v1/verification-ops/evaluation-suites`,
    {
      headers: {
        Cookie: cookie,
      },
      data: {
        actorRole: "admin",
        input: {
          name: suiteName,
          suiteType: "regression",
          verificationCheckProfileIds: [checkProfile.id],
          moduleScope: ["editing"],
          requiresProductionBaseline: true,
          supportsAbComparison: true,
        },
      },
    },
  );
  if (!suiteResponse.ok()) {
    throw new Error(
      `create suite failed (${suiteResponse.status()}): ${await suiteResponse.text()}`,
    );
  }
  const suite = (await suiteResponse.json()) as { id: string; name: string };

  const activateSuiteResponse = await request.post(
    `${apiBaseUrl}/api/v1/verification-ops/evaluation-suites/${suite.id}/activate`,
    {
      headers: {
        Cookie: cookie,
      },
      data: {
        actorRole: "admin",
      },
    },
  );
  if (!activateSuiteResponse.ok()) {
    throw new Error(
      `activate suite failed (${activateSuiteResponse.status()}): ${await activateSuiteResponse.text()}`,
    );
  }

  return {
    cookie,
    suiteId: suite.id,
    suiteName: suite.name,
    sampleSetId: sampleSet.id,
  };
}

async function createFinalizedEvaluationRun(
  request: APIRequestContext,
  input: {
    cookie: string;
    suiteId: string;
    sampleSetId: string;
    evidenceLabel: string;
    evidenceUrl: string;
    candidateModelId: string;
    weightedScore?: number;
    hardGatePassed?: boolean;
    failureKind?: string;
    failureReason?: string;
    diffSummary: string;
    completeStatus?: "passed" | "failed";
    expectedRecommendationStatus: "recommended" | "needs_review" | "rejected";
  },
): Promise<string> {
  const createRunResponse = await request.post(`${apiBaseUrl}/api/v1/verification-ops/evaluation-runs`, {
    headers: {
      Cookie: input.cookie,
    },
    data: {
      actorRole: "admin",
      input: {
        suiteId: input.suiteId,
        sampleSetId: input.sampleSetId,
        baselineBinding: defaultBaselineBinding,
        candidateBinding: {
          lane: "candidate",
          modelId: input.candidateModelId,
          runtimeId: defaultBaselineBinding.runtimeId,
          promptTemplateId: defaultBaselineBinding.promptTemplateId,
          skillPackageIds: [...defaultBaselineBinding.skillPackageIds],
          moduleTemplateId: defaultBaselineBinding.moduleTemplateId,
        },
      },
    },
  });
  if (!createRunResponse.ok()) {
    throw new Error(
      `create evaluation run failed (${createRunResponse.status()}): ${await createRunResponse.text()}`,
    );
  }
  const run = (await createRunResponse.json()) as { id: string };

  const runItemsResponse = await request.get(
    `${apiBaseUrl}/api/v1/verification-ops/evaluation-runs/${run.id}/items`,
    {
      headers: {
        Cookie: input.cookie,
      },
    },
  );
  if (!runItemsResponse.ok()) {
    throw new Error(
      `list run items failed (${runItemsResponse.status()}): ${await runItemsResponse.text()}`,
    );
  }
  const runItems = (await runItemsResponse.json()) as Array<{ id: string }>;
  const runItem = runItems[0];
  if (!runItem) {
    throw new Error(`createFinalizedEvaluationRun expected run items for ${run.id}.`);
  }

  const recordRunItemResponse = await request.post(
    `${apiBaseUrl}/api/v1/verification-ops/evaluation-run-items/${runItem.id}/result`,
    {
      headers: {
        Cookie: input.cookie,
      },
      data: {
        actorRole: "admin",
        input: {
          runItemId: runItem.id,
          resultAssetId: "human-final-demo-1",
          hardGatePassed: input.hardGatePassed ?? true,
          weightedScore: input.weightedScore,
          failureKind: input.failureKind,
          failureReason: input.failureReason,
          diffSummary: input.diffSummary,
          requiresHumanReview: false,
        },
      },
    },
  );
  if (!recordRunItemResponse.ok()) {
    throw new Error(
      `record run item failed (${recordRunItemResponse.status()}): ${await recordRunItemResponse.text()}`,
    );
  }

  const recordEvidenceResponse = await request.post(`${apiBaseUrl}/api/v1/verification-ops/evidence`, {
    headers: {
      Cookie: input.cookie,
    },
    data: {
      actorRole: "admin",
      input: {
        kind: "url",
        label: input.evidenceLabel,
        uri: input.evidenceUrl,
      },
    },
  });
  if (!recordEvidenceResponse.ok()) {
    throw new Error(
      `record evidence failed (${recordEvidenceResponse.status()}): ${await recordEvidenceResponse.text()}`,
    );
  }
  const evidence = (await recordEvidenceResponse.json()) as { id: string };

  const completeRunResponse = await request.post(
    `${apiBaseUrl}/api/v1/verification-ops/evaluation-runs/${run.id}/complete`,
    {
      headers: {
        Cookie: input.cookie,
      },
      data: {
        actorRole: "admin",
        status: input.completeStatus ?? "passed",
        evidenceIds: [evidence.id],
      },
    },
  );
  if (!completeRunResponse.ok()) {
    throw new Error(
      `complete evaluation run failed (${completeRunResponse.status()}): ${await completeRunResponse.text()}`,
    );
  }

  const finalizeRunResponse = await request.post(
    `${apiBaseUrl}/api/v1/verification-ops/evaluation-runs/${run.id}/finalize`,
    {
      headers: {
        Cookie: input.cookie,
      },
      data: {
        actorRole: "admin",
      },
    },
  );
  if (!finalizeRunResponse.ok()) {
    throw new Error(
      `finalize evaluation run failed (${finalizeRunResponse.status()}): ${await finalizeRunResponse.text()}`,
    );
  }
  const finalized = (await finalizeRunResponse.json()) as {
    recommendation: { status: "recommended" | "needs_review" | "rejected" };
  };
  expect(finalized.recommendation.status).toBe(input.expectedRecommendationStatus);

  return run.id;
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
