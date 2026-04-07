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

test("admin can inspect the delta-first evaluation operations surface without legacy write controls", async ({
  page,
  request,
}) => {
  const prepared = await prepareSuiteWithFinalizedHistory(request, {
    label: `Phase 10C ${Date.now()}`,
  });

  await page.goto("/#evaluation-workbench", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Evaluation Workbench" })).toBeVisible();
  await expect(page.locator(".evaluation-workbench")).toContainText(prepared.suiteName);
  await page.getByRole("button", { name: prepared.suiteName }).click();

  const workbench = page.locator(".evaluation-workbench");
  const historyPanel = page
    .locator(".evaluation-workbench-panel")
    .filter({ has: page.getByRole("heading", { name: "Visible History" }) });
  const comparisonPanel = page
    .locator(".evaluation-workbench-panel")
    .filter({ has: page.getByRole("heading", { name: "Run Comparison" }) });
  const signalPanel = page
    .locator(".evaluation-workbench-panel")
    .filter({ has: page.getByRole("heading", { name: "Suite Signal Summary" }) });
  const historyButtons = historyPanel.locator(".evaluation-workbench-history-list button");

  await expect(workbench).toContainText("Delta Summary");
  await expect(workbench).toContainText("Classification: better");
  await expect(workbench).toContainText(
    "Chosen because the latest finalized recommendation improved from needs_review to recommended.",
  );
  await expect(workbench).toContainText(
    `Default comparison: ${prepared.latestRunId} vs ${prepared.needsReviewRunId}.`,
  );
  await expect(workbench).toContainText("Visible history window: 3 of 3 finalized runs are in scope.");

  await expect(comparisonPanel).toContainText("Latest-versus-previous finalized comparison");
  await expect(comparisonPanel).toContainText(`Comparing against ${prepared.needsReviewRunId}`);
  await expect(comparisonPanel).toContainText("Average weighted score 97.0 across 1 item(s).");
  await expect(comparisonPanel).toContainText("No weighted scores were recorded.");
  await expect(comparisonPanel).toContainText("Selected evidence: Latest browser QA");
  await expect(comparisonPanel).toContainText("Previous evidence: Needs review browser QA");

  const historyWindow = page.getByLabel("History Window");
  await expect(historyWindow.locator("option")).toContainText([
    "Latest 10",
    "Last 7 Days",
    "Last 30 Days",
    "All Suite History",
  ]);
  await expect(historyWindow).toHaveValue("latest_10");
  await expect(historyWindow.locator("option:checked")).toHaveText("Latest 10");
  await historyWindow.selectOption("last_7_days");
  await expect(historyWindow).toHaveValue("last_7_days");
  await expect(historyWindow.locator("option:checked")).toHaveText("Last 7 Days");
  await historyWindow.selectOption("last_30_days");
  await expect(historyWindow).toHaveValue("last_30_days");
  await expect(historyWindow.locator("option:checked")).toHaveText("Last 30 Days");
  await historyWindow.selectOption("all_suite");
  await expect(historyWindow).toHaveValue("all_suite");
  await expect(historyWindow.locator("option:checked")).toHaveText("All Suite History");
  await historyWindow.selectOption("latest_10");
  await expect(historyWindow).toHaveValue("latest_10");
  await expect(historyWindow.locator("option:checked")).toHaveText("Latest 10");

  await expect(historyPanel).toContainText("Default latest run");
  await expect(historyPanel).toContainText("Default baseline");

  const recommendationFilter = page.getByLabel("Recommendation Filter");
  await expect(recommendationFilter.locator("option")).toContainText([
    "All",
    "Recommended",
    "Needs Review",
    "Rejected",
  ]);
  await expect(recommendationFilter.locator("option:checked")).toHaveText("All");
  await recommendationFilter.selectOption("recommended");
  await expect(recommendationFilter.locator("option:checked")).toHaveText("Recommended");
  await expect(historyPanel).toContainText(prepared.latestRunId);
  await expect(historyPanel).not.toContainText(prepared.needsReviewRunId);
  await expect(historyPanel).not.toContainText(prepared.rejectedRunId);

  await recommendationFilter.selectOption("needs_review");
  await expect(recommendationFilter.locator("option:checked")).toHaveText("Needs Review");
  await expect(historyPanel).toContainText(prepared.needsReviewRunId);
  await expect(historyPanel).not.toContainText(prepared.latestRunId);
  await expect(historyPanel).not.toContainText(prepared.rejectedRunId);

  await recommendationFilter.selectOption("rejected");
  await expect(recommendationFilter.locator("option:checked")).toHaveText("Rejected");
  await expect(historyPanel).toContainText(prepared.rejectedRunId);
  await expect(historyPanel).not.toContainText(prepared.latestRunId);
  await expect(historyPanel).not.toContainText(prepared.needsReviewRunId);

  await recommendationFilter.selectOption("all");
  await expect(recommendationFilter.locator("option:checked")).toHaveText("All");
  await expect(historyPanel).toContainText(prepared.latestRunId);
  await expect(historyPanel).toContainText(prepared.needsReviewRunId);
  await expect(historyPanel).toContainText(prepared.rejectedRunId);

  const sortMode = page.getByLabel("Sort Mode");
  await expect(sortMode.locator("option")).toContainText([
    "Newest First",
    "Failures First",
  ]);
  await sortMode.selectOption("failures_first");
  await expect(sortMode).toHaveValue("failures_first");
  await expect(sortMode.locator("option:checked")).toHaveText("Failures First");
  await expect(historyButtons.first()).toContainText(prepared.rejectedRunId);

  await sortMode.selectOption("newest");
  await expect(sortMode).toHaveValue("newest");
  await expect(sortMode.locator("option:checked")).toHaveText("Newest First");
  await expect(historyButtons.first()).toContainText(prepared.latestRunId);

  await expect(signalPanel).toContainText("Recommendation Distribution");
  await expect(signalPanel).toContainText("1 recommended / 1 needs review / 1 rejected");
  await expect(signalPanel).toContainText("Evidence Pack Outcomes");
  await expect(signalPanel).toContainText("Recurrence Signals");
  await expect(signalPanel).toContainText("1 regression mentions / 1 failure mentions / 1 runs flagged");

  await expect(page.getByRole("button", { name: "Activate" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Run Launch" })).toHaveCount(0);
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
