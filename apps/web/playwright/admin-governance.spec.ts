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

interface PrepareExecutionPreviewScenarioInput {
  label: string;
}

interface PreparedExecutionPreviewScenario {
  familyName: string;
  modelName: string;
  promptName: string;
  profileId: string;
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
