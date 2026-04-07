import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  TemplateGovernanceWorkbenchPage,
} from "../src/features/template-governance/template-governance-workbench-page.tsx";

test("template governance workbench page renders rule and AI instruction authoring panels", () => {
  const Page = TemplateGovernanceWorkbenchPage as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    <Page
      controller={{
        loadOverview: async () => {
          throw new Error("not used");
        },
      }}
      initialOverview={{
        templateFamilies: [
          {
            id: "family-1",
            manuscript_type: "clinical_study",
            name: "Clinical Study Family",
            status: "active",
          },
        ],
        selectedTemplateFamilyId: "family-1",
        selectedTemplateFamily: {
          id: "family-1",
          manuscript_type: "clinical_study",
          name: "Clinical Study Family",
          status: "active",
        },
        moduleTemplates: [
          {
            id: "template-editing-1",
            template_family_id: "family-1",
            module: "editing",
            manuscript_type: "clinical_study",
            version_no: 1,
            status: "published",
            prompt: "Edit clinical study manuscripts.",
          },
        ],
        retrievalInsights: {
          status: "not_started",
          latestRun: null,
          latestSnapshot: null,
          signals: [],
          message: "No retrieval-quality run has been recorded for this template family yet.",
        },
        knowledgeItems: [],
        visibleKnowledgeItems: [],
        boundKnowledgeItems: [],
        selectedKnowledgeItemId: null,
        selectedKnowledgeItem: null,
        filters: {
          searchText: "",
          knowledgeStatus: "all",
        },
        ruleSets: [
          {
            id: "rule-set-editing-1",
            template_family_id: "family-1",
            module: "editing",
            version_no: 1,
            status: "draft",
          },
        ],
        selectedRuleSetId: "rule-set-editing-1",
        selectedRuleSet: {
          id: "rule-set-editing-1",
          template_family_id: "family-1",
          module: "editing",
          version_no: 1,
          status: "draft",
        },
        rules: [
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
        ],
        instructionTemplates: [
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
        ],
        selectedInstructionTemplateId: "instruction-editing-1",
        selectedInstructionTemplate: {
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
      }}
    />,
  );

  assert.match(markup, /Rules/);
  assert.match(markup, /AI Instruction Template/);
  assert.match(markup, /Example Before/);
  assert.match(markup, /Example After/);
  assert.match(markup, /摘要 目的/);
  assert.match(markup, /（摘要　目的）/);
});
