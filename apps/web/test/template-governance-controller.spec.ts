import assert from "node:assert/strict";
import test from "node:test";
import { BrowserHttpClientError } from "../src/lib/browser-http-client.ts";
import {
  createTemplateGovernanceWorkbenchController,
} from "../src/features/template-governance/template-governance-controller.ts";

test("template governance controller loads template families, retrieval insights, module templates, and bound knowledge items", async () => {
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

      if (input.url === "/api/v1/templates/families/family-1/retrieval-quality-runs/latest") {
        return {
          status: 200,
          body: {
            id: "retrieval-run-1",
            gold_set_version_id: "gold-version-1",
            module: "screening",
            template_family_id: "family-1",
            retrieval_snapshot_ids: ["retrieval-snapshot-1", "retrieval-snapshot-2"],
            retriever_config: {
              strategy: "template_pack",
              top_k: 3,
            },
            metric_summary: {
              answer_relevancy: 0.71,
              context_precision: 0.68,
              context_recall: 0.62,
            },
            created_by: "operator-1",
            created_at: "2026-04-04T09:00:00.000Z",
          } as TResponse,
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

      if (input.url === "/api/v1/knowledge/retrieval-snapshots/retrieval-snapshot-2") {
        return {
          status: 200,
          body: {
            id: "retrieval-snapshot-2",
            module: "screening",
            manuscript_id: "manuscript-1",
            manuscript_type: "clinical_study",
            template_family_id: "family-1",
            query_text: "Primary endpoint grounding",
            retriever_config: {
              strategy: "template_pack",
              top_k: 3,
            },
            retrieved_items: [],
            reranked_items: [],
            created_at: "2026-04-04T08:59:30.000Z",
          } as TResponse,
        };
      }

      const emptyRuleAuthoringResponse =
        createEmptyRuleAuthoringResponse<TResponse>(input.url);
      if (emptyRuleAuthoringResponse) {
        return emptyRuleAuthoringResponse;
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
  assert.equal(overview.retrievalInsights.status, "available");
  assert.equal(overview.retrievalInsights.latestRun?.id, "retrieval-run-1");
  assert.equal(
    overview.retrievalInsights.latestSnapshot?.id,
    "retrieval-snapshot-2",
  );
  assert.deepEqual(
    overview.retrievalInsights.signals.map((signal) => signal.kind),
    ["retrieval_drift", "missing_knowledge"],
  );
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "GET /api/v1/templates/families",
      "GET /api/v1/knowledge",
      "GET /api/v1/editorial-rules/rule-sets",
      "GET /api/v1/prompt-skill-registry/prompt-templates",
      "GET /api/v1/templates/families/family-1/module-templates",
      "GET /api/v1/templates/families/family-1/retrieval-quality-runs/latest",
      "GET /api/v1/knowledge/retrieval-snapshots/retrieval-snapshot-2",
    ],
  );
});

test("template governance controller clears knowledge selection when a family switch has no bound knowledge", async () => {
  const controller = createTemplateGovernanceWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
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
            {
              id: "family-2",
              manuscript_type: "review",
              name: "Review Family",
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

      if (input.url === "/api/v1/templates/families/family-1/retrieval-quality-runs/latest") {
        throw createNotFoundRetrievalError(input.url);
      }

      const emptyRuleAuthoringResponse =
        createEmptyRuleAuthoringResponse<TResponse>(input.url);
      if (emptyRuleAuthoringResponse) {
        return emptyRuleAuthoringResponse;
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const overview = await controller.loadOverview({
    selectedTemplateFamilyId: "family-2",
    selectedKnowledgeItemId: null,
  });

  assert.equal(overview.selectedTemplateFamilyId, "family-2");
  assert.equal(overview.boundKnowledgeItems.length, 0);
  assert.equal(overview.selectedKnowledgeItemId, null);
  assert.equal(overview.selectedKnowledgeItem, null);
});

test("template governance controller keeps the workbench fail-open when retrieval insights are unavailable", async () => {
  const controller = createTemplateGovernanceWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
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
          body: [] as TResponse,
        };
      }

      if (input.url === "/api/v1/knowledge") {
        return {
          status: 200,
          body: [] as TResponse,
        };
      }

      if (input.url === "/api/v1/templates/families/family-1/retrieval-quality-runs/latest") {
        throw createNotFoundRetrievalError(input.url);
      }

      const emptyRuleAuthoringResponse =
        createEmptyRuleAuthoringResponse<TResponse>(input.url);
      if (emptyRuleAuthoringResponse) {
        return emptyRuleAuthoringResponse;
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const overview = await controller.loadOverview();

  assert.equal(overview.templateFamilies.length, 1);
  assert.equal(overview.selectedTemplateFamilyId, "family-1");
  assert.equal(overview.moduleTemplates.length, 0);
  assert.equal(overview.retrievalInsights.status, "not_started");
  assert.equal(overview.retrievalInsights.latestRun, null);
  assert.equal(overview.retrievalInsights.latestSnapshot, null);
  assert.equal(overview.retrievalInsights.signals.length, 0);
});

test("template governance controller loads rule authoring and instruction authoring assets for the selected family", async () => {
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

      if (input.url === "/api/v1/knowledge") {
        return {
          status: 200,
          body: [] as TResponse,
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
              manuscript_type: "clinical_study",
              version_no: 1,
              status: "published",
              prompt: "Edit clinical study manuscripts.",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/templates/families/family-1/retrieval-quality-runs/latest") {
        throw createNotFoundRetrievalError(input.url);
      }

      if (input.url === "/api/v1/editorial-rules/rule-sets") {
        return {
          status: 200,
          body: [
            {
              id: "rule-set-editing-1",
              template_family_id: "family-1",
              module: "editing",
              version_no: 1,
              status: "draft",
            },
            {
              id: "rule-set-proofreading-1",
              template_family_id: "family-2",
              module: "proofreading",
              version_no: 1,
              status: "draft",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/editorial-rules/rule-sets/rule-set-editing-1/rules") {
        return {
          status: 200,
          body: [
            {
              id: "rule-abstract-objective",
              rule_set_id: "rule-set-editing-1",
              order_no: 10,
              rule_type: "format",
              execution_mode: "apply_and_inspect",
              scope: {
                sections: ["abstract"],
                block_kind: "heading",
              },
              trigger: {
                kind: "exact_text",
                text: "摘要 目的",
              },
              action: {
                kind: "replace_heading",
                to: "（摘要　目的）",
              },
              confidence_policy: "always_auto",
              severity: "error",
              enabled: true,
              example_before: "摘要 目的",
              example_after: "（摘要　目的）",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/prompt-skill-registry/prompt-templates") {
        return {
          status: 200,
          body: [
            {
              id: "instruction-editing-1",
              name: "editing_instruction_mainline",
              version: "1.0.0",
              status: "published",
              module: "editing",
              manuscript_types: ["clinical_study"],
              template_kind: "editing_instruction",
              system_instructions:
                "Apply approved editorial rules before any content rewrite.",
              task_frame:
                "Normalize exact clinical-study formatting and keep meaning stable.",
              hard_rule_summary: "摘要 目的 -> （摘要　目的）",
              allowed_content_operations: ["sentence_rewrite"],
              forbidden_operations: ["change_medical_meaning"],
              manual_review_policy:
                "Escalate when medical meaning could change.",
              output_contract: "Return a governed editing payload.",
            },
            {
              id: "instruction-proofreading-1",
              name: "proofreading_instruction_mainline",
              version: "1.0.0",
              status: "published",
              module: "proofreading",
              manuscript_types: ["clinical_study"],
              template_kind: "proofreading_instruction",
              system_instructions:
                "Inspect the manuscript against the same published rule source.",
              task_frame: "Report findings without rewriting the manuscript.",
              hard_rule_summary: "摘要 目的 -> （摘要　目的）",
              allowed_content_operations: ["issue_explanation"],
              forbidden_operations: ["rewrite_manuscript"],
              manual_review_policy: "Escalate ambiguous checks to manual review.",
              output_contract: "Return structured proofreading findings.",
              report_style: "clinical_report",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/templates/families/family-2/retrieval-quality-runs/latest") {
        throw createNotFoundRetrievalError(input.url);
      }

      const emptyRuleAuthoringResponse =
        createEmptyRuleAuthoringResponse<TResponse>(input.url);
      if (emptyRuleAuthoringResponse) {
        return emptyRuleAuthoringResponse;
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const overview = await controller.loadOverview({
    selectedTemplateFamilyId: "family-1",
  });

  assert.equal((overview as { ruleSets: Array<unknown> }).ruleSets.length, 1);
  assert.equal(
    (
      overview as {
        selectedRuleSet: {
          module: string;
        } | null;
      }
    ).selectedRuleSet?.module,
    "editing",
  );
  assert.equal(
    (overview as { instructionTemplates: Array<unknown> }).instructionTemplates.length,
    2,
  );
  assert.equal(
    (
      overview as {
        rules: Array<{
          example_before?: string;
          example_after?: string;
        }>;
      }
    ).rules[0]?.example_before,
    "摘要 目的",
  );
  assert.equal(
    (
      overview as {
        rules: Array<{
          example_before?: string;
          example_after?: string;
        }>;
      }
    ).rules[0]?.example_after,
    "（摘要　目的）",
  );
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "GET /api/v1/templates/families",
      "GET /api/v1/knowledge",
      "GET /api/v1/editorial-rules/rule-sets",
      "GET /api/v1/prompt-skill-registry/prompt-templates",
      "GET /api/v1/templates/families/family-1/module-templates",
      "GET /api/v1/editorial-rules/rule-sets/rule-set-editing-1/rules",
      "GET /api/v1/templates/families/family-1/retrieval-quality-runs/latest",
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

      if (input.url === "/api/v1/templates/module-templates/template-editing-1/draft") {
        return {
          status: 200,
          body: {
            id: "template-editing-1",
            template_family_id: "family-1",
            module: "editing",
            manuscript_type: "review",
            version_no: 1,
            status: "draft",
            prompt: "Edit review manuscripts with evidence-aware language.",
            checklist: ["Terminology", "Evidence"],
            section_requirements: ["results", "discussion"],
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

      if (input.url === "/api/v1/templates/families/family-1/retrieval-quality-runs/latest") {
        throw createNotFoundRetrievalError(input.url);
      }

      const emptyRuleAuthoringResponse =
        createEmptyRuleAuthoringResponse<TResponse>(input.url);
      if (emptyRuleAuthoringResponse) {
        return emptyRuleAuthoringResponse;
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
  const updatedTemplate = await controller.updateModuleTemplateDraftAndReload({
    moduleTemplateId: "template-editing-1",
    input: {
      prompt: "Edit review manuscripts with evidence-aware language.",
      checklist: ["Terminology", "Evidence"],
      sectionRequirements: ["results", "discussion"],
    },
    selectedTemplateFamilyId: "family-1",
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
  assert.equal(updatedTemplate.moduleTemplate.prompt, "Edit review manuscripts with evidence-aware language.");
  assert.equal(
    requests.some(
      (request) =>
        request.method === "POST" &&
        request.url === "/api/v1/templates/module-templates/template-editing-1/draft",
    ),
    true,
  );
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

test("template governance controller updates a template family and keeps it selected after reload", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createTemplateGovernanceWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.url === "/api/v1/templates/families/family-1" && input.method === "POST") {
        return {
          status: 200,
          body: {
            id: "family-1",
            manuscript_type: "review",
            name: "Review Family Active",
            status: "active",
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/templates/families") {
        return {
          status: 200,
          body: [
            {
              id: "family-1",
              manuscript_type: "review",
              name: "Review Family Active",
              status: "active",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/templates/families/family-1/module-templates") {
        return {
          status: 200,
          body: [] as TResponse,
        };
      }

      if (input.url === "/api/v1/knowledge") {
        return {
          status: 200,
          body: [] as TResponse,
        };
      }

      if (input.url === "/api/v1/templates/families/family-1/retrieval-quality-runs/latest") {
        throw createNotFoundRetrievalError(input.url);
      }

      const emptyRuleAuthoringResponse =
        createEmptyRuleAuthoringResponse<TResponse>(input.url);
      if (emptyRuleAuthoringResponse) {
        return emptyRuleAuthoringResponse;
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const result = await controller.updateTemplateFamilyAndReload({
    templateFamilyId: "family-1",
    input: {
      name: "Review Family Active",
      status: "active",
    },
    selectedTemplateFamilyId: "family-1",
  });

  assert.equal(result.templateFamily.name, "Review Family Active");
  assert.equal(result.overview.selectedTemplateFamilyId, "family-1");
  assert.equal(
    requests.some(
      (request) =>
        request.method === "POST" &&
        request.url === "/api/v1/templates/families/family-1",
    ),
    true,
  );
});

function createEmptyRuleAuthoringResponse<TResponse>(url: string) {
  if (
    url === "/api/v1/editorial-rules/rule-sets" ||
    url === "/api/v1/prompt-skill-registry/prompt-templates"
  ) {
    return {
      status: 200,
      body: [] as TResponse,
    };
  }

  return null;
}

function createNotFoundRetrievalError(url: string) {
  return new BrowserHttpClientError({
    method: "GET",
    requestUrl: url,
    status: 404,
    responseBody: {
      error: "not_found",
    },
  });
}
