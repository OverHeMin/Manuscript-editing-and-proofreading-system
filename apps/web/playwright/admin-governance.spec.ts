import { expect, test, type APIRequestContext } from "@playwright/test";

const apiBaseUrl =
  process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:3001";
const seededFamilyId = "family-seeded-1";
const seededFamilyName = "Seeded Clinical Study Family";
const abstractObjectiveSource = "\u6458\u8981 \u76ee\u7684";
const abstractObjectiveNormalized = "\uff08\u6458\u8981\u3000\u76ee\u7684\uff09";
const journalObjectiveNormalized = "\uff08\u6458\u8981\u3000\u76ee\u7684\uff09\uff1a";

test("admin can create a template family and module draft from the governance console", async ({
  page,
  request,
}) => {
  await loginAsDemoUser(request, "dev.admin");

  const familyName = `Phase 8AE family ${Date.now()}`;
  const draftPrompt = `${familyName} proofreading prompt`;

  await page.goto("/#admin-console", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Harness Control Plane" })).toBeVisible();

  const createFamilyPanel = page
    .locator("article.admin-governance-panel")
    .filter({ has: page.getByRole("heading", { name: "Create Template Family" }) });
  await createFamilyPanel.getByLabel("Manuscript Type").selectOption("clinical_study");
  await createFamilyPanel.getByLabel("Family Name").fill(familyName);
  await createFamilyPanel.getByRole("button", { name: "Create Family" }).click();

  await expect(page.locator(".admin-governance-status")).toContainText(
    `Created template family: ${familyName}`,
  );

  const familiesPanel = page
    .locator("article.admin-governance-panel")
    .filter({ has: page.getByRole("heading", { name: "Template Families" }) });
  await expect(familiesPanel).toContainText(familyName);
  await familiesPanel.getByRole("button", { name: new RegExp(familyName) }).click();

  const moduleDraftPanel = page
    .locator("article.admin-governance-panel")
    .filter({ has: page.getByRole("heading", { name: "Module Template Drafts" }) });
  await moduleDraftPanel.getByLabel("Module").selectOption("proofreading");
  await moduleDraftPanel.getByLabel("Prompt").fill(draftPrompt);
  await moduleDraftPanel.getByRole("button", { name: "Create Module Draft" }).click();

  await expect(page.locator(".admin-governance-status")).toContainText(
    /Created module template draft v\d+\./,
  );
  await expect(moduleDraftPanel).toContainText(draftPrompt);
  await expect(moduleDraftPanel).toContainText("draft");
});

test("admin can preview, verify, activate, and roll back the seeded harness environment from the control plane", async ({
  page,
  request,
}) => {
  await loginAsDemoUser(request, "dev.admin");
  const harnessRouting = await ensureHarnessRoutingPolicy(request);
  const suiteId = await prepareHarnessEditingSuite(request, {
    label: `Harness editing suite ${Date.now()}`,
  });

  await page.goto("/#admin-console", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Harness Control Plane" })).toBeVisible();

  const statusMessage = page.locator(".admin-governance-status");
  const environmentEditor = page
    .locator("article.admin-governance-panel")
    .filter({ has: page.getByRole("heading", { name: "Environment Editor" }) });
  const qualityLab = page
    .locator("article.admin-governance-panel")
    .filter({ has: page.getByRole("heading", { name: "Quality Lab" }) });
  const activationGate = page
    .locator("article.admin-governance-panel")
    .filter({ has: page.getByRole("heading", { name: "Activation Gate" }) });

  const activeEnvironmentCard = environmentEditor.locator(".admin-governance-asset-row").nth(0);
  const candidatePreviewCard = environmentEditor.locator(".admin-governance-asset-row").nth(1);
  const diffCard = environmentEditor.locator(".admin-governance-asset-row").nth(2);

  await expect(environmentEditor).toContainText("Tune the real governed environment");
  await expect(qualityLab).toContainText("Launch a candidate-bound verification run");
  await expect(activationGate).toContainText("Promotion and rollback stay here");
  await expect(
    environmentEditor.getByLabel("Routing Version").locator("option"),
  ).toContainText([harnessRouting.activeVersionId, harnessRouting.candidateVersionId]);
  await expect(
    environmentEditor.getByLabel("Retrieval Preset").locator("option"),
  ).toContainText(["retrieval-editing-1", "retrieval-editing-preview-2"]);
  await expect(
    environmentEditor.getByLabel("Manual Review Policy").locator("option"),
  ).toContainText(["manual-review-editing-1", "manual-review-editing-preview-2"]);
  await expect(
    environmentEditor.getByRole("button", { name: "Preview Candidate Environment" }),
  ).toBeEnabled();
  await expect(activeEnvironmentCard).toContainText("Execution Profile profile-editing-1");
  await expect(activeEnvironmentCard).toContainText("Runtime Binding binding-editing-1");
  await expect(activeEnvironmentCard).toContainText(`Routing ${harnessRouting.activeVersionId}`);
  await expect(activeEnvironmentCard).toContainText("Retrieval retrieval-editing-1");
  await expect(activeEnvironmentCard).toContainText("Manual Review manual-review-editing-1");

  await environmentEditor
    .getByLabel("Routing Version")
    .selectOption(harnessRouting.candidateVersionId);
  await environmentEditor.getByLabel("Retrieval Preset").selectOption(
    "retrieval-editing-preview-2",
  );
  await environmentEditor.getByLabel("Manual Review Policy").selectOption(
    "manual-review-editing-preview-2",
  );
  await environmentEditor
    .getByRole("button", { name: "Preview Candidate Environment" })
    .click();

  await expect(statusMessage).toContainText("Previewed harness candidate environment.");
  await expect(candidatePreviewCard).toContainText(
    "Execution Profile profile-editing-1",
  );
  await expect(candidatePreviewCard).toContainText(
    "Runtime Binding binding-editing-1",
  );
  await expect(candidatePreviewCard).toContainText(
    `Routing ${harnessRouting.candidateVersionId}`,
  );
  await expect(candidatePreviewCard).toContainText(
    "Retrieval retrieval-editing-preview-2",
  );
  await expect(candidatePreviewCard).toContainText(
    "Manual Review manual-review-editing-preview-2",
  );
  await expect(diffCard).toContainText("model_routing_policy_version");
  await expect(diffCard).toContainText("retrieval_preset");
  await expect(diffCard).toContainText("manual_review_policy");

  await qualityLab.getByLabel("Evaluation Suite").selectOption(suiteId);
  await qualityLab.getByRole("button", { name: "Launch Candidate Run" }).click();

  await expect(statusMessage).toContainText(/Launched candidate harness run .*?\./);
  await expect(qualityLab).toContainText("Latest Candidate Run");
  await expect(qualityLab).toContainText("queued");

  await activationGate
    .getByLabel("Operator Reason")
    .fill("Promote the preview editing environment after harness verification.");
  await activationGate
    .getByRole("button", { name: "Activate Candidate Environment" })
    .click();

  await expect(statusMessage).toContainText("Activated the candidate harness environment.");
  await expect(activeEnvironmentCard).toContainText(
    "Execution Profile profile-editing-1",
  );
  await expect(activeEnvironmentCard).toContainText(
    "Runtime Binding binding-editing-1",
  );
  await expect(activeEnvironmentCard).toContainText(
    `Routing ${harnessRouting.candidateVersionId}`,
  );
  await expect(activeEnvironmentCard).toContainText(
    "Retrieval retrieval-editing-preview-2",
  );
  await expect(activeEnvironmentCard).toContainText(
    "Manual Review manual-review-editing-preview-2",
  );
  await expect(candidatePreviewCard).toContainText(
    "Choose governed objects and preview the candidate bundle.",
  );

  await activationGate.getByRole("button", { name: "Roll Back Scope" }).click();

  await expect(statusMessage).toContainText(
    "Rolled the scope back to the previous harness environment.",
  );
  await expect(activeEnvironmentCard).toContainText("Execution Profile profile-editing-1");
  await expect(activeEnvironmentCard).toContainText("Runtime Binding binding-editing-1");
  await expect(activeEnvironmentCard).toContainText(`Routing ${harnessRouting.activeVersionId}`);
  await expect(activeEnvironmentCard).toContainText("Retrieval retrieval-editing-1");
  await expect(activeEnvironmentCard).toContainText("Manual Review manual-review-editing-1");
});

async function ensureHarnessRoutingPolicy(
  request: APIRequestContext,
) : Promise<{
  activeVersionId: string;
  candidateVersionId: string;
}> {
  const alternateModelResponse = await request.post(`${apiBaseUrl}/api/v1/model-registry`, {
    data: {
      actorRole: "admin",
      provider: "openai",
      modelName: `harness-editing-preview-${Date.now()}`,
      modelVersion: "2026-04-11",
      allowedModules: ["editing"],
      isProdAllowed: true,
    },
  });
  expect(alternateModelResponse.ok()).toBeTruthy();
  const alternateModel = (await alternateModelResponse.json()) as { id: string };

  const createPolicyResponse = await request.post(
    `${apiBaseUrl}/api/v1/model-routing-governance/policies`,
    {
      data: {
        actorRole: "admin",
        input: {
          scopeKind: "template_family",
          scopeValue: seededFamilyId,
          primaryModelId: "model-editing-1",
          fallbackModelIds: [],
          evidenceLinks: [
            {
              kind: "evaluation_run",
              id: `harness-routing-evidence-${Date.now()}`,
            },
          ],
          notes: "Enable the Harness control-plane smoke route for the seeded editing family.",
        },
      },
    },
  );
  expect(createPolicyResponse.ok()).toBeTruthy();
  const createdPolicy = (await createPolicyResponse.json()) as {
    policy_id: string;
    version: { id: string };
  };

  const submitResponse = await request.post(
    `${apiBaseUrl}/api/v1/model-routing-governance/versions/${createdPolicy.version.id}/submit`,
    {
      data: {
        actorRole: "admin",
        reason: "Submit the seeded Harness routing draft.",
      },
    },
  );
  expect(submitResponse.ok()).toBeTruthy();

  const approveResponse = await request.post(
    `${apiBaseUrl}/api/v1/model-routing-governance/versions/${createdPolicy.version.id}/approve`,
    {
      data: {
        actorRole: "admin",
        reason: "Approve the seeded Harness routing draft.",
      },
    },
  );
  expect(approveResponse.ok()).toBeTruthy();

  const activateResponse = await request.post(
    `${apiBaseUrl}/api/v1/model-routing-governance/versions/${createdPolicy.version.id}/activate`,
    {
      data: {
        actorRole: "admin",
        reason: "Activate the seeded Harness routing version.",
      },
    },
  );
  expect(activateResponse.ok()).toBeTruthy();

  const createDraftVersionResponse = await request.post(
    `${apiBaseUrl}/api/v1/model-routing-governance/policies/${createdPolicy.policy_id}/versions`,
    {
      data: {
        actorRole: "admin",
        input: {
          primaryModelId: alternateModel.id,
          fallbackModelIds: [],
          evidenceLinks: [
            {
              kind: "evaluation_run",
              id: `harness-routing-preview-${Date.now()}`,
            },
          ],
          notes: "Prepare a candidate routing version for the Harness control-plane smoke flow.",
        },
      },
    },
  );
  expect(createDraftVersionResponse.ok()).toBeTruthy();
  const candidateDraft = (await createDraftVersionResponse.json()) as {
    version: { id: string };
  };

  const submitCandidateResponse = await request.post(
    `${apiBaseUrl}/api/v1/model-routing-governance/versions/${candidateDraft.version.id}/submit`,
    {
      data: {
        actorRole: "admin",
        reason: "Submit the Harness candidate routing version.",
      },
    },
  );
  expect(submitCandidateResponse.ok()).toBeTruthy();

  const approveCandidateResponse = await request.post(
    `${apiBaseUrl}/api/v1/model-routing-governance/versions/${candidateDraft.version.id}/approve`,
    {
      data: {
        actorRole: "admin",
        reason: "Approve the Harness candidate routing version.",
      },
    },
  );
  expect(approveCandidateResponse.ok()).toBeTruthy();

  return {
    activeVersionId: createdPolicy.version.id,
    candidateVersionId: candidateDraft.version.id,
  };
}

async function prepareHarnessEditingSuite(
  request: APIRequestContext,
  input: {
    label: string;
  },
): Promise<string> {
  const checkProfileResponse = await request.post(
    `${apiBaseUrl}/api/v1/verification-ops/check-profiles`,
    {
      data: {
        actorRole: "admin",
        input: {
          name: `${input.label} Browser QA`,
          checkType: "browser_qa",
        },
      },
    },
  );
  expect(checkProfileResponse.ok()).toBeTruthy();
  const checkProfile = (await checkProfileResponse.json()) as { id: string };

  const publishCheckProfileResponse = await request.post(
    `${apiBaseUrl}/api/v1/verification-ops/check-profiles/${checkProfile.id}/publish`,
    {
      data: {
        actorRole: "admin",
      },
    },
  );
  expect(publishCheckProfileResponse.ok()).toBeTruthy();

  const suiteResponse = await request.post(
    `${apiBaseUrl}/api/v1/verification-ops/evaluation-suites`,
    {
      data: {
        actorRole: "admin",
        input: {
          name: `${input.label} Regression`,
          suiteType: "regression",
          verificationCheckProfileIds: [checkProfile.id],
          moduleScope: ["editing"],
          requiresProductionBaseline: true,
          supportsAbComparison: true,
          hardGatePolicy: {
            mustUseDeidentifiedSamples: true,
            requiresParsableOutput: true,
          },
          scoreWeights: {
            structure: 25,
            terminology: 20,
            knowledgeCoverage: 20,
            riskDetection: 20,
            humanEditBurden: 10,
            costAndLatency: 5,
          },
        },
      },
    },
  );
  expect(suiteResponse.ok()).toBeTruthy();
  const suite = (await suiteResponse.json()) as { id: string };

  const activateSuiteResponse = await request.post(
    `${apiBaseUrl}/api/v1/verification-ops/evaluation-suites/${suite.id}/activate`,
    {
      data: {
        actorRole: "admin",
      },
    },
  );
  expect(activateSuiteResponse.ok()).toBeTruthy();

  return suite.id;
}

test("template governance supports journal-scoped abstract and table rule authoring", async ({
  page,
  request,
}) => {
  await loginAsDemoUser(request, "dev.admin");

  const familyName = `Case Report Rules ${Date.now()}`;
  const journalName = `\u300a\u6848\u4f8b\u62a5\u9053\u6d4f\u89c8 ${Date.now()}\u300b`;
  const journalKey = slugify(`case-report-journal-${Date.now()}`);

  await page.goto("/#template-governance", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "规则中心" })).toBeVisible();

  await page.getByRole("combobox", { name: "Manuscript Type", exact: true }).selectOption(
    "case_report",
  );
  await page.getByRole("textbox", { name: "Family Name", exact: true }).fill(familyName);
  await page.getByRole("button", { name: "Create Family Draft" }).click();

  await expect(page.locator(".template-governance-status")).toContainText(
    "Template family created.",
  );
  const createdFamilyButton = page.getByRole("button", { name: new RegExp(familyName) });
  await expect(createdFamilyButton).toBeVisible();
  await createdFamilyButton.click();
  await page.getByRole("button", { name: "Open Advanced Rule Editor" }).click();
  await expect(page.getByRole("heading", { name: "Rule Authoring Navigator" })).toBeVisible();

  await page.getByRole("textbox", { name: "Journal Name" }).fill(journalName);
  await page.getByRole("textbox", { name: "Journal Key" }).fill(journalKey);
  await page.getByRole("button", { name: "Create Journal Template" }).click();

  await expect(page.locator(".template-governance-status")).toContainText(
    "Journal template profile created.",
  );

  const journalCard = page
    .getByRole("button", { name: "Activate" })
    .locator("xpath=ancestor::article[contains(@class,'template-governance-card')]")
    .first();
  await expect(journalCard).toContainText(journalName);
  await expect(journalCard).toContainText("draft");
  await journalCard.getByRole("button", { name: "Activate" }).click();

  await expect(page.locator(".template-governance-status")).toContainText(
    "Journal template profile activated.",
  );
  await expect(page.getByText(`${journalKey} | active`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Selected Scope" })).toBeVisible();

  const navigatorCard = page
    .getByRole("heading", { name: "Rule Authoring Navigator" })
    .locator("xpath=ancestor::article[contains(@class,'template-governance-card')]")
    .first();
  const previewPanel = page
    .getByRole("heading", { name: "Rule Authoring Preview" })
    .locator("xpath=ancestor::article[contains(@class,'template-governance-card')]")
    .first();

  await navigatorCard.getByRole("combobox", { name: "Module" }).selectOption("editing");
  await navigatorCard.getByRole("button", { name: "Create Rule Set Draft" }).click();

  await expect(page.locator(".template-governance-status")).toContainText(
    "Rule set draft created.",
  );
  await expect(previewPanel).toContainText("Journal override:");
  await expect(previewPanel).toContainText(
    `${abstractObjectiveSource} -> ${abstractObjectiveNormalized}`,
  );

  await page.getByRole("button", { name: "Create Rule Draft" }).click();

  await expect(page.locator(".template-governance-status")).toContainText("Rule draft created.");
  await expect(page.locator(".template-governance-rule-layout-main")).toContainText(
    `${abstractObjectiveSource} -> ${abstractObjectiveNormalized}`,
  );

  await page.getByRole("button", { name: "Table" }).click();
  await page.getByLabel("Semantic Target").selectOption("header_cell");
  await page.getByLabel("Header Path Includes").fill("Treatment group > n (%)");
  await page.getByLabel("Column Key").fill("Treatment group > n (%)");
  await expect(previewPanel).toContainText("Inspect only");
  await expect(previewPanel).toContainText("semantic_target=header_cell");
  await expect(previewPanel).toContainText("header_path=Treatment group > n (%)");
  await expect(previewPanel).toContainText("table_id=runtime-resolved");
  await expect(previewPanel).toContainText("Journal override");
  await page.getByRole("button", { name: "Create Rule Draft" }).click();

  await expect(page.locator(".template-governance-status")).toContainText("Rule draft created.");
  await expect(page.locator(".template-governance-rule-layout-main")).toContainText(
    "header_cell",
  );
  await expect(page.locator(".template-governance-rule-layout-main")).toContainText(
    "Treatment group",
  );
  await expect(page.locator(".template-governance-rule-layout-main")).toContainText(
    "n (%)",
  );
  await expect(page.locator(".template-governance-rule-layout-main")).toContainText(
    "\u7981\u7528\u7ad6\u7ebf",
  );
});

test("editing workbench saves a journal template context before running editing", async ({
  page,
  request,
}) => {
  const prepared = await prepareEditingWorkbenchJournalScenario(request, {
    label: `workbench-${Date.now()}`,
  });

  await page.goto(`/#editing?manuscriptId=${prepared.manuscriptId}`, {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "编辑工作台" })).toBeVisible();
  await expect(page.locator("body")).toContainText(prepared.manuscriptId);
  await expect(page.locator("body")).toContainText("基础模板家族");
  await expect(page.locator("body")).toContainText(seededFamilyName);

  const journalPanel = page
    .locator(".manuscript-workbench-panel")
    .filter({ has: page.getByRole("heading", { name: "期刊模板" }) });
  const journalSelect = journalPanel.getByLabel("期刊模板");

  await expect(journalSelect).toBeVisible();
  await journalSelect.selectOption({ label: prepared.journalName });
  await journalPanel.getByRole("button", { name: "保存模板上下文" }).click();

  await expect(page.locator("body")).toContainText(
    `Updated template context for ${prepared.manuscriptId}`,
  );
  await expect(page.locator("body")).toContainText(prepared.journalName);
  await expect(page.locator("body")).toContainText("期刊覆写");
  await expect(page.locator("body")).toContainText("Active");

  const parentAssetSelect = page.getByLabel("父资产");
  await expect(parentAssetSelect).toBeVisible();
  await expect(parentAssetSelect).not.toHaveValue("");

  const manuscriptResponse = await request.get(
    `${apiBaseUrl}/api/v1/manuscripts/${prepared.manuscriptId}`,
  );
  expect(manuscriptResponse.ok()).toBeTruthy();
  const manuscript = (await manuscriptResponse.json()) as {
    current_journal_template_id?: string;
  };
  expect(manuscript.current_journal_template_id).toBe(prepared.journalTemplateId);

  await page.getByRole("button", { name: "执行编辑" }).click();

  await expect(page.locator("body")).toContainText("Created asset");
  await expect(page.locator("body")).toContainText(prepared.journalName);
});

async function prepareEditingWorkbenchJournalScenario(
  request: APIRequestContext,
  input: {
    label: string;
  },
): Promise<{
  manuscriptId: string;
  journalTemplateId: string;
  journalName: string;
}> {
  await loginAsDemoUser(request, "dev.admin");

  const slug = slugify(input.label);
  const journalName = `${input.label} Journal Overlay`;
  const journalKey = `${slug}-journal`;

  const journalTemplateResponse = await request.post(
    `${apiBaseUrl}/api/v1/templates/journal-templates`,
    {
      data: {
        templateFamilyId: seededFamilyId,
        manuscriptType: "clinical_study",
        journalKey,
        journalName,
      },
    },
  );
  expect(journalTemplateResponse.ok()).toBeTruthy();
  const journalTemplate = (await journalTemplateResponse.json()) as { id: string };

  const activateJournalResponse = await request.post(
    `${apiBaseUrl}/api/v1/templates/journal-templates/${journalTemplate.id}/activate`,
    {
      data: {
        actorRole: "admin",
      },
    },
  );
  expect(activateJournalResponse.ok()).toBeTruthy();

  const ruleSetResponse = await request.post(`${apiBaseUrl}/api/v1/editorial-rules/rule-sets`, {
    data: {
      actorRole: "admin",
      templateFamilyId: seededFamilyId,
      journalTemplateId: journalTemplate.id,
      module: "editing",
    },
  });
  expect(ruleSetResponse.ok()).toBeTruthy();
  const ruleSet = (await ruleSetResponse.json()) as { id: string };

  const ruleResponse = await request.post(
    `${apiBaseUrl}/api/v1/editorial-rules/rule-sets/${ruleSet.id}/rules`,
    {
      data: {
        actorRole: "admin",
        orderNo: 10,
        ruleObject: "abstract",
        ruleType: "format",
        executionMode: "apply_and_inspect",
        scope: {
          sections: ["abstract"],
          block_kind: "heading",
        },
        selector: {
          section_selector: "abstract",
          label_selector: {
            text: abstractObjectiveSource,
          },
        },
        trigger: {
          kind: "exact_text",
          text: abstractObjectiveSource,
        },
        action: {
          kind: "replace_heading",
          to: journalObjectiveNormalized,
        },
        authoringPayload: {
          label_role: "objective",
          source_label_text: abstractObjectiveSource,
          normalized_label_text: journalObjectiveNormalized,
        },
        evidenceLevel: "high",
        confidencePolicy: "always_auto",
        severity: "error",
        enabled: true,
        exampleBefore: abstractObjectiveSource,
        exampleAfter: journalObjectiveNormalized,
      },
    },
  );
  expect(ruleResponse.ok()).toBeTruthy();

  const publishRuleSetResponse = await request.post(
    `${apiBaseUrl}/api/v1/editorial-rules/rule-sets/${ruleSet.id}/publish`,
    {
      data: {
        actorRole: "admin",
      },
    },
  );
  expect(publishRuleSetResponse.ok()).toBeTruthy();

  const uploadResponse = await request.post(`${apiBaseUrl}/api/v1/manuscripts/upload`, {
    data: {
      title: `${input.label} clinical manuscript`,
      manuscriptType: "clinical_study",
      createdBy: "ignored-by-server",
      fileName: `${slug}-source.docx`,
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      storageKey: `uploads/${slug}/${slug}-source.docx`,
    },
  });
  expect(uploadResponse.ok()).toBeTruthy();
  const uploaded = (await uploadResponse.json()) as {
    manuscript: { id: string };
  };

  return {
    manuscriptId: uploaded.manuscript.id,
    journalTemplateId: journalTemplate.id,
    journalName,
  };
}

async function loginAsDemoUser(
  request: APIRequestContext,
  username: string,
) {
  const response = await request.post(`${apiBaseUrl}/api/v1/auth/local/login`, {
    data: {
      username,
      password: "demo-password",
    },
  });
  expect(response.ok()).toBeTruthy();
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
