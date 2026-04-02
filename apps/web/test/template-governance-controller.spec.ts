import assert from "node:assert/strict";
import test from "node:test";
import {
  createTemplateGovernanceWorkbenchController,
} from "../src/features/template-governance/template-governance-controller.ts";

test("template governance controller loads template families, module templates, and bound knowledge items", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createTemplateGovernanceWorkbenchController({
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
              manuscript_type: "clinical_study",
              name: "Clinical Study Family",
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
              id: "template-screening-1",
              template_family_id: "family-1",
              module: "screening",
              manuscript_type: "clinical_study",
              version_no: 1,
              status: "published",
              prompt: "Screen clinical study manuscripts.",
              checklist: ["Primary endpoint"],
              section_requirements: ["methods"],
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/knowledge") {
        return {
          status: 200,
          body: [
            {
              id: "knowledge-1",
              title: "Primary endpoint rule",
              canonical_text: "Clinical studies must declare a primary endpoint.",
              knowledge_kind: "rule",
              status: "approved",
              routing: {
                module_scope: "screening",
                manuscript_types: ["clinical_study"],
              },
              template_bindings: ["template-screening-1"],
            },
            {
              id: "knowledge-2",
              title: "General reference",
              canonical_text: "Use consistent medical terminology.",
              knowledge_kind: "reference",
              status: "draft",
              routing: {
                module_scope: "editing",
                manuscript_types: "any",
              },
              template_bindings: [],
            },
          ] as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const overview = await controller.loadOverview();

  assert.equal(overview.templateFamilies.length, 1);
  assert.equal(overview.selectedTemplateFamilyId, "family-1");
  assert.equal(overview.moduleTemplates.length, 1);
  assert.equal(overview.knowledgeItems.length, 2);
  assert.equal(overview.boundKnowledgeItems.length, 1);
  assert.equal(overview.boundKnowledgeItems[0]?.id, "knowledge-1");
  assert.equal(overview.selectedKnowledgeItem?.id, "knowledge-1");
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "GET /api/v1/templates/families",
      "GET /api/v1/knowledge",
      "GET /api/v1/templates/families/family-1/module-templates",
    ],
  );
});

test("template governance controller can create, update, submit, and publish governed assets", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createTemplateGovernanceWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.url === "/api/v1/templates/families") {
        if (input.method === "POST") {
          return {
            status: 201,
            body: {
              id: "family-1",
              manuscript_type: "review",
              name: "Review Family",
              status: "draft",
            } as TResponse,
          };
        }

        return {
          status: 200,
          body: [
            {
              id: "family-1",
              manuscript_type: "review",
              name: "Review Family",
              status: "draft",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/templates/families/family-1/module-templates") {
        return {
          status: 200,
          body: [
            {
              id: "template-editing-1",
              template_family_id: "family-1",
              module: "editing",
              manuscript_type: "review",
              version_no: 1,
              status: "draft",
              prompt: "Edit review manuscripts.",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/templates/module-drafts") {
        return {
          status: 201,
          body: {
            id: "template-editing-1",
            template_family_id: "family-1",
            module: "editing",
            manuscript_type: "review",
            version_no: 1,
            status: "draft",
            prompt: "Edit review manuscripts.",
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/templates/module-templates/template-editing-1/publish") {
        return {
          status: 200,
          body: {
            id: "template-editing-1",
            template_family_id: "family-1",
            module: "editing",
            manuscript_type: "review",
            version_no: 1,
            status: "published",
            prompt: "Edit review manuscripts.",
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/knowledge/drafts") {
        return {
          status: 201,
          body: {
            id: "knowledge-1",
            title: "Terminology draft",
            canonical_text: "Use standard terminology.",
            knowledge_kind: "reference",
            status: "draft",
            routing: {
              module_scope: "editing",
              manuscript_types: ["review"],
            },
            template_bindings: ["template-editing-1"],
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/knowledge/knowledge-1/draft") {
        return {
          status: 200,
          body: {
            id: "knowledge-1",
            title: "Terminology draft updated",
            canonical_text: "Use standard medical terminology.",
            knowledge_kind: "reference",
            status: "draft",
            routing: {
              module_scope: "editing",
              manuscript_types: ["review"],
            },
            template_bindings: ["template-editing-1"],
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/knowledge/knowledge-1/submit") {
        return {
          status: 200,
          body: {
            id: "knowledge-1",
            title: "Terminology draft updated",
            canonical_text: "Use standard medical terminology.",
            knowledge_kind: "reference",
            status: "pending_review",
            routing: {
              module_scope: "editing",
              manuscript_types: ["review"],
            },
            template_bindings: ["template-editing-1"],
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/knowledge") {
        return {
          status: 200,
          body: [
            {
              id: "knowledge-1",
              title: "Terminology draft updated",
              canonical_text: "Use standard medical terminology.",
              knowledge_kind: "reference",
              status: "pending_review",
              routing: {
                module_scope: "editing",
                manuscript_types: ["review"],
              },
              template_bindings: ["template-editing-1"],
            },
          ] as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  await controller.createTemplateFamilyAndReload({
    manuscriptType: "review",
    name: "Review Family",
  });
  await controller.createModuleTemplateDraftAndReload({
    templateFamilyId: "family-1",
    module: "editing",
    manuscriptType: "review",
    prompt: "Edit review manuscripts.",
  });
  const knowledgeResult = await controller.createKnowledgeDraftAndReload({
    title: "Terminology draft",
    canonicalText: "Use standard terminology.",
    knowledgeKind: "reference",
    moduleScope: "editing",
    manuscriptTypes: ["review"],
    templateBindings: ["template-editing-1"],
  });
  await controller.updateKnowledgeDraftAndReload({
    knowledgeItemId: "knowledge-1",
    input: {
      title: "Terminology draft updated",
      canonicalText: "Use standard medical terminology.",
      templateBindings: ["template-editing-1"],
    },
    selectedTemplateFamilyId: "family-1",
  });
  await controller.submitKnowledgeDraftAndReload({
    knowledgeItemId: "knowledge-1",
    selectedTemplateFamilyId: "family-1",
  });
  await controller.publishModuleTemplateAndReload({
    moduleTemplateId: "template-editing-1",
    actorRole: "admin",
    selectedTemplateFamilyId: "family-1",
  });

  assert.equal(knowledgeResult.knowledgeItem.id, "knowledge-1");
  assert.equal(
    requests.some(
      (request) =>
        request.method === "POST" &&
        request.url === "/api/v1/knowledge/knowledge-1/submit",
    ),
    true,
  );
  assert.equal(
    requests.some(
      (request) =>
        request.method === "POST" &&
        request.url === "/api/v1/templates/module-templates/template-editing-1/publish",
    ),
    true,
  );
});
