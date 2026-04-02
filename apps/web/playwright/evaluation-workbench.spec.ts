import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const apiBaseUrl = "http://127.0.0.1:3001";

test("admin can activate a draft evaluation suite from the evaluation workbench", async ({
  page,
  request,
}) => {
  const prepared = await prepareDraftEvaluationSuite(page, request, {
    label: "Phase 9B",
  });

  await page.goto("/#evaluation-workbench", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Evaluation Workbench" })).toBeVisible();
  await expect(page.locator(".evaluation-workbench")).toContainText(prepared.suiteName);
  await expect(page.getByRole("button", { name: "Activate" })).toBeVisible();

  await page.getByRole("button", { name: "Activate" }).click();

  await expect(page.locator(".evaluation-workbench-status")).toContainText(
    `Activated evaluation suite ${prepared.suiteId}.`,
  );
  await expect(page.locator(".evaluation-workbench-select.is-selected")).toContainText(
    "active",
  );

  const suites = await listEvaluationSuites(request, prepared.cookie);
  const activatedSuite = suites.find((suite) => suite.id === prepared.suiteId);
  expect(activatedSuite?.status).toBe("active");
});

test("admin can complete a manual evaluation loop and hand off a governed learning candidate", async ({
  page,
  request,
}) => {
  const prepared = await prepareActiveEvaluationScenario(request, {
    label: "Phase 9C",
  });

  await page.goto("/#evaluation-workbench", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Evaluation Workbench" })).toBeVisible();
  await expect(page.locator(".evaluation-workbench")).toContainText(prepared.suiteName);

  await page.getByRole("button", { name: prepared.suiteName }).click();
  await page.getByLabel("Sample Set").selectOption(prepared.sampleSetId);
  await page.getByRole("button", { name: "Create Evaluation Run" }).click();
  await expect(page.locator(".evaluation-workbench-status")).toContainText(
    "Created evaluation run",
  );

  await page.getByLabel("Weighted Score").fill("93");
  await page
    .getByLabel("Diff Summary")
    .fill("Candidate passed browser QA and structure review.");
  await page.getByRole("button", { name: "Save Run Item Result" }).click();
  await expect(page.locator(".evaluation-workbench-status")).toContainText(
    "Saved run item result",
  );
  const runItemDetail = page.locator(".evaluation-workbench-run-item-detail");
  await expect(runItemDetail).toContainText("Selected Sample Detail");
  await expect(runItemDetail).toContainText(prepared.snapshotId);
  await expect(runItemDetail).toContainText("clinical_study");
  await expect(runItemDetail).toContainText("structure");
  await expect(runItemDetail).toContainText("demo-model-prod-1");
  await expect(runItemDetail).toContainText("demo-model-candidate-1");

  await page.getByLabel("Evidence Label").fill("Phase 9C browser QA");
  await page
    .getByLabel("Evidence URL")
    .fill("https://example.test/evidence/phase9c-browser-qa");
  await page.getByRole("button", { name: "Complete And Finalize Run" }).click();
  const finalizedCard = page.locator(".evaluation-workbench-finalized");
  await expect(finalizedCard).toContainText("recommended");
  await expect(finalizedCard).toContainText("Score Summary");
  await expect(finalizedCard).toContainText("Average weighted score 93.0 across 1 item(s).");
  await expect(finalizedCard).toContainText("Cost Summary");
  await expect(finalizedCard).toContainText("Cost tracking is not recorded in Phase 6A v1.");
  await expect(page.getByLabel("Reviewed Case Snapshot ID")).toHaveValue(
    prepared.snapshotId,
  );

  await page
    .getByLabel("Learning Candidate Title")
    .fill("Phase 9C prompt promotion");
  await page.getByRole("button", { name: "Create Learning Candidate" }).click();
  await expect(page.locator(".evaluation-workbench-status")).toContainText(
    "Created learning candidate",
  );
  await expect(page.getByRole("link", { name: "Open Learning Review" })).toBeVisible();

  const queueResponse = await request.get(
    `${apiBaseUrl}/api/v1/learning/candidates/review-queue`,
    {
      headers: {
        Cookie: prepared.cookie,
      },
    },
  );
  expect(queueResponse.ok()).toBeTruthy();
  const queue = (await queueResponse.json()) as Array<{
    title?: string;
    status: string;
    governed_provenance_kind?: string;
  }>;
  expect(
    queue.some(
      (candidate) =>
        candidate.title === "Phase 9C prompt promotion" &&
        candidate.status === "pending_review" &&
        candidate.governed_provenance_kind === "evaluation_experiment",
    ),
  ).toBeTruthy();
});

test("admin can finalize a run with artifact evidence from the selected result asset", async ({
  page,
  request,
}) => {
  const prepared = await prepareActiveEvaluationScenario(request, {
    label: "Phase 9L",
  });

  await page.goto("/#evaluation-workbench", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Evaluation Workbench" })).toBeVisible();
  await expect(page.locator(".evaluation-workbench")).toContainText(prepared.suiteName);

  await page.getByRole("button", { name: prepared.suiteName }).click();
  await page.getByLabel("Sample Set").selectOption(prepared.sampleSetId);
  await page.getByRole("button", { name: "Create Evaluation Run" }).click();
  await expect(page.locator(".evaluation-workbench-status")).toContainText(
    "Created evaluation run",
  );

  await page.getByLabel("Weighted Score").fill("94");
  await page
    .getByLabel("Diff Summary")
    .fill("Artifact evidence path reuses the selected result asset.");
  await page.getByRole("button", { name: "Save Run Item Result" }).click();
  await expect(page.locator(".evaluation-workbench-status")).toContainText(
    "Saved run item result",
  );

  await page.getByLabel("Evidence Type").selectOption("artifact");
  await page.getByLabel("Evidence Label").fill("Phase 9L artifact evidence");
  await page.getByLabel("Artifact Asset ID").fill("human-final-demo-1");
  await page.getByRole("button", { name: "Complete And Finalize Run" }).click();

  const finalizedCard = page.locator(".evaluation-workbench-finalized");
  await expect(finalizedCard).toContainText("recommended");
  const finalizedArtifactLink = finalizedCard.getByRole("link", {
    name: "Download evidence artifact",
  });
  await expect(finalizedArtifactLink).toBeVisible();
  await expect(finalizedArtifactLink).toHaveAttribute(
    "href",
    /\/api\/v1\/document-assets\/human-final-demo-1\/download$/,
  );

  const historyDetail = page.locator(".evaluation-workbench-history-detail");
  await expect(historyDetail).toContainText("Phase 9L artifact evidence");
  await expect(historyDetail).toContainText("human-final-demo-1");
});

test("admin can reload a finalized evaluation run and still see the persisted recommendation", async ({
  page,
  request,
}) => {
  const prepared = await prepareActiveEvaluationScenario(request, {
    label: "Phase 9D",
  });

  await page.goto("/#evaluation-workbench", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Evaluation Workbench" })).toBeVisible();
  await expect(page.locator(".evaluation-workbench")).toContainText(prepared.suiteName);

  await page.getByRole("button", { name: prepared.suiteName }).click();
  await page.getByLabel("Sample Set").selectOption(prepared.sampleSetId);
  await page.getByRole("button", { name: "Create Evaluation Run" }).click();

  const createStatus = await page.locator(".evaluation-workbench-status").textContent();
  const runId = createStatus?.match(/Created evaluation run ([^.]+)\./)?.[1] ?? null;
  expect(runId).toBeTruthy();

  await page.getByLabel("Weighted Score").fill("96");
  await page
    .getByLabel("Diff Summary")
    .fill("Persist finalized evaluation output for reload and reselection.");
  await page.getByRole("button", { name: "Save Run Item Result" }).click();
  await expect(page.locator(".evaluation-workbench-status")).toContainText(
    "Saved run item result",
  );

  await page.getByLabel("Evidence Label").fill("Phase 9D reload evidence");
  await page
    .getByLabel("Evidence URL")
    .fill("https://example.test/evidence/phase9d-reload");
  await page.getByRole("button", { name: "Complete And Finalize Run" }).click();

  const finalizedCard = page.locator(".evaluation-workbench-finalized");
  await expect(finalizedCard).toContainText("Finalized Recommendation");
  await expect(finalizedCard).toContainText("recommended");

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Evaluation Workbench" })).toBeVisible();
  await expect(page.locator(".evaluation-workbench")).toContainText(prepared.suiteName);

  await page.getByRole("button", { name: prepared.suiteName }).click();
  await page.getByRole("button", { name: `Run ${runId}`, exact: true }).click();

  await expect(finalizedCard).toContainText("Finalized Recommendation");
  await expect(finalizedCard).toContainText("recommended");
  await expect(page.getByLabel("Reviewed Case Snapshot ID")).toHaveValue(prepared.snapshotId);
});

test("admin can compare the latest finalized run against prior finalized history in the same suite", async ({
  page,
  request,
}) => {
  const prepared = await prepareActiveEvaluationScenario(request, {
    label: "Phase 9E",
  });

  await page.goto("/#evaluation-workbench", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Evaluation Workbench" })).toBeVisible();
  await page.getByRole("button", { name: prepared.suiteName }).click();

  const firstRunId = await createAndFinalizeRunFromWorkbench(page, {
    sampleSetId: prepared.sampleSetId,
    weightedScore: "91",
    diffSummary: "First finalized run establishes the previous baseline.",
    evidenceLabel: "Phase 9E baseline evidence",
    evidenceUrl: "https://example.test/evidence/phase9e-baseline",
    baselineModelId: "demo-model-prod-1",
    candidateModelId: "demo-model-candidate-1",
  });

  const secondRunId = await createAndFinalizeRunFromWorkbench(page, {
    sampleSetId: prepared.sampleSetId,
    weightedScore: "97",
    diffSummary: "Second finalized run improves structure stability.",
    evidenceLabel: "Phase 9E comparison evidence",
    evidenceUrl: "https://example.test/evidence/phase9e-comparison",
    baselineModelId: "demo-model-prod-2",
    candidateModelId: "demo-model-candidate-2",
    promptTemplateId: "demo-prompt-candidate-2",
    skillPackageIds: "demo-skill-prod-1,demo-skill-candidate-2",
  });

  const historyPanel = page.locator(".evaluation-workbench-history");
  await expect(historyPanel).toContainText("Run History");
  await expect(historyPanel).toContainText(firstRunId);
  await expect(historyPanel).toContainText(secondRunId);
  await expect(historyPanel).toContainText(`Comparing against ${firstRunId}`);
  await expect(historyPanel).toContainText("Selected recommendation");
  await expect(historyPanel).toContainText("recommended");
  await expect(historyPanel).toContainText("Binding Changes");
  await expect(historyPanel).toContainText(
    "Baseline model changed: demo-model-prod-2 (was demo-model-prod-1)",
  );
  await expect(historyPanel).toContainText(
    "Candidate model changed: demo-model-candidate-2 (was demo-model-candidate-1)",
  );
  await expect(historyPanel).toContainText(
    "Candidate prompt changed: demo-prompt-candidate-2 (was demo-prompt-prod-1)",
  );
  await expect(historyPanel).toContainText(
    "Selected evidence: Phase 9E comparison evidence",
  );
  await expect(historyPanel).toContainText(
    "Previous evidence: Phase 9E baseline evidence",
  );
  await expect(historyPanel).toContainText("Selected evidence pack");
  await expect(historyPanel).toContainText("Previous evidence pack");
  await expect(historyPanel).toContainText("Average weighted score 97.0 across 1 item(s).");
  await expect(historyPanel).toContainText("Average weighted score 91.0 across 1 item(s).");
});

test("admin sees explicit compare guidance while the current run is still running", async ({
  page,
  request,
}) => {
  const prepared = await prepareActiveEvaluationScenario(request, {
    label: "Phase 9K",
  });

  await page.goto("/#evaluation-workbench", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Evaluation Workbench" })).toBeVisible();
  await page.getByRole("button", { name: prepared.suiteName }).click();
  await page.getByLabel("Sample Set").selectOption(prepared.sampleSetId);
  await page.getByRole("button", { name: "Create Evaluation Run" }).click();

  const createStatus = await page.locator(".evaluation-workbench-status").textContent();
  const runId = createStatus?.match(/Created evaluation run ([^.]+)\./)?.[1] ?? null;
  expect(runId).toBeTruthy();

  const historyPanel = page.locator(".evaluation-workbench-history");
  await expect(historyPanel).toContainText(
    new RegExp(
      `Current run ${runId} is still [a-z_]+\\. Complete and finalize it to compare against history\\.`,
    ),
  );
});

test("admin can inspect rejected history details for a prior finalized run", async ({
  page,
  request,
}) => {
  const prepared = await prepareActiveEvaluationScenario(request, {
    label: "Phase 9F",
  });

  await page.goto("/#evaluation-workbench", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Evaluation Workbench" })).toBeVisible();
  await page.getByRole("button", { name: prepared.suiteName }).click();

  const rejectedRunId = await createAndFinalizeRunFromWorkbench(page, {
    sampleSetId: prepared.sampleSetId,
    weightedScore: "58",
    diffSummary: "Rejected run regressed on structure stability.",
    evidenceLabel: "Phase 9F rejected evidence",
    evidenceUrl: "https://example.test/evidence/phase9f-rejected",
    hardGatePassed: false,
    failureKind: "regression_failed",
    failureReason: "Structure regression triggered the hard gate.",
    finalizeStatus: "failed",
  });

  await createAndFinalizeRunFromWorkbench(page, {
    sampleSetId: prepared.sampleSetId,
    weightedScore: "95",
    diffSummary: "Recovery run restored stable structure handling.",
    evidenceLabel: "Phase 9F recovery evidence",
    evidenceUrl: "https://example.test/evidence/phase9f-recovery",
  });

  await page.getByRole("button", { name: `History run ${rejectedRunId}`, exact: true }).click();

  const historyDetail = page.locator(".evaluation-workbench-history-detail");
  await expect(historyDetail).toContainText("Selected History Detail");
  await expect(historyDetail).toContainText(rejectedRunId);
  await expect(historyDetail).toContainText("rejected");
  await expect(historyDetail).toContainText("Structure regression triggered the hard gate.");
  await expect(historyDetail).toContainText("Phase 9F rejected evidence");
  await expect(historyDetail).toContainText(prepared.snapshotId);
  await expect(historyDetail).toContainText("Failure Summary");
  await expect(historyDetail).toContainText("Regression Summary");
  await expect(historyDetail).toContainText("1 regression-failed item(s) detected.");
  await expect(historyDetail).toContainText("Linked Sample Context");
  await expect(historyDetail).toContainText("Sample Item:");
  await expect(historyDetail).toContainText("clinical_study");
  await expect(historyDetail).toContainText("Weighted Score:");
});

test("admin can focus a specific run item from linked sample context", async ({
  page,
  request,
}) => {
  const prepared = await prepareActiveEvaluationScenario(request, {
    label: `Phase 9M ${Date.now()}`,
    sampleItemCount: 2,
  });

  await page.goto("/#evaluation-workbench", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Evaluation Workbench" })).toBeVisible();
  await page.getByRole("button", { name: prepared.suiteName }).click();
  await page.getByLabel("Sample Set").selectOption(prepared.sampleSetId);
  await page.getByRole("button", { name: "Create Evaluation Run" }).click();
  await expect(page.locator(".evaluation-workbench-status")).toContainText(
    "Created evaluation run",
  );

  const runItemButtons = page.locator(".evaluation-workbench-panel").filter({ has: page.getByRole("heading", { name: "Run Items" }) }).locator(".evaluation-workbench-stack > li > button");
  await expect(runItemButtons).toHaveCount(2);

  await page.getByLabel("Weighted Score").fill("77");
  await page.getByLabel("Diff Summary").fill("First run item keeps the baseline stable.");
  await page.getByRole("button", { name: "Save Run Item Result" }).click();
  await expect(page.locator(".evaluation-workbench-status")).toContainText(
    "Saved run item result",
  );

  await runItemButtons.nth(1).click();
  await page.getByLabel("Weighted Score").fill("63");
  await page.getByLabel("Failure Kind").selectOption("regression_failed");
  await page.getByLabel("Failure Reason").fill("Second run item triggered a structure regression.");
  await page.getByLabel("Diff Summary").fill("Second run item drifted from the approved structure.");
  await page.getByRole("button", { name: "Save Run Item Result" }).click();
  await expect(page.locator(".evaluation-workbench-status")).toContainText(
    "Saved run item result",
  );

  await page.getByLabel("Run Status").selectOption("failed");
  await page.getByLabel("Evidence Label").fill("Phase 9M evidence");
  await page.getByLabel("Evidence URL").fill("https://example.test/evidence/phase9m");
  await page.getByRole("button", { name: "Complete And Finalize Run" }).click();
  await expect(page.locator(".evaluation-workbench-finalized")).toContainText("rejected");

  const historyDetail = page.locator(".evaluation-workbench-history-detail");
  const focusButtons = historyDetail.getByRole("button", { name: /Focus Run Item/ });
  await expect(focusButtons).toHaveCount(2);
  await runItemButtons.nth(0).click();

  const runItemDetail = page.locator(".evaluation-workbench-run-item-detail");
  await expect(runItemDetail).toContainText("First run item keeps the baseline stable.");
  await focusButtons.nth(1).click();
  await expect(runItemDetail).toContainText("Second run item triggered a structure regression.");
  await expect(runItemDetail).toContainText("Second run item drifted from the approved structure.");
});

test("admin can filter finalized run history by recommendation status", async ({
  page,
  request,
}) => {
  const prepared = await prepareActiveEvaluationScenario(request, {
    label: "Phase 9G",
  });

  await page.goto("/#evaluation-workbench", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Evaluation Workbench" })).toBeVisible();
  await page.getByRole("button", { name: prepared.suiteName }).click();

  const rejectedRunId = await createAndFinalizeRunFromWorkbench(page, {
    sampleSetId: prepared.sampleSetId,
    weightedScore: "54",
    diffSummary: "Rejected run is used to test history filtering.",
    evidenceLabel: "Phase 9G rejected evidence",
    evidenceUrl: "https://example.test/evidence/phase9g-rejected",
    hardGatePassed: false,
    failureKind: "regression_failed",
    failureReason: "Rejected run tripped the hard gate.",
    finalizeStatus: "failed",
  });

  const recommendedRunId = await createAndFinalizeRunFromWorkbench(page, {
    sampleSetId: prepared.sampleSetId,
    weightedScore: "94",
    diffSummary: "Recommended run restores the approved output.",
    evidenceLabel: "Phase 9G recommended evidence",
    evidenceUrl: "https://example.test/evidence/phase9g-recommended",
  });

  const historyList = page.locator(".evaluation-workbench-history-list");
  await expect(historyList).toContainText(rejectedRunId);
  await expect(historyList).toContainText(recommendedRunId);

  await page.getByRole("button", { name: "Rejected (1)" }).click();
  await expect(historyList).toContainText(rejectedRunId);
  await expect(historyList).not.toContainText(recommendedRunId);

  await page.getByRole("button", { name: "Recommended (1)" }).click();
  await expect(historyList).toContainText(recommendedRunId);
  await expect(historyList).not.toContainText(rejectedRunId);

  await page.getByRole("button", { name: "All (2)" }).click();
  await expect(historyList).toContainText(rejectedRunId);
  await expect(historyList).toContainText(recommendedRunId);
});

test("admin can search finalized run history by model binding and run id", async ({
  page,
  request,
}) => {
  const prepared = await prepareActiveEvaluationScenario(request, {
    label: "Phase 9H",
  });

  await page.goto("/#evaluation-workbench", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Evaluation Workbench" })).toBeVisible();
  await page.getByRole("button", { name: prepared.suiteName }).click();

  const firstRunId = await createAndFinalizeRunFromWorkbench(page, {
    sampleSetId: prepared.sampleSetId,
    weightedScore: "89",
    diffSummary: "Search target one establishes the older baseline.",
    evidenceLabel: "Phase 9H first evidence",
    evidenceUrl: "https://example.test/evidence/phase9h-first",
    candidateModelId: "search-model-one",
  });

  const secondRunId = await createAndFinalizeRunFromWorkbench(page, {
    sampleSetId: prepared.sampleSetId,
    weightedScore: "95",
    diffSummary: "Search target two updates the candidate binding.",
    evidenceLabel: "Phase 9H second evidence",
    evidenceUrl: "https://example.test/evidence/phase9h-second",
    candidateModelId: "search-model-two",
  });

  const historyList = page.locator(".evaluation-workbench-history-list");
  await page.getByLabel("Search History").fill("search-model-two");
  await expect(historyList).toContainText(secondRunId);
  await expect(historyList).not.toContainText(firstRunId);

  await page.getByLabel("Search History").fill(firstRunId);
  await expect(historyList).toContainText(firstRunId);
  await expect(historyList).not.toContainText(secondRunId);

  await page.getByLabel("Search History").fill("");
  await expect(historyList).toContainText(firstRunId);
  await expect(historyList).toContainText(secondRunId);
});

test("admin can search history by regression summary and reset an empty result set", async ({
  page,
  request,
}) => {
  const uniqueLabel = `Phase 9L ${Date.now()}`;
  const prepared = await prepareActiveEvaluationScenario(request, {
    label: uniqueLabel,
  });

  await page.goto("/#evaluation-workbench", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Evaluation Workbench" })).toBeVisible();
  await page.getByRole("button", { name: prepared.suiteName }).click();

  const rejectedRunId = await createAndFinalizeRunFromWorkbench(page, {
    sampleSetId: prepared.sampleSetId,
    weightedScore: "57",
    diffSummary: "Rejected run seeds regression-summary search coverage.",
    evidenceLabel: "Phase 9L rejected evidence",
    evidenceUrl: "https://example.test/evidence/phase9l-rejected",
    hardGatePassed: false,
    failureKind: "regression_failed",
    failureReason: "Phase 9L rejected run tripped the hard gate.",
    finalizeStatus: "failed",
  });

  const recommendedRunId = await createAndFinalizeRunFromWorkbench(page, {
    sampleSetId: prepared.sampleSetId,
    weightedScore: "96",
    diffSummary: "Recommended run verifies empty-state reset restores the list.",
    evidenceLabel: "Phase 9L recommended evidence",
    evidenceUrl: "https://example.test/evidence/phase9l-recommended",
  });

  const historyList = page.locator(".evaluation-workbench-history-list");
  await page.getByLabel("Search History").fill("regression-failed item");
  await expect(historyList).toContainText(rejectedRunId);
  await expect(historyList).not.toContainText(recommendedRunId);

  await page.getByLabel("Search History").fill("phase9l-no-matches");
  const emptyState = page.locator(".evaluation-workbench-history-empty-state");
  await expect(emptyState).toContainText("No finalized runs match the current history controls.");
  await expect(emptyState).toContainText("Search: phase9l-no-matches");
  await page.getByRole("button", { name: "Reset History Controls" }).click();
  await expect(emptyState).toBeHidden();
  await expect(page.getByLabel("Search History")).toHaveValue("");
  await expect(historyList).toContainText(rejectedRunId);
  await expect(historyList).toContainText(recommendedRunId);
});

test("admin can recover a selected run hidden by history search", async ({
  page,
  request,
}) => {
  const prepared = await prepareActiveEvaluationScenario(request, {
    label: "Phase 9I",
  });

  await page.goto("/#evaluation-workbench", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Evaluation Workbench" })).toBeVisible();
  await page.getByRole("button", { name: prepared.suiteName }).click();

  const firstRunId = await createAndFinalizeRunFromWorkbench(page, {
    sampleSetId: prepared.sampleSetId,
    weightedScore: "88",
    diffSummary: "First hidden-selection run.",
    evidenceLabel: "Phase 9I first evidence",
    evidenceUrl: "https://example.test/evidence/phase9i-first",
    candidateModelId: "hidden-model-one",
  });

  const secondRunId = await createAndFinalizeRunFromWorkbench(page, {
    sampleSetId: prepared.sampleSetId,
    weightedScore: "96",
    diffSummary: "Second hidden-selection run.",
    evidenceLabel: "Phase 9I second evidence",
    evidenceUrl: "https://example.test/evidence/phase9i-second",
    candidateModelId: "hidden-model-two",
  });

  await page.getByLabel("Search History").fill(firstRunId);

  const hiddenNotice = page.locator(".evaluation-workbench-history-hidden-selection");
  await expect(hiddenNotice).toContainText("currently hidden");
  await expect(page.locator(".evaluation-workbench-history-list")).toContainText(firstRunId);
  await expect(page.locator(".evaluation-workbench-history-list")).not.toContainText(secondRunId);

  await page.getByRole("button", { name: "Show Selected Run" }).click();
  await expect(hiddenNotice).toBeHidden();
  await expect(page.getByLabel("Search History")).toHaveValue("");
  await expect(page.locator(".evaluation-workbench-history-list")).toContainText(firstRunId);
  await expect(page.locator(".evaluation-workbench-history-list")).toContainText(secondRunId);
});

test("admin can prioritize failed history runs to the top of the list", async ({
  page,
  request,
}) => {
  const prepared = await prepareActiveEvaluationScenario(request, {
    label: "Phase 9J",
  });

  await page.goto("/#evaluation-workbench", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Evaluation Workbench" })).toBeVisible();
  await page.getByRole("button", { name: prepared.suiteName }).click();

  const rejectedRunId = await createAndFinalizeRunFromWorkbench(page, {
    sampleSetId: prepared.sampleSetId,
    weightedScore: "52",
    diffSummary: "Rejected run should bubble to the top in failure sort mode.",
    evidenceLabel: "Phase 9J rejected evidence",
    evidenceUrl: "https://example.test/evidence/phase9j-rejected",
    hardGatePassed: false,
    failureKind: "regression_failed",
    failureReason: "Phase 9J rejected run tripped the hard gate.",
    finalizeStatus: "failed",
  });

  const recommendedRunId = await createAndFinalizeRunFromWorkbench(page, {
    sampleSetId: prepared.sampleSetId,
    weightedScore: "96",
    diffSummary: "Recommended run stays newest but should move below failures.",
    evidenceLabel: "Phase 9J recommended evidence",
    evidenceUrl: "https://example.test/evidence/phase9j-recommended",
  });

  const historyItems = page.locator(".evaluation-workbench-history-list li");
  await expect(historyItems.first()).toContainText(recommendedRunId);
  await expect(page.locator(".evaluation-workbench-history-list")).toContainText("Score:");
  await expect(page.locator(".evaluation-workbench-history-list")).toContainText("Regression:");
  await expect(page.locator(".evaluation-workbench-history-list")).toContainText(
    "1 regression-failed item(s) detected.",
  );
  await expect(page.locator(".evaluation-workbench-history-list")).toContainText("Failure:");
  await expect(page.locator(".evaluation-workbench-history-list")).toContainText(
    "Phase 9J rejected run tripped the hard gate.",
  );

  await page.getByRole("button", { name: "Failures First" }).click();
  await expect(historyItems.first()).toContainText(rejectedRunId);
  await expect(page.locator(".evaluation-workbench-history-list")).toContainText(recommendedRunId);
});

interface PrepareDraftEvaluationSuiteInput {
  label: string;
  sampleItemCount?: number;
}

interface PreparedDraftEvaluationSuite {
  cookie: string;
  suiteId: string;
  suiteName: string;
}

interface EvaluationSuiteRecord {
  id: string;
  name: string;
  status: string;
}

async function prepareDraftEvaluationSuite(
  page: Page,
  request: APIRequestContext,
  input: PrepareDraftEvaluationSuiteInput,
): Promise<PreparedDraftEvaluationSuite> {
  const cookie = await loginAsDemoUser(request, "dev.admin");

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
  const checkProfile = (await checkProfileResponse.json()) as {
    id: string;
  };

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

  const suiteName = `${input.label} Draft Evaluation Suite`;
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
          suiteType: "release_gate",
          verificationCheckProfileIds: [checkProfile.id],
          moduleScope: ["editing"],
          requiresProductionBaseline: true,
          supportsAbComparison: false,
        },
      },
    },
  );
  if (!suiteResponse.ok()) {
    throw new Error(
      `create suite failed (${suiteResponse.status()}): ${await suiteResponse.text()}`,
    );
  }
  const suite = (await suiteResponse.json()) as {
    id: string;
    name: string;
  };

  return {
    cookie,
    suiteId: suite.id,
    suiteName: suite.name,
  };
}

async function listEvaluationSuites(
  request: APIRequestContext,
  cookie?: string,
): Promise<EvaluationSuiteRecord[]> {
  const response = await request.get(`${apiBaseUrl}/api/v1/verification-ops/evaluation-suites`, {
    ...(cookie
      ? {
          headers: {
            Cookie: cookie,
          },
        }
      : {}),
  });
  if (!response.ok()) {
    throw new Error(
      `list suites failed (${response.status()}): ${await response.text()}`,
    );
  }
  return (await response.json()) as EvaluationSuiteRecord[];
}

async function prepareActiveEvaluationScenario(
  request: APIRequestContext,
  input: PrepareDraftEvaluationSuiteInput,
): Promise<
  PreparedDraftEvaluationSuite & { sampleSetId: string; snapshotId: string; snapshotIds: string[] }
> {
  const cookie = await loginAsDemoUser(request, "dev.admin");
  const sampleItemCount = input.sampleItemCount ?? 1;
  const storagePrefix = input.label.toLowerCase().replace(/\s+/g, "-");
  const snapshots: Array<{ id: string }> = [];
  for (let index = 0; index < sampleItemCount; index += 1) {
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
          storageKey: `learning/${storagePrefix}/snapshot-${index + 1}.bin`,
        },
      },
    );
    if (!snapshotResponse.ok()) {
      throw new Error(
        `create reviewed snapshot failed (${snapshotResponse.status()}): ${await snapshotResponse.text()}`,
      );
    }
    snapshots.push((await snapshotResponse.json()) as { id: string });
  }

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
          sampleItemInputs: snapshots.map((snapshot, index) => ({
            reviewedCaseSnapshotId: snapshot.id,
            riskTags: [index === 0 ? "structure" : "terminology"],
          })),
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
    snapshotId: snapshots[0]?.id ?? "",
    snapshotIds: snapshots.map((snapshot) => snapshot.id),
  };
}

async function createAndFinalizeRunFromWorkbench(
  page: Page,
  input: {
    sampleSetId: string;
    weightedScore: string;
    diffSummary: string;
    evidenceLabel: string;
    evidenceUrl: string;
    baselineModelId?: string;
    candidateModelId?: string;
    promptTemplateId?: string;
    skillPackageIds?: string;
    hardGatePassed?: boolean;
    failureKind?: string;
    failureReason?: string;
    finalizeStatus?: "passed" | "failed";
  },
): Promise<string> {
  await page.getByLabel("Sample Set").selectOption(input.sampleSetId);
  if (input.baselineModelId) {
    await page.getByLabel("Baseline Model ID").fill(input.baselineModelId);
  }
  if (input.candidateModelId) {
    await page.getByLabel("Candidate Model ID").fill(input.candidateModelId);
  }
  if (input.promptTemplateId) {
    await page.getByLabel("Prompt Template ID").fill(input.promptTemplateId);
  }
  if (input.skillPackageIds) {
    await page.getByLabel("Skill Package IDs").fill(input.skillPackageIds);
  }
  await page.getByRole("button", { name: "Create Evaluation Run" }).click();

  const createStatus = await page.locator(".evaluation-workbench-status").textContent();
  const runId = createStatus?.match(/Created evaluation run ([^.]+)\./)?.[1] ?? null;
  expect(runId).toBeTruthy();

  await page.getByLabel("Weighted Score").fill(input.weightedScore);
  await page.getByLabel("Diff Summary").fill(input.diffSummary);
  if (input.hardGatePassed === false) {
    await page.getByLabel("Hard Gate Passed").uncheck();
  }
  if (input.failureKind) {
    await page.getByLabel("Failure Kind").selectOption(input.failureKind);
  }
  if (input.failureReason) {
    await page.getByLabel("Failure Reason").fill(input.failureReason);
  }
  await page.getByRole("button", { name: "Save Run Item Result" }).click();
  await expect(page.locator(".evaluation-workbench-status")).toContainText(
    "Saved run item result",
  );

  if (input.finalizeStatus) {
    await page.getByLabel("Run Status").selectOption(input.finalizeStatus);
  }
  await page.getByLabel("Evidence Label").fill(input.evidenceLabel);
  await page.getByLabel("Evidence URL").fill(input.evidenceUrl);
  await page.getByRole("button", { name: "Complete And Finalize Run" }).click();
  await expect(page.locator(".evaluation-workbench-finalized")).toContainText(
    input.finalizeStatus === "failed" ? "rejected" : "recommended",
  );

  return runId ?? "";
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
