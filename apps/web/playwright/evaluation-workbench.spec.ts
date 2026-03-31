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
