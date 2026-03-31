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

  await page.getByLabel("Evidence Label").fill("Phase 9C browser QA");
  await page
    .getByLabel("Evidence URL")
    .fill("https://example.test/evidence/phase9c-browser-qa");
  await page.getByRole("button", { name: "Complete And Finalize Run" }).click();
  await expect(page.locator(".evaluation-workbench-finalized")).toContainText(
    "recommended",
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

interface PrepareDraftEvaluationSuiteInput {
  label: string;
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
): Promise<PreparedDraftEvaluationSuite & { sampleSetId: string }> {
  const cookie = await loginAsDemoUser(request, "dev.admin");

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
              reviewedCaseSnapshotId: "reviewed-case-snapshot-demo-1",
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
