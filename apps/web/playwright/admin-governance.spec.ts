import { expect, test, type APIRequestContext } from "@playwright/test";

const apiBaseUrl = "http://127.0.0.1:3001";

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

  await expect(page.getByRole("heading", { name: "Admin Governance Console" })).toBeVisible();

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

test("admin can preview a governed execution bundle from the governance console", async ({
  page,
  request,
}) => {
  const prepared = await prepareExecutionPreviewScenario(request, {
    label: "Phase 8AF",
  });

  await page.goto("/#admin-console", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Admin Governance Console" })).toBeVisible();
  await expect(page.locator(".admin-governance-workbench")).toContainText(prepared.familyName);

  const executionPanel = page
    .locator("article.admin-governance-panel")
    .filter({ has: page.getByRole("heading", { name: "Execution Governance" }) });

  await executionPanel.getByLabel("Template Family").selectOption({ label: prepared.familyName });
  await executionPanel.getByLabel("Module").selectOption("editing");
  await executionPanel.getByRole("button", { name: "Preview Execution Bundle" }).click();

  await expect(page.locator(".admin-governance-status")).toContainText(
    "Resolved execution bundle preview.",
  );

  const resolutionGrid = page.locator(".admin-governance-resolution-grid");
  await expect(resolutionGrid).toContainText(prepared.profileId);
  await expect(resolutionGrid).toContainText(`openai / ${prepared.modelName}`);
  await expect(resolutionGrid).toContainText(prepared.promptName);
});

test("admin can inspect governed execution outputs from the governance console", async ({
  page,
  request,
}) => {
  const prepared = await prepareExecutionEvidenceScenario(request, {
    label: "Phase 8AG",
  });

  await page.goto("/#admin-console", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Admin Governance Console" })).toBeVisible();

  const recentExecutionsPanel = page
    .locator("article.admin-governance-panel")
    .filter({ has: page.getByRole("heading", { name: "Recent Agent Executions" }) });
  const targetExecutionRow = recentExecutionsPanel
    .locator(".admin-governance-template-row")
    .filter({ hasText: prepared.manuscriptId });

  await expect(targetExecutionRow).toContainText("editing");
  const selectionButton = targetExecutionRow.getByRole("button");
  await expect(selectionButton).toBeVisible();
  if ((await selectionButton.textContent())?.trim() === "Inspect") {
    await selectionButton.click();
  }

  const evidencePanel = page.locator(".admin-governance-evidence");
  await expect(evidencePanel).toContainText("Execution Outputs");
  await expect(evidencePanel).toContainText(prepared.manuscriptTitle);
  await expect(evidencePanel).toContainText(prepared.jobId);
  await expect(evidencePanel).toContainText(prepared.assetFileName);
  await expect(evidencePanel).toContainText(prepared.assetId);
  await expect(evidencePanel).toContainText("current");
  await expect(evidencePanel).toContainText("Verification Evidence");
  await expect(evidencePanel).toContainText(prepared.evidenceLabel);
  const downloadLink = evidencePanel.getByRole("link", {
    name: `Download ${prepared.assetFileName}`,
  });
  await expect(downloadLink).toBeVisible();
  const evidenceLink = evidencePanel.getByRole("link", {
    name: "Open evidence link",
  });
  await expect(evidenceLink).toBeVisible();
  await expect(evidenceLink).toHaveAttribute("href", prepared.evidenceUri);
  const downloadPromise = page.waitForEvent("download");
  await downloadLink.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(prepared.assetFileName);

  await evidencePanel.getByRole("link", { name: "Open Editing Workbench" }).click();
  await expect(page.getByRole("heading", { name: "Editing Workbench" })).toBeVisible();
  await expect(page.locator("body")).toContainText(prepared.manuscriptId);
});

test("admin can inspect runtime-binding verification linkage from the governance console", async ({
  page,
  request,
}) => {
  const prepared = await prepareRuntimeBindingVerificationScenario(request, {
    label: "Phase 9R",
  });

  await page.goto("/#admin-console", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Admin Governance Console" })).toBeVisible();

  const runtimeBindingsPanel = page
    .locator("article.admin-governance-panel")
    .filter({ has: page.getByRole("heading", { name: "Runtime Bindings" }) });
  const targetBindingRow = runtimeBindingsPanel
    .locator(".admin-governance-template-row")
    .filter({ hasText: prepared.checkProfileName });

  await expect(targetBindingRow).toContainText(prepared.suiteName);
  await expect(targetBindingRow).toContainText(prepared.releaseProfileName);

  const recentExecutionsPanel = page
    .locator("article.admin-governance-panel")
    .filter({ has: page.getByRole("heading", { name: "Recent Agent Executions" }) });
  const targetExecutionRow = recentExecutionsPanel
    .locator(".admin-governance-template-row")
    .filter({ hasText: prepared.manuscriptId });

  const selectionButton = targetExecutionRow.getByRole("button");
  await expect(selectionButton).toBeVisible();
  if ((await selectionButton.textContent())?.trim() === "Inspect") {
    await selectionButton.click();
  }

  const evidencePanel = page.locator(".admin-governance-evidence");
  await expect(evidencePanel).toContainText("Verification Expectations");
  await expect(evidencePanel).toContainText(prepared.checkProfileId);
  await expect(evidencePanel).toContainText(prepared.suiteId);
  await expect(evidencePanel).toContainText(prepared.releaseProfileId);
  await expect(evidencePanel).toContainText(prepared.evidenceLabel);
});

test("admin can triage recent agent executions with filters and search", async ({
  page,
  request,
}) => {
  const prepared = await prepareExecutionFilterScenario(request, {
    label: "Phase 8AH",
  });

  await page.goto("/#admin-console", {
    waitUntil: "domcontentloaded",
  });

  const recentExecutionsPanel = page
    .locator("article.admin-governance-panel")
    .filter({ has: page.getByRole("heading", { name: "Recent Agent Executions" }) });

  await expect(
    recentExecutionsPanel.getByRole("button", { name: /Running \(\d+\)/ }),
  ).toBeVisible();
  await expect(recentExecutionsPanel.getByLabel("Search executions")).toBeVisible();

  await recentExecutionsPanel.getByRole("button", { name: /Running \(\d+\)/ }).click();
  await expect(recentExecutionsPanel).toContainText(prepared.runningManuscriptId);

  await recentExecutionsPanel.getByRole("button", { name: /Completed \(\d+\)/ }).click();
  await expect(recentExecutionsPanel).toContainText(prepared.completedManuscriptId);

  await recentExecutionsPanel.getByLabel("Search executions").fill(prepared.completedManuscriptId);
  await expect(recentExecutionsPanel).toContainText(prepared.completedManuscriptId);
});

interface PrepareExecutionPreviewScenarioInput {
  label: string;
}

interface PreparedExecutionPreviewScenario {
  familyName: string;
  modelName: string;
  promptName: string;
  profileId: string;
}

interface PrepareExecutionEvidenceScenarioInput {
  label: string;
}

interface PreparedExecutionEvidenceScenario {
  manuscriptId: string;
  manuscriptTitle: string;
  jobId: string;
  assetId: string;
  assetFileName: string;
  evidenceLabel: string;
  evidenceUri: string;
}

interface PreparedRuntimeBindingVerificationScenario {
  manuscriptId: string;
  checkProfileId: string;
  checkProfileName: string;
  suiteId: string;
  suiteName: string;
  releaseProfileId: string;
  releaseProfileName: string;
  evidenceLabel: string;
}

interface PreparedExecutionFilterScenario {
  completedManuscriptId: string;
  runningManuscriptId: string;
}

async function prepareExecutionPreviewScenario(
  request: APIRequestContext,
  input: PrepareExecutionPreviewScenarioInput,
): Promise<PreparedExecutionPreviewScenario> {
  await loginAsDemoUser(request, "dev.admin");

  const familyName = `${input.label} Execution Family`;
  const promptName = `${slugify(input.label)}_editing_mainline`;
  const skillName = `${slugify(input.label)}_editing_skills`;
  const modelName = `${slugify(input.label)}-gpt-5.4`;

  const familyResponse = await request.post(`${apiBaseUrl}/api/v1/templates/families`, {
    data: {
      manuscriptType: "clinical_study",
      name: familyName,
    },
  });
  expect(familyResponse.ok()).toBeTruthy();
  const family = (await familyResponse.json()) as { id: string };

  const moduleDraftResponse = await request.post(`${apiBaseUrl}/api/v1/templates/module-drafts`, {
    data: {
      templateFamilyId: family.id,
      module: "editing",
      manuscriptType: "clinical_study",
      prompt: `${input.label} execution editing template`,
    },
  });
  expect(moduleDraftResponse.ok()).toBeTruthy();
  const moduleDraft = (await moduleDraftResponse.json()) as {
    id: string;
  };

  const publishModuleResponse = await request.post(
    `${apiBaseUrl}/api/v1/templates/module-templates/${moduleDraft.id}/publish`,
    {
      data: {
        actorRole: "admin",
      },
    },
  );
  expect(publishModuleResponse.ok()).toBeTruthy();

  const promptResponse = await request.post(
    `${apiBaseUrl}/api/v1/prompt-skill-registry/prompt-templates`,
    {
      data: {
        actorRole: "admin",
        name: promptName,
        version: "1.0.0",
        module: "editing",
        manuscriptTypes: ["clinical_study"],
      },
    },
  );
  expect(promptResponse.ok()).toBeTruthy();
  const prompt = (await promptResponse.json()) as { id: string };

  const publishPromptResponse = await request.post(
    `${apiBaseUrl}/api/v1/prompt-skill-registry/prompt-templates/${prompt.id}/publish`,
    {
      data: {
        actorRole: "admin",
      },
    },
  );
  expect(publishPromptResponse.ok()).toBeTruthy();

  const skillResponse = await request.post(
    `${apiBaseUrl}/api/v1/prompt-skill-registry/skill-packages`,
    {
      data: {
        actorRole: "admin",
        name: skillName,
        version: "1.0.0",
        appliesToModules: ["editing"],
      },
    },
  );
  expect(skillResponse.ok()).toBeTruthy();
  const skill = (await skillResponse.json()) as { id: string };

  const publishSkillResponse = await request.post(
    `${apiBaseUrl}/api/v1/prompt-skill-registry/skill-packages/${skill.id}/publish`,
    {
      data: {
        actorRole: "admin",
      },
    },
  );
  expect(publishSkillResponse.ok()).toBeTruthy();

  const modelResponse = await request.post(`${apiBaseUrl}/api/v1/model-registry`, {
    data: {
      actorRole: "admin",
      provider: "openai",
      modelName,
      allowedModules: ["editing"],
      isProdAllowed: true,
    },
  });
  expect(modelResponse.ok()).toBeTruthy();
  const model = (await modelResponse.json()) as { id: string };

  const routingPolicyResponse = await request.post(
    `${apiBaseUrl}/api/v1/model-registry/routing-policy`,
    {
      data: {
        actorRole: "admin",
        moduleDefaults: {
          editing: model.id,
        },
      },
    },
  );
  expect(routingPolicyResponse.ok()).toBeTruthy();

  const profileResponse = await request.post(
    `${apiBaseUrl}/api/v1/execution-governance/profiles`,
    {
      data: {
        actorRole: "admin",
        input: {
          module: "editing",
          manuscriptType: "clinical_study",
          templateFamilyId: family.id,
          moduleTemplateId: moduleDraft.id,
          promptTemplateId: prompt.id,
          skillPackageIds: [skill.id],
          knowledgeBindingMode: "profile_plus_dynamic",
        },
      },
    },
  );
  expect(profileResponse.ok()).toBeTruthy();
  const profile = (await profileResponse.json()) as { id: string };

  const publishProfileResponse = await request.post(
    `${apiBaseUrl}/api/v1/execution-governance/profiles/${profile.id}/publish`,
    {
      data: {
        actorRole: "admin",
      },
    },
  );
  expect(publishProfileResponse.ok()).toBeTruthy();

  return {
    familyName,
    modelName,
    promptName,
    profileId: profile.id,
  };
}

async function prepareExecutionEvidenceScenario(
  request: APIRequestContext,
  input: PrepareExecutionEvidenceScenarioInput,
): Promise<PreparedExecutionEvidenceScenario> {
  await loginAsDemoUser(request, "dev.admin");

  const slug = slugify(input.label);
  const manuscriptTitle = `${input.label} Governed Output Manuscript`;
  const sourceFileName = `${slug}-source.docx`;
  const assetFileName = `${slug}-editing-final.docx`;
  const evidenceLabel = `${input.label} browser QA`;
  const evidenceUri = `https://example.test/evidence/${slug}/browser-qa`;

  const uploadResponse = await request.post(`${apiBaseUrl}/api/v1/manuscripts/upload`, {
    data: {
      title: manuscriptTitle,
      manuscriptType: "clinical_study",
      createdBy: "ignored-by-server",
      fileName: sourceFileName,
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      storageKey: `uploads/${slug}/${sourceFileName}`,
    },
  });
  expect(uploadResponse.ok()).toBeTruthy();
  const uploaded = (await uploadResponse.json()) as {
    manuscript: { id: string };
    asset: { id: string };
  };

  const editingResponse = await request.post(`${apiBaseUrl}/api/v1/modules/editing/run`, {
    data: {
      manuscriptId: uploaded.manuscript.id,
      parentAssetId: uploaded.asset.id,
      requestedBy: "ignored-by-server",
      actorRole: "admin",
      storageKey: `runs/${uploaded.manuscript.id}/editing/${assetFileName}`,
      fileName: assetFileName,
    },
  });
  expect(editingResponse.ok()).toBeTruthy();
  const editingRun = (await editingResponse.json()) as {
    job: { id: string };
    asset: { id: string };
    agent_execution_log_id?: string;
    snapshot_id?: string;
  };
  expect(editingRun.agent_execution_log_id).toBeTruthy();
  expect(editingRun.snapshot_id).toBeTruthy();

  const evidenceResponse = await request.post(`${apiBaseUrl}/api/v1/verification-ops/evidence`, {
    data: {
      actorRole: "admin",
      input: {
        kind: "url",
        label: evidenceLabel,
        uri: evidenceUri,
      },
    },
  });
  expect(evidenceResponse.ok()).toBeTruthy();
  const evidence = (await evidenceResponse.json()) as {
    id: string;
  };

  const completeLogResponse = await request.post(
    `${apiBaseUrl}/api/v1/agent-execution/${editingRun.agent_execution_log_id}/complete`,
    {
      data: {
        executionSnapshotId: editingRun.snapshot_id,
        verificationEvidenceIds: [evidence.id],
      },
    },
  );
  expect(completeLogResponse.ok()).toBeTruthy();

  return {
    manuscriptId: uploaded.manuscript.id,
    manuscriptTitle,
    jobId: editingRun.job.id,
    assetId: editingRun.asset.id,
    assetFileName,
    evidenceLabel,
    evidenceUri,
  };
}

async function prepareRuntimeBindingVerificationScenario(
  request: APIRequestContext,
  input: PrepareExecutionEvidenceScenarioInput,
): Promise<PreparedRuntimeBindingVerificationScenario> {
  await loginAsDemoUser(request, "dev.admin");

  const slug = slugify(input.label);
  const checkProfileName = `${input.label} Browser QA`;
  const releaseProfileName = `${input.label} Release Gate`;
  const suiteName = `${input.label} Regression Suite`;
  const evidenceLabel = `${input.label} linked evidence`;
  const manuscriptTitle = `${input.label} Verification Manuscript`;

  const checkProfileResponse = await request.post(
    `${apiBaseUrl}/api/v1/verification-ops/check-profiles`,
    {
      data: {
        actorRole: "admin",
        input: {
          name: checkProfileName,
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

  const releaseProfileResponse = await request.post(
    `${apiBaseUrl}/api/v1/verification-ops/release-check-profiles`,
    {
      data: {
        actorRole: "admin",
        input: {
          name: releaseProfileName,
          checkType: "deploy_verification",
          verificationCheckProfileIds: [checkProfile.id],
        },
      },
    },
  );
  expect(releaseProfileResponse.ok()).toBeTruthy();
  const releaseProfile = (await releaseProfileResponse.json()) as { id: string };

  const publishReleaseProfileResponse = await request.post(
    `${apiBaseUrl}/api/v1/verification-ops/release-check-profiles/${releaseProfile.id}/publish`,
    {
      data: {
        actorRole: "admin",
      },
    },
  );
  expect(publishReleaseProfileResponse.ok()).toBeTruthy();

  const suiteResponse = await request.post(
    `${apiBaseUrl}/api/v1/verification-ops/evaluation-suites`,
    {
      data: {
        actorRole: "admin",
        input: {
          name: suiteName,
          suiteType: "regression",
          verificationCheckProfileIds: [checkProfile.id],
          moduleScope: ["editing"],
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

  const bindingResponse = await request.post(`${apiBaseUrl}/api/v1/runtime-bindings`, {
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
  expect(bindingResponse.ok()).toBeTruthy();
  const binding = (await bindingResponse.json()) as { id: string };

  const activateBindingResponse = await request.post(
    `${apiBaseUrl}/api/v1/runtime-bindings/${binding.id}/activate`,
    {
      data: {
        actorRole: "admin",
      },
    },
  );
  expect(activateBindingResponse.ok()).toBeTruthy();

  const uploadResponse = await request.post(`${apiBaseUrl}/api/v1/manuscripts/upload`, {
    data: {
      title: manuscriptTitle,
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
    asset: { id: string };
  };

  const editingResponse = await request.post(`${apiBaseUrl}/api/v1/modules/editing/run`, {
    data: {
      manuscriptId: uploaded.manuscript.id,
      parentAssetId: uploaded.asset.id,
      requestedBy: "ignored-by-server",
      actorRole: "admin",
      storageKey: `runs/${uploaded.manuscript.id}/editing/${slug}-final.docx`,
      fileName: `${slug}-final.docx`,
    },
  });
  expect(editingResponse.ok()).toBeTruthy();
  const editingRun = (await editingResponse.json()) as {
    agent_execution_log_id?: string;
    snapshot_id?: string;
  };
  expect(editingRun.agent_execution_log_id).toBeTruthy();
  expect(editingRun.snapshot_id).toBeTruthy();

  const evidenceResponse = await request.post(`${apiBaseUrl}/api/v1/verification-ops/evidence`, {
    data: {
      actorRole: "admin",
      input: {
        kind: "url",
        label: evidenceLabel,
        uri: `https://example.test/evidence/${slug}/linked`,
        checkProfileId: checkProfile.id,
      },
    },
  });
  expect(evidenceResponse.ok()).toBeTruthy();
  const evidence = (await evidenceResponse.json()) as { id: string };

  const completeLogResponse = await request.post(
    `${apiBaseUrl}/api/v1/agent-execution/${editingRun.agent_execution_log_id}/complete`,
    {
      data: {
        executionSnapshotId: editingRun.snapshot_id,
        verificationEvidenceIds: [evidence.id],
      },
    },
  );
  expect(completeLogResponse.ok()).toBeTruthy();

  return {
    manuscriptId: uploaded.manuscript.id,
    checkProfileId: checkProfile.id,
    checkProfileName,
    suiteId: suite.id,
    suiteName,
    releaseProfileId: releaseProfile.id,
    releaseProfileName,
    evidenceLabel,
  };
}

async function prepareExecutionFilterScenario(
  request: APIRequestContext,
  input: PrepareExecutionEvidenceScenarioInput,
): Promise<PreparedExecutionFilterScenario> {
  const completed = await prepareExecutionEvidenceScenario(request, input);
  const seedLog = await findExecutionLogByManuscriptId(request, completed.manuscriptId);
  const slug = slugify(`${input.label}-running`);

  const runningUploadResponse = await request.post(`${apiBaseUrl}/api/v1/manuscripts/upload`, {
    data: {
      title: `${input.label} Running Execution Manuscript`,
      manuscriptType: "clinical_study",
      createdBy: "ignored-by-server",
      fileName: `${slug}-source.docx`,
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      storageKey: `uploads/${slug}/${slug}-source.docx`,
    },
  });
  expect(runningUploadResponse.ok()).toBeTruthy();
  const runningUpload = (await runningUploadResponse.json()) as {
    manuscript: { id: string };
  };

  const runningLogResponse = await request.post(`${apiBaseUrl}/api/v1/agent-execution`, {
    data: {
      input: {
        manuscriptId: runningUpload.manuscript.id,
        module: "editing",
        triggeredBy: "dev.admin",
        runtimeId: seedLog.runtime_id,
        sandboxProfileId: seedLog.sandbox_profile_id,
        agentProfileId: seedLog.agent_profile_id,
        runtimeBindingId: seedLog.runtime_binding_id,
        toolPermissionPolicyId: seedLog.tool_permission_policy_id,
        knowledgeItemIds: [],
      },
    },
  });
  expect(runningLogResponse.ok()).toBeTruthy();

  return {
    completedManuscriptId: completed.manuscriptId,
    runningManuscriptId: runningUpload.manuscript.id,
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

async function findExecutionLogByManuscriptId(
  request: APIRequestContext,
  manuscriptId: string,
) {
  const response = await request.get(`${apiBaseUrl}/api/v1/agent-execution`);
  expect(response.ok()).toBeTruthy();
  const logs = (await response.json()) as Array<{
    manuscript_id: string;
    runtime_id: string;
    sandbox_profile_id: string;
    agent_profile_id: string;
    runtime_binding_id: string;
    tool_permission_policy_id: string;
  }>;
  const matchingLog = logs.find((log) => log.manuscript_id === manuscriptId);
  expect(matchingLog).toBeTruthy();
  return matchingLog!;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
