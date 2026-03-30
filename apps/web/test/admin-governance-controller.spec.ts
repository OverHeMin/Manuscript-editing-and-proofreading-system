import test from "node:test";
import assert from "node:assert/strict";
import {
  createAdminGovernanceWorkbenchController,
} from "../src/features/admin-governance/admin-governance-controller.ts";

test("admin governance controller loads families, prompts, skills, and the selected family module templates", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createAdminGovernanceWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.url === "/api/v1/templates/families") {
        return {
          status: 200,
          body: [
            {
              id: "family-1",
              manuscript_type: "review",
              name: "Review family",
              status: "active",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/templates/families/family-1/module-templates") {
        return {
          status: 200,
          body: [
            {
              id: "template-1",
              template_family_id: "family-1",
              module: "proofreading",
              manuscript_type: "review",
              version_no: 2,
              status: "draft",
              prompt: "Create proofreading draft first.",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/prompt-skill-registry/prompt-templates") {
        return {
          status: 200,
          body: [
            {
              id: "prompt-1",
              name: "proofreading_mainline",
              version: "1.0.0",
              status: "published",
              module: "proofreading",
              manuscript_types: ["review"],
            },
          ] as TResponse,
        };
      }

      return {
        status: 200,
        body: [
          {
            id: "skill-1",
            name: "editing_skills",
            version: "1.0.0",
            scope: "admin_only",
            status: "published",
            applies_to_modules: ["editing"],
          },
        ] as TResponse,
      };
    },
  });

  const overview = await controller.loadOverview();

  assert.equal(overview.selectedTemplateFamilyId, "family-1");
  assert.equal(overview.templateFamilies.length, 1);
  assert.equal(overview.moduleTemplates.length, 1);
  assert.equal(overview.promptTemplates.length, 1);
  assert.equal(overview.skillPackages.length, 1);
  assert.deepEqual(
    requests.map((request) => request.url),
    [
      "/api/v1/templates/families",
      "/api/v1/prompt-skill-registry/prompt-templates",
      "/api/v1/prompt-skill-registry/skill-packages",
      "/api/v1/templates/families/family-1/module-templates",
    ],
  );
});

test("admin governance controller creates a family and reloads the overview around the new selection", async () => {
  const controller = createAdminGovernanceWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      if (input.method === "POST" && input.url === "/api/v1/templates/families") {
        return {
          status: 201,
          body: {
            id: "family-2",
            manuscript_type: "case_report",
            name: "Case family",
            status: "draft",
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/templates/families") {
        return {
          status: 200,
          body: [
            {
              id: "family-2",
              manuscript_type: "case_report",
              name: "Case family",
              status: "draft",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/templates/families/family-2/module-templates") {
        return {
          status: 200,
          body: [] as TResponse,
        };
      }

      return {
        status: 200,
        body: [] as TResponse,
      };
    },
  });

  const result = await controller.createTemplateFamilyAndReload({
    manuscriptType: "case_report",
    name: "Case family",
  });

  assert.equal(result.createdFamily.id, "family-2");
  assert.equal(result.overview.selectedTemplateFamilyId, "family-2");
  assert.deepEqual(result.overview.moduleTemplates, []);
});
