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
  await expect(historyPanel).toContainText(
    "Operator summary: Improved over entire suite history by 6.0 weighted points while holding recommended.",
  );
  await expect(historyPanel).toContainText(
    "Baseline policy: Chronological previous finalized run within entire suite history.",
  );
  await expect(historyPanel).toContainText("Suggested action: Promote candidate");
  await expect(historyPanel).toContainText("Comparison scope: Entire suite history");
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
  await expect(historyPanel).toContainText("Evidence Pack Changes");
  await expect(historyPanel).toContainText(
    "Score summary changed: Average weighted score 97.0 across 1 item(s). (was Average weighted score 91.0 across 1 item(s).)",
  );
  await expect(historyPanel).toContainText("Selected evidence pack");
  await expect(historyPanel).toContainText("Previous evidence pack");
  await expect(historyPanel).toContainText("Average weighted score 97.0 across 1 item(s).");
  await expect(historyPanel).toContainText("Average weighted score 91.0 across 1 item(s).");
  const historyList = historyPanel.locator(".evaluation-workbench-history-list");
  await expect(historyList).toContainText("recommended / recommended");
  await expect(historyList).toContainText("Selected run");
  await expect(historyList).toContainText("Compare baseline");
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
  await expect(historyPanel).toContainText(
    "Comparison unlocks after this run reaches a finalized recommendation with persisted evidence.",
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
  await expect(historyDetail).toContainText("Download Result Asset");
  await expect(historyDetail).toContainText("Download Sample Snapshot");
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

test("admin can open the editing workbench from linked sample context", async ({
  page,
  request,
}) => {
  const prepared = await prepareActiveEvaluationScenario(request, {
    label: `Phase 9N ${Date.now()}`,
  });

  await page.goto("/#evaluation-workbench", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Evaluation Workbench" })).toBeVisible();
  await page.getByRole("button", { name: prepared.suiteName }).click();

  await createAndFinalizeRunFromWorkbench(page, {
    sampleSetId: prepared.sampleSetId,
    weightedScore: "92",
    diffSummary: "Linked sample context should hand off into the editing workbench.",
    evidenceLabel: "Phase 9N handoff evidence",
    evidenceUrl: "https://example.test/evidence/phase9n-handoff",
  });

  const historyDetail = page.locator(".evaluation-workbench-history-detail");
  const handoffLink = historyDetail.getByRole("link", { name: "Open Editing Workbench" });
  await expect(handoffLink).toBeVisible();
  const handoffHref = await handoffLink.getAttribute("href");
  expect(handoffHref).toBeTruthy();
  const handoffParams = new URLSearchParams(handoffHref?.split("?")[1] ?? "");
  expect(handoffParams.get("manuscriptId")).toBe("manuscript-demo-1");
  expect(handoffParams.get("reviewedCaseSnapshotId")).toBe(prepared.snapshotId);
  expect(handoffParams.get("sampleSetItemId")).toBe(prepared.sampleSetItemId);

  await handoffLink.click();

  await expect(page).toHaveURL(/#editing\?/);
  const editingUrl = new URL(page.url());
  const editingParams = new URLSearchParams(editingUrl.hash.split("?")[1] ?? "");
  expect(editingParams.get("manuscriptId")).toBe("manuscript-demo-1");
  expect(editingParams.get("reviewedCaseSnapshotId")).toBe(prepared.snapshotId);
  expect(editingParams.get("sampleSetItemId")).toBe(prepared.sampleSetItemId);
  await expect(page.getByRole("heading", { name: "Editing Workbench" })).toBeVisible();
  const evaluationContextCard = page.locator(".manuscript-workbench-evaluation-context-card");
  await expect(evaluationContextCard).toContainText("Evaluation Handoff Context");
  await expect(evaluationContextCard).toContainText(prepared.snapshotId);
  await expect(evaluationContextCard).toContainText(prepared.sampleSetItemId);
  await expect(page.getByText("This workbench was prefilled from the previous manuscript handoff.")).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "Auto-loaded manuscript manuscript-demo-1",
  );
});

test("admin can jump from manuscript workbench back into manuscript-scoped evaluation context", async ({
  page,
  request,
}) => {
  const prepared = await prepareActiveEvaluationScenario(request, {
    label: `Phase 9O ${Date.now()}`,
  });

  await page.goto("/#evaluation-workbench", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Evaluation Workbench" })).toBeVisible();
  await page.getByRole("button", { name: prepared.suiteName }).click();

  const runId = await createAndFinalizeRunFromWorkbench(page, {
    sampleSetId: prepared.sampleSetId,
    weightedScore: "93",
    diffSummary: "Round-trip handoff should reopen the manuscript-specific evaluation context.",
    evidenceLabel: "Phase 9O evaluation evidence",
    evidenceUrl: "https://example.test/evidence/phase9o-roundtrip",
  });

  await page.goto(
    `/#editing?manuscriptId=manuscript-demo-1&reviewedCaseSnapshotId=${prepared.snapshotId}&sampleSetItemId=${prepared.sampleSetItemId}`,
    {
      waitUntil: "domcontentloaded",
    },
  );

  await expect(page.getByRole("heading", { name: "Editing Workbench" })).toBeVisible();
  const evaluationContextCard = page.locator(".manuscript-workbench-evaluation-context-card");
  await expect(evaluationContextCard).toContainText("Evaluation Handoff Context");
  await expect(evaluationContextCard).toContainText(prepared.snapshotId);
  await expect(evaluationContextCard).toContainText(prepared.sampleSetItemId);
  const evaluationLink = page.getByRole("link", { name: "Open Evaluation Workbench" });
  await expect(evaluationLink).toBeVisible();
  const evaluationHref = await evaluationLink.getAttribute("href");
  expect(evaluationHref).toBeTruthy();
  const evaluationHandoffParams = new URLSearchParams(evaluationHref?.split("?")[1] ?? "");
  expect(evaluationHandoffParams.get("manuscriptId")).toBe("manuscript-demo-1");
  expect(evaluationHandoffParams.get("reviewedCaseSnapshotId")).toBe(prepared.snapshotId);
  expect(evaluationHandoffParams.get("sampleSetItemId")).toBe(prepared.sampleSetItemId);

  await evaluationLink.click();

  await expect(page).toHaveURL(/#evaluation-workbench\?/);
  const evaluationWorkbenchUrl = new URL(page.url());
  const evaluationWorkbenchParams = new URLSearchParams(
    evaluationWorkbenchUrl.hash.split("?")[1] ?? "",
  );
  expect(evaluationWorkbenchParams.get("manuscriptId")).toBe("manuscript-demo-1");
  expect(evaluationWorkbenchParams.get("reviewedCaseSnapshotId")).toBe(prepared.snapshotId);
  expect(evaluationWorkbenchParams.get("sampleSetItemId")).toBe(prepared.sampleSetItemId);
  await expect(page.getByRole("heading", { name: "Evaluation Workbench" })).toBeVisible();
  await expect(page.locator(".evaluation-workbench")).toContainText(
    "Context manuscript: manuscript-demo-1",
  );
  await expect(page.locator(".evaluation-workbench")).toContainText(prepared.suiteName);
  await expect(page.locator(".evaluation-workbench-history-detail")).toContainText(runId);
});

test("admin preserves sample context across manuscript next-step shortcuts before returning to evaluation", async ({
  page,
  request,
}) => {
  const prepared = await prepareActiveEvaluationScenario(request, {
    label: `Phase 9Q ${Date.now()}`,
  });
  const seededSampleSet = await createPublishedEditingSampleSet(request, prepared.cookie, {
    label: `Phase 9Q seeded ${Date.now()}`,
    manuscriptId: "manuscript-seeded-1",
    manuscriptType: "clinical_study",
    parentAssetId: "original-seeded-1",
  });

  await page.goto("/#evaluation-workbench", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Evaluation Workbench" })).toBeVisible();
  await page.getByRole("button", { name: prepared.suiteName }).click();

  const runId = await createAndFinalizeRunFromWorkbench(page, {
    sampleSetId: seededSampleSet.sampleSetId,
    weightedScore: "94",
    diffSummary:
      "Sample context should stay attached through manuscript next-step shortcuts.",
    evidenceLabel: "Phase 9Q evaluation evidence",
    evidenceUrl: "https://example.test/evidence/phase9q-roundtrip",
  });

  const historyDetail = page.locator(".evaluation-workbench-history-detail");
  const editingLink = historyDetail.getByRole("link", { name: "Open Editing Workbench" });
  await expect(editingLink).toBeVisible();
  await editingLink.click();

  await expect(page.getByRole("heading", { name: "Editing Workbench" })).toBeVisible();
  const editingUrl = new URL(page.url());
  const editingParams = new URLSearchParams(editingUrl.hash.split("?")[1] ?? "");
  expect(editingParams.get("manuscriptId")).toBe("manuscript-seeded-1");
  expect(editingParams.get("reviewedCaseSnapshotId")).toBe(seededSampleSet.snapshotId);
  expect(editingParams.get("sampleSetItemId")).toBe(seededSampleSet.sampleSetItemId);

  const evaluationContextCard = page.locator(".manuscript-workbench-evaluation-context-card");
  await expect(evaluationContextCard).toContainText("Evaluation Handoff Context");
  await expect(evaluationContextCard).toContainText(seededSampleSet.snapshotId);
  await expect(evaluationContextCard).toContainText(seededSampleSet.sampleSetItemId);

  const runEditingButton = page.getByRole("button", { name: "Run Editing" });
  await expect(runEditingButton).toBeEnabled();
  await runEditingButton.click();
  await expect(page.locator("body")).toContainText("Created asset");

  const proofreadingLink = page.getByRole("link", { name: "Open Proofreading Workbench" });
  await expect(proofreadingLink).toBeVisible();
  const proofreadingHref = await proofreadingLink.getAttribute("href");
  expect(proofreadingHref).toBeTruthy();
  const proofreadingHandoffParams = new URLSearchParams(
    proofreadingHref?.split("?")[1] ?? "",
  );
  expect(proofreadingHandoffParams.get("manuscriptId")).toBe("manuscript-seeded-1");
  expect(proofreadingHandoffParams.get("reviewedCaseSnapshotId")).toBe(
    seededSampleSet.snapshotId,
  );
  expect(proofreadingHandoffParams.get("sampleSetItemId")).toBe(
    seededSampleSet.sampleSetItemId,
  );

  await proofreadingLink.click();

  await expect(page.getByRole("heading", { name: "Proofreading Workbench" })).toBeVisible();
  const proofreadingUrl = new URL(page.url());
  const proofreadingParams = new URLSearchParams(proofreadingUrl.hash.split("?")[1] ?? "");
  expect(proofreadingParams.get("manuscriptId")).toBe("manuscript-seeded-1");
  expect(proofreadingParams.get("reviewedCaseSnapshotId")).toBe(seededSampleSet.snapshotId);
  expect(proofreadingParams.get("sampleSetItemId")).toBe(seededSampleSet.sampleSetItemId);
  await expect(evaluationContextCard).toContainText("Evaluation Handoff Context");
  await expect(evaluationContextCard).toContainText(seededSampleSet.snapshotId);
  await expect(evaluationContextCard).toContainText(seededSampleSet.sampleSetItemId);

  const evaluationLink = page.getByRole("link", { name: "Open Evaluation Workbench" });
  await expect(evaluationLink).toBeVisible();
  const evaluationHref = await evaluationLink.getAttribute("href");
  expect(evaluationHref).toBeTruthy();
  const evaluationHandoffParams = new URLSearchParams(evaluationHref?.split("?")[1] ?? "");
  expect(evaluationHandoffParams.get("manuscriptId")).toBe("manuscript-seeded-1");
  expect(evaluationHandoffParams.get("reviewedCaseSnapshotId")).toBe(
    seededSampleSet.snapshotId,
  );
  expect(evaluationHandoffParams.get("sampleSetItemId")).toBe(
    seededSampleSet.sampleSetItemId,
  );

  await evaluationLink.click();

  await expect(page.getByRole("heading", { name: "Evaluation Workbench" })).toBeVisible();
  const evaluationWorkbenchUrl = new URL(page.url());
  const evaluationWorkbenchParams = new URLSearchParams(
    evaluationWorkbenchUrl.hash.split("?")[1] ?? "",
  );
  expect(evaluationWorkbenchParams.get("manuscriptId")).toBe("manuscript-seeded-1");
  expect(evaluationWorkbenchParams.get("reviewedCaseSnapshotId")).toBe(
    seededSampleSet.snapshotId,
  );
  expect(evaluationWorkbenchParams.get("sampleSetItemId")).toBe(
    seededSampleSet.sampleSetItemId,
  );
  await expect(page.locator(".evaluation-workbench")).toContainText(
    "Context manuscript: manuscript-seeded-1",
  );
  await expect(page.locator(".evaluation-workbench-history-detail")).toContainText(runId);
});

test("admin can inspect and finalize a seeded governed run without sample-set context", async ({
  page,
  request,
}) => {
  const prepared = await prepareGovernedSeededEvaluationScenario(request, {
    label: `Phase 9S ${Date.now()}`,
  });

  await page.goto(`/#evaluation-workbench?manuscriptId=${prepared.manuscriptId}`, {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Evaluation Workbench" })).toBeVisible();
  await expect(page.locator(".evaluation-workbench")).toContainText(
    `Context manuscript: ${prepared.manuscriptId}`,
  );
  await expect(page.locator(".evaluation-workbench")).toContainText(
    `Matched suite: ${prepared.suiteId}`,
  );
  await expect(page.locator(".evaluation-workbench")).toContainText(
    `Matched run: ${prepared.runId}`,
  );
  await expect(page.locator(".evaluation-workbench")).toContainText(prepared.suiteName);

  const runItemsPanel = page
    .locator(".evaluation-workbench-panel")
    .filter({ has: page.getByRole("heading", { name: "Run Items" }) });
  await expect(runItemsPanel).toContainText("Governed Source Detail");
  await expect(runItemsPanel).toContainText("Source Module: editing");
  await expect(runItemsPanel).toContainText(`Manuscript: ${prepared.manuscriptId}`);
  await expect(runItemsPanel).toContainText(
    `Execution Snapshot: ${prepared.executionSnapshotId}`,
  );
  await expect(runItemsPanel).toContainText(
    `Agent Execution Log: ${prepared.agentExecutionLogId}`,
  );
  await expect(runItemsPanel).toContainText(`Output Asset: ${prepared.outputAssetId}`);
  await expect(
    runItemsPanel.getByRole("link", { name: "Download Governed Output Asset" }),
  ).toHaveAttribute(
    "href",
    new RegExp(`/api/v1/document-assets/${prepared.outputAssetId}/download$`),
  );
  await expect(
    runItemsPanel.getByRole("link", { name: "Open Editing Workbench" }),
  ).toHaveAttribute(
    "href",
    new RegExp(`#editing\\?manuscriptId=${prepared.manuscriptId}$`),
  );

  await page.getByLabel("Evidence Type").selectOption("artifact");
  await page
    .getByRole("button", {
      name: `Use Governed Output (${prepared.outputAssetId})`,
    })
    .click();
  await expect(page.getByLabel("Artifact Asset ID")).toHaveValue(prepared.outputAssetId);
  await page.getByLabel("Evidence Label").fill("Phase 9S governed output evidence");
  await page.getByRole("button", { name: "Complete And Finalize Run" }).click();

  const finalizedCard = page.locator(".evaluation-workbench-finalized");
  await expect(finalizedCard).toContainText("needs_review");
  await expect(finalizedCard).toContainText(
    "Run scoring is incomplete, so human review is required before any recommendation.",
  );

  const historyPanel = page.locator(".evaluation-workbench-history");
  await expect(
    historyPanel.getByRole("button", { name: "Matched Manuscript Runs (1)", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(historyPanel.locator(".evaluation-workbench-history-list")).toContainText(
    prepared.runId,
  );
  const historyDetail = historyPanel.locator(".evaluation-workbench-history-detail");
  await expect(historyDetail).toContainText("Governed Source Detail");
  await expect(historyDetail).toContainText(prepared.executionSnapshotId);
  await expect(historyDetail).toContainText(prepared.agentExecutionLogId);
  await expect(historyDetail).toContainText(prepared.outputAssetId);

  const learningPanel = page
    .locator(".evaluation-workbench-panel")
    .filter({ has: page.getByRole("heading", { name: "Learning Handoff" }) });
  await expect(learningPanel).toContainText("Learning Handoff Unavailable");
  await expect(learningPanel).toContainText(
    "Learning handoff is unavailable for governed-source runs until a reviewed snapshot is linked.",
  );
  await expect(
    learningPanel.getByRole("button", { name: "Create Learning Candidate" }),
  ).toHaveCount(0);
});

test("admin defaults history to manuscript-scoped runs after manuscript handoff and can switch back to the entire suite", async ({
  page,
  request,
}) => {
  const prepared = await prepareActiveEvaluationScenario(request, {
    label: `Phase 9P ${Date.now()}`,
  });
  const unrelatedSampleSet = await createPublishedEditingSampleSet(request, prepared.cookie, {
    label: `Phase 9P unrelated ${Date.now()}`,
    manuscriptId: "manuscript-seeded-1",
    manuscriptType: "clinical_study",
    parentAssetId: "original-seeded-1",
  });

  await page.goto("/#evaluation-workbench", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Evaluation Workbench" })).toBeVisible();
  await page.getByRole("button", { name: prepared.suiteName }).click();

  const matchedRunId = await createAndFinalizeRunFromWorkbench(page, {
    sampleSetId: prepared.sampleSetId,
    weightedScore: "94",
    diffSummary: "Matched manuscript run should stay visible in manuscript-scoped history.",
    evidenceLabel: "Phase 9P matched evidence",
    evidenceUrl: "https://example.test/evidence/phase9p-matched",
  });

  const unrelatedRunId = await createAndFinalizeRunFromWorkbench(page, {
    sampleSetId: unrelatedSampleSet.sampleSetId,
    weightedScore: "87",
    diffSummary: "Unrelated manuscript run should stay hidden until the suite scope is restored.",
    evidenceLabel: "Phase 9P unrelated evidence",
    evidenceUrl: "https://example.test/evidence/phase9p-unrelated",
  });

  await page.goto("/#evaluation-workbench?manuscriptId=manuscript-demo-1", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Evaluation Workbench" })).toBeVisible();
  await expect(page.locator(".evaluation-workbench")).toContainText(
    "Context manuscript: manuscript-demo-1",
  );
  const historyPanel = page.locator(".evaluation-workbench-history");
  const historyList = historyPanel.locator(".evaluation-workbench-history-list");

  await expect(historyPanel.getByRole("button", { name: "Matched Manuscript Runs (1)" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(historyList).toContainText(matchedRunId);
  await expect(historyList).not.toContainText(unrelatedRunId);

  await historyPanel.getByRole("button", { name: "Entire Suite History", exact: true }).click();
  await expect(historyPanel.getByRole("button", { name: "Entire Suite History", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(historyList).toContainText(matchedRunId);
  await expect(historyList).toContainText(unrelatedRunId);
});

test("admin gets a compare handoff when manuscript-scoped history only has one finalized run", async ({
  page,
  request,
}) => {
  const prepared = await prepareActiveEvaluationScenario(request, {
    label: `Phase 9Q ${Date.now()}`,
  });
  const unrelatedSampleSet = await createPublishedEditingSampleSet(request, prepared.cookie, {
    label: `Phase 9Q unrelated ${Date.now()}`,
    manuscriptId: "manuscript-seeded-1",
    manuscriptType: "clinical_study",
    parentAssetId: "original-seeded-1",
  });

  await page.goto("/#evaluation-workbench", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Evaluation Workbench" })).toBeVisible();
  await page.getByRole("button", { name: prepared.suiteName }).click();

  const unrelatedRunId = await createAndFinalizeRunFromWorkbench(page, {
    sampleSetId: unrelatedSampleSet.sampleSetId,
    weightedScore: "84",
    diffSummary: "Unrelated manuscript run becomes the broader suite comparison target.",
    evidenceLabel: "Phase 9Q unrelated evidence",
    evidenceUrl: "https://example.test/evidence/phase9q-unrelated",
  });

  const matchedRunId = await createAndFinalizeRunFromWorkbench(page, {
    sampleSetId: prepared.sampleSetId,
    weightedScore: "95",
    diffSummary: "Matched manuscript run should offer a compare handoff into suite history.",
    evidenceLabel: "Phase 9Q matched evidence",
    evidenceUrl: "https://example.test/evidence/phase9q-matched",
  });

  await page.goto("/#evaluation-workbench?manuscriptId=manuscript-demo-1", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Evaluation Workbench" })).toBeVisible();
  const historyPanel = page.locator(".evaluation-workbench-history");
  await expect(historyPanel.getByRole("button", { name: "Matched Manuscript Runs (1)", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(historyPanel).toContainText(
    "This manuscript only has one finalized run. Switch to Entire Suite History to compare it against broader suite history.",
  );
  await expect(historyPanel).toContainText(
    "Broader suite history already has 1 additional finalized run available for comparison.",
  );

  await historyPanel.getByRole("button", { name: "Compare Against Entire Suite History" }).click();
  await expect(historyPanel.getByRole("button", { name: "Entire Suite History", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(historyPanel).toContainText(`Comparing against ${unrelatedRunId}`);
  await expect(historyPanel).toContainText(
    "Operator summary: Improved over broader suite history by 11.0 weighted points while holding recommended.",
  );
  await expect(historyPanel).toContainText(
    "Baseline policy: Chronological previous finalized run within broader suite history.",
  );
  await expect(historyPanel).toContainText("Suggested action: Promote candidate");
  await expect(historyPanel).toContainText("Comparison scope: Broader suite history");
  await expect(historyPanel).toContainText("Selected origin: Current manuscript");
  await expect(historyPanel).toContainText("Previous origin: Broader suite");
  await expect(historyPanel).toContainText(
    "Current manuscript runs: 1 | Broader suite references: 1",
  );
  const historyList = historyPanel.locator(".evaluation-workbench-history-list");
  await expect(historyList).toContainText(matchedRunId);
  await expect(historyList).toContainText("Origin: Current manuscript");
  await expect(historyList).toContainText(unrelatedRunId);
  await expect(historyList).toContainText("Origin: Broader suite");
  await expect(historyList).toContainText("Selected run");
  await expect(historyList).toContainText("Compare baseline");
  await expect(historyPanel.locator(".evaluation-workbench-history-detail")).toContainText(
    "Origin: Current manuscript",
  );
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
  await expect(emptyState).toContainText(
    'Visibility summary: 0 of 2 finalized runs visible in suite-scoped history. Active controls: search "phase9l-no-matches".',
  );
  await expect(emptyState).toContainText(
    "Compare status: Current compare summary remains available for the selected run and compare baseline.",
  );
  await expect(emptyState).toContainText("Scope: Entire suite history");
  await expect(emptyState).toContainText("Filter: All finalized runs");
  await expect(emptyState).toContainText("Search: phase9l-no-matches");
  await expect(emptyState).toContainText("Sort: Newest first");
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
  await expect(hiddenNotice).toContainText(
    `Visibility summary: 1 of 2 finalized runs visible in suite-scoped history. Active controls: search "${firstRunId}". Selected run ${secondRunId} is outside the current result set.`,
  );
  await expect(hiddenNotice).toContainText(
    "Compare status: Current compare summary remains available for the selected run and compare baseline.",
  );
  await expect(hiddenNotice).toContainText("Scope: Entire suite history");
  await expect(hiddenNotice).toContainText("Filter: All finalized runs");
  await expect(hiddenNotice).toContainText(`Search: ${firstRunId}`);
  await expect(hiddenNotice).toContainText("Sort: Newest first");
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

interface PreparedGovernedSeededEvaluationScenario {
  cookie: string;
  manuscriptId: string;
  suiteId: string;
  suiteName: string;
  runId: string;
  agentExecutionLogId: string;
  executionSnapshotId: string;
  outputAssetId: string;
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
  PreparedDraftEvaluationSuite & {
    sampleSetId: string;
    sampleSetItemId: string;
    snapshotId: string;
    snapshotIds: string[];
  }
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
  const sampleSetItemsResponse = await request.get(
    `${apiBaseUrl}/api/v1/verification-ops/evaluation-sample-sets/${sampleSet.id}/items`,
    {
      headers: {
        Cookie: cookie,
      },
    },
  );
  if (!sampleSetItemsResponse.ok()) {
    throw new Error(
      `list sample set items failed (${sampleSetItemsResponse.status()}): ${await sampleSetItemsResponse.text()}`,
    );
  }
  const sampleSetItems = (await sampleSetItemsResponse.json()) as Array<{
    id: string;
    reviewed_case_snapshot_id: string;
  }>;
  if (sampleSetItems.length === 0) {
    throw new Error("prepareActiveEvaluationScenario expected at least one sample set item.");
  }
  const primarySnapshotId = snapshots[0]?.id ?? "";
  const primarySampleSetItem = sampleSetItems.find(
    (sampleSetItem) => sampleSetItem.reviewed_case_snapshot_id === primarySnapshotId,
  );
  if (!primarySampleSetItem) {
    throw new Error(
      `prepareActiveEvaluationScenario could not find a sample set item for snapshot ${primarySnapshotId}.`,
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
    sampleSetItemId: primarySampleSetItem.id,
    snapshotId: primarySnapshotId,
    snapshotIds: snapshots.map((snapshot) => snapshot.id),
  };
}

async function prepareGovernedSeededEvaluationScenario(
  request: APIRequestContext,
  input: PrepareDraftEvaluationSuiteInput,
): Promise<PreparedGovernedSeededEvaluationScenario> {
  const cookie = await loginAsDemoUser(request, "dev.admin");
  const slug = input.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const checkProfileResponse = await request.post(
    `${apiBaseUrl}/api/v1/verification-ops/check-profiles`,
    {
      headers: {
        Cookie: cookie,
      },
      data: {
        actorRole: "admin",
        input: {
          name: `${input.label} Governed Browser QA`,
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

  const releaseProfileResponse = await request.post(
    `${apiBaseUrl}/api/v1/verification-ops/release-check-profiles`,
    {
      headers: {
        Cookie: cookie,
      },
      data: {
        actorRole: "admin",
        input: {
          name: `${input.label} Governed Release Gate`,
          checkType: "deploy_verification",
          verificationCheckProfileIds: [checkProfile.id],
        },
      },
    },
  );
  if (!releaseProfileResponse.ok()) {
    throw new Error(
      `create release profile failed (${releaseProfileResponse.status()}): ${await releaseProfileResponse.text()}`,
    );
  }
  const releaseProfile = (await releaseProfileResponse.json()) as { id: string };

  const publishReleaseProfileResponse = await request.post(
    `${apiBaseUrl}/api/v1/verification-ops/release-check-profiles/${releaseProfile.id}/publish`,
    {
      headers: {
        Cookie: cookie,
      },
      data: {
        actorRole: "admin",
      },
    },
  );
  if (!publishReleaseProfileResponse.ok()) {
    throw new Error(
      `publish release profile failed (${publishReleaseProfileResponse.status()}): ${await publishReleaseProfileResponse.text()}`,
    );
  }

  const suiteName = `${input.label} Governed Evaluation Suite`;
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

  const bindingResponse = await request.post(`${apiBaseUrl}/api/v1/runtime-bindings`, {
    headers: {
      Cookie: cookie,
    },
    data: {
      actorRole: "admin",
      input: {
        module: "editing",
        manuscriptType: "clinical_study",
        templateFamilyId: "family-seeded-1",
        runtimeId: "runtime-editing-1",
        sandboxProfileId: "sandbox-editing-1",
        agentProfileId: "agent-profile-editing-1",
        toolPermissionPolicyId: "policy-editing-1",
        promptTemplateId: "prompt-editing-1",
        skillPackageIds: ["skill-editing-1"],
        executionProfileId: "profile-editing-1",
        verificationCheckProfileIds: [checkProfile.id],
        evaluationSuiteIds: [suite.id],
        releaseCheckProfileId: releaseProfile.id,
      },
    },
  });
  if (!bindingResponse.ok()) {
    throw new Error(
      `create runtime binding failed (${bindingResponse.status()}): ${await bindingResponse.text()}`,
    );
  }
  const binding = (await bindingResponse.json()) as { id: string };

  const activateBindingResponse = await request.post(
    `${apiBaseUrl}/api/v1/runtime-bindings/${binding.id}/activate`,
    {
      headers: {
        Cookie: cookie,
      },
      data: {
        actorRole: "admin",
      },
    },
  );
  if (!activateBindingResponse.ok()) {
    throw new Error(
      `activate runtime binding failed (${activateBindingResponse.status()}): ${await activateBindingResponse.text()}`,
    );
  }

  const uploadResponse = await request.post(`${apiBaseUrl}/api/v1/manuscripts/upload`, {
    headers: {
      Cookie: cookie,
    },
    data: {
      title: `${input.label} Governed Evaluation Manuscript`,
      manuscriptType: "clinical_study",
      createdBy: "ignored-by-server",
      fileName: `${slug}-source.docx`,
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      storageKey: `uploads/${slug}/${slug}-source.docx`,
    },
  });
  if (!uploadResponse.ok()) {
    throw new Error(
      `upload manuscript failed (${uploadResponse.status()}): ${await uploadResponse.text()}`,
    );
  }
  const uploaded = (await uploadResponse.json()) as {
    manuscript: { id: string };
    asset: { id: string };
  };

  const editingResponse = await request.post(`${apiBaseUrl}/api/v1/modules/editing/run`, {
    headers: {
      Cookie: cookie,
    },
    data: {
      manuscriptId: uploaded.manuscript.id,
      parentAssetId: uploaded.asset.id,
      requestedBy: "ignored-by-server",
      actorRole: "admin",
      storageKey: `runs/${uploaded.manuscript.id}/editing/${slug}-final.docx`,
      fileName: `${slug}-final.docx`,
    },
  });
  if (!editingResponse.ok()) {
    throw new Error(
      `run editing failed (${editingResponse.status()}): ${await editingResponse.text()}`,
    );
  }
  const editingRun = (await editingResponse.json()) as {
    asset: { id: string };
    agent_execution_log_id?: string;
    snapshot_id?: string;
  };
  if (!editingRun.agent_execution_log_id || !editingRun.snapshot_id) {
    throw new Error("prepareGovernedSeededEvaluationScenario expected execution trace ids.");
  }

  const runsResponse = await request.get(
    `${apiBaseUrl}/api/v1/verification-ops/evaluation-suites/${suite.id}/runs`,
    {
      headers: {
        Cookie: cookie,
      },
    },
  );
  if (!runsResponse.ok()) {
    throw new Error(
      `list evaluation runs failed (${runsResponse.status()}): ${await runsResponse.text()}`,
    );
  }
  const runs = (await runsResponse.json()) as Array<{
    id: string;
    governed_source?: {
      manuscript_id: string;
    };
  }>;
  const seededRun = runs.find(
    (run) => run.governed_source?.manuscript_id === uploaded.manuscript.id,
  );
  if (!seededRun) {
    throw new Error("prepareGovernedSeededEvaluationScenario expected a seeded evaluation run.");
  }

  return {
    cookie,
    manuscriptId: uploaded.manuscript.id,
    suiteId: suite.id,
    suiteName: suite.name,
    runId: seededRun.id,
    agentExecutionLogId: editingRun.agent_execution_log_id,
    executionSnapshotId: editingRun.snapshot_id,
    outputAssetId: editingRun.asset.id,
  };
}

async function createPublishedEditingSampleSet(
  request: APIRequestContext,
  cookie: string,
  input: {
    label: string;
    manuscriptId: string;
    manuscriptType: string;
    parentAssetId?: string;
  },
): Promise<{ sampleSetId: string; sampleSetItemId: string; snapshotId: string }> {
  const storagePrefix = input.label.toLowerCase().replace(/\s+/g, "-");
  const manuscriptId = input.manuscriptId;
  const parentAssetId = input.parentAssetId;
  if (!parentAssetId) {
    throw new Error("createPublishedEditingSampleSet requires a parent asset id.");
  }
  const draftResponse = await request.post(`${apiBaseUrl}/api/v1/modules/proofreading/draft`, {
    headers: {
      Cookie: cookie,
    },
    data: {
      manuscriptId,
      parentAssetId,
      requestedBy: "ignored-by-server",
      actorRole: "admin",
      storageKey: `runs/${manuscriptId}/proofreading/${storagePrefix}-draft.md`,
      fileName: `${storagePrefix}-draft.md`,
    },
  });
  if (!draftResponse.ok()) {
    throw new Error(
      `create proofreading draft failed (${draftResponse.status()}): ${await draftResponse.text()}`,
    );
  }
  const draft = (await draftResponse.json()) as {
    asset: { id: string };
  };
  const finalizeResponse = await request.post(`${apiBaseUrl}/api/v1/modules/proofreading/finalize`, {
    headers: {
      Cookie: cookie,
    },
    data: {
      manuscriptId,
      draftAssetId: draft.asset.id,
      requestedBy: "ignored-by-server",
      actorRole: "admin",
      storageKey: `runs/${manuscriptId}/proofreading/${storagePrefix}-final.docx`,
      fileName: `${storagePrefix}-final.docx`,
    },
  });
  if (!finalizeResponse.ok()) {
    throw new Error(
      `create proofreading final failed (${finalizeResponse.status()}): ${await finalizeResponse.text()}`,
    );
  }
  const finalized = (await finalizeResponse.json()) as {
    asset: { id: string };
  };
  const publishResponse = await request.post(
    `${apiBaseUrl}/api/v1/modules/proofreading/publish-human-final`,
    {
      headers: {
        Cookie: cookie,
      },
      data: {
        manuscriptId,
        finalAssetId: finalized.asset.id,
        requestedBy: "ignored-by-server",
        actorRole: "admin",
        storageKey: `runs/${manuscriptId}/proofreading/${storagePrefix}-human-final.docx`,
        fileName: `${storagePrefix}-human-final.docx`,
      },
    },
  );
  if (!publishResponse.ok()) {
    throw new Error(
      `publish human final failed (${publishResponse.status()}): ${await publishResponse.text()}`,
    );
  }
  const published = (await publishResponse.json()) as {
    asset: { id: string };
  };

  const snapshotResponse = await request.post(
    `${apiBaseUrl}/api/v1/learning/reviewed-case-snapshots`,
    {
      headers: {
        Cookie: cookie,
      },
      data: {
        manuscriptId,
        module: "editing",
        manuscriptType: input.manuscriptType,
        humanFinalAssetId: published.asset.id,
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
              riskTags: ["secondary-manuscript"],
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

  const sampleSetItemsResponse = await request.get(
    `${apiBaseUrl}/api/v1/verification-ops/evaluation-sample-sets/${sampleSet.id}/items`,
    {
      headers: {
        Cookie: cookie,
      },
    },
  );
  if (!sampleSetItemsResponse.ok()) {
    throw new Error(
      `list sample set items failed (${sampleSetItemsResponse.status()}): ${await sampleSetItemsResponse.text()}`,
    );
  }
  const sampleSetItems = (await sampleSetItemsResponse.json()) as Array<{
    id: string;
    reviewed_case_snapshot_id: string;
  }>;
  const primarySampleSetItem = sampleSetItems.find(
    (sampleSetItem) => sampleSetItem.reviewed_case_snapshot_id === snapshot.id,
  );
  if (!primarySampleSetItem) {
    throw new Error(
      `createPublishedEditingSampleSet could not find a sample set item for snapshot ${snapshot.id}.`,
    );
  }

  return {
    sampleSetId: sampleSet.id,
    sampleSetItemId: primarySampleSetItem.id,
    snapshotId: snapshot.id,
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
