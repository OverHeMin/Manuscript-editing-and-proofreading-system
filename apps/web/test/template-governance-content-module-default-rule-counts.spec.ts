import assert from "node:assert/strict";
import test from "node:test";
import { createTemplateGovernanceWorkbenchController } from "../src/features/template-governance/template-governance-controller.ts";

test("content module ledger includes default rule counts for each package", async () => {
  const controller = createTemplateGovernanceWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      if (input.url === "/api/v1/templates/content-modules?moduleClass=general") {
        return {
          status: 200,
          body: [
            {
              id: "general-module-1",
              module_class: "general",
              name: "参考文献格式统一",
              category: "reference",
              manuscript_type_scope: ["review"],
              execution_module_scope: ["editing"],
              summary: "统一参考文献著录顺序与标点。",
              template_usage_count: 2,
              status: "draft",
              created_at: "2026-04-13T12:00:00.000Z",
              updated_at: "2026-04-13T12:00:00.000Z",
            },
            {
              id: "general-module-2",
              module_class: "general",
              name: "标题层级统一",
              category: "heading",
              manuscript_type_scope: ["review"],
              execution_module_scope: ["editing"],
              summary: "统一标题层级与编号样式。",
              template_usage_count: 1,
              status: "draft",
              created_at: "2026-04-13T13:00:00.000Z",
              updated_at: "2026-04-13T13:00:00.000Z",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/knowledge/library") {
        return {
          status: 200,
          body: {
            query_mode: "keyword",
            items: [
              {
                asset_id: "knowledge-asset-1",
                title: "参考文献著录顺序",
                summary: "统一作者、题名、期刊名与年份顺序。",
                knowledge_kind: "rule",
                status: "approved",
                module_scope: "editing",
                manuscript_types: ["review"],
                selected_revision_id: "knowledge-revision-1",
                content_block_count: 1,
                updated_at: "2026-04-15T12:00:00.000Z",
              },
            ],
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/knowledge/assets/knowledge-asset-1?revisionId=knowledge-revision-1") {
        return {
          status: 200,
          body: {
            asset: {
              id: "knowledge-asset-1",
              status: "active",
              current_revision_id: "knowledge-revision-1",
              current_approved_revision_id: "knowledge-revision-1",
              created_at: "2026-04-15T11:00:00.000Z",
              updated_at: "2026-04-15T12:00:00.000Z",
            },
            selected_revision: {
              id: "knowledge-revision-1",
              asset_id: "knowledge-asset-1",
              revision_no: 1,
              status: "approved",
              title: "参考文献著录顺序",
              canonical_text: "作者、题名、期刊名与年份顺序应统一。",
              summary: "统一作者、题名、期刊名与年份顺序。",
              knowledge_kind: "rule",
              routing: {
                module_scope: "editing",
                manuscript_types: ["review"],
              },
              content_blocks: [],
              bindings: [
                {
                  id: "binding-1",
                  revision_id: "knowledge-revision-1",
                  binding_kind: "general_package",
                  binding_target_id: "general-module-1",
                  binding_target_label: "参考文献格式统一",
                  created_at: "2026-04-15T12:00:00.000Z",
                },
              ],
              created_at: "2026-04-15T11:00:00.000Z",
              updated_at: "2026-04-15T12:00:00.000Z",
            },
            revisions: [],
          } as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const ledger = await controller.loadContentModuleLedger({
    moduleClass: "general",
  });

  assert.equal(ledger.modules[0]?.default_rule_count, 1);
  assert.equal(ledger.modules[1]?.default_rule_count, 0);
  assert.equal(ledger.selectedModule?.default_rule_count, 1);
});
