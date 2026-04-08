import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

register(new URL("./helpers/ignore-css-loader.mjs", import.meta.url), import.meta.url);

const {
  TemplateGovernanceWorkbenchPage,
} = await import("../src/features/template-governance/template-governance-workbench-page.tsx");

const ABSTRACT_OBJECTIVE_SOURCE = "\u6458\u8981 \u76ee\u7684";
const ABSTRACT_OBJECTIVE_NORMALIZED = "\uff08\u6458\u8981\u3000\u76ee\u7684\uff09";

test("template governance workbench page renders the rule-center authoring shell and journal-aware rule authoring panels", () => {
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
        journalTemplateProfiles: [
          {
            id: "journal-alpha",
            template_family_id: "family-1",
            journal_key: "zxyjhzz",
            journal_name: "\u300a\u4e2d\u897f\u533b\u7ed3\u5408\u6742\u5fd7\u300b",
            status: "active",
          },
        ],
        selectedJournalTemplateId: "journal-alpha",
        selectedJournalTemplateProfile: {
          id: "journal-alpha",
          template_family_id: "family-1",
          journal_key: "zxyjhzz",
          journal_name: "\u300a\u4e2d\u897f\u533b\u7ed3\u5408\u6742\u5fd7\u300b",
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
            journal_template_id: "journal-alpha",
            module: "editing",
            version_no: 1,
            status: "draft",
          },
        ],
        selectedRuleSetId: "rule-set-editing-1",
        selectedRuleSet: {
          id: "rule-set-editing-1",
          template_family_id: "family-1",
          journal_template_id: "journal-alpha",
          module: "editing",
          version_no: 1,
          status: "draft",
        },
        rules: [
          {
            id: "rule-table-header",
            rule_set_id: "rule-set-editing-1",
            order_no: 5,
            rule_object: "table",
            rule_type: "format",
            execution_mode: "inspect",
            scope: {
              sections: ["results"],
              block_kind: "table",
            },
            selector: {
              semantic_target: "header_cell",
              header_path_includes: ["Treatment group", "n (%)"],
              column_key: "Treatment group > n (%)",
            },
            trigger: {
              kind: "table_shape",
              layout: "three_line_table",
            },
            action: {
              kind: "inspect_table_rule",
              caption_requirement: "\u8868\u9898\u7f6e\u4e8e\u8868\u4e0a",
              layout_requirement: "\u7981\u7528\u7ad6\u7ebf",
            },
            authoring_payload: {
              table_kind: "three_line_table",
              semantic_target: "header_cell",
              header_path_includes: ["Treatment group", "n (%)"],
              column_key: "Treatment group > n (%)",
              caption_requirement: "\u8868\u9898\u7f6e\u4e8e\u8868\u4e0a",
              layout_requirement: "\u7981\u7528\u7ad6\u7ebf",
            },
            confidence_policy: "manual_only",
            severity: "warning",
            enabled: true,
            manual_review_reason_template:
              "\u4e09\u7ebf\u8868\u9700\u4eba\u5de5\u6838\u5bf9\u6392\u7248\u4e0e\u8868\u6ce8",
          },
          {
            id: "rule-abstract-objective",
            rule_set_id: "rule-set-editing-1",
            order_no: 10,
            rule_object: "abstract",
            rule_type: "format",
            execution_mode: "apply_and_inspect",
            scope: {
              sections: ["abstract"],
              block_kind: "heading",
            },
            selector: {
              section_selector: "abstract",
              label_selector: {
                text: ABSTRACT_OBJECTIVE_SOURCE,
              },
            },
            trigger: {
              kind: "exact_text",
              text: ABSTRACT_OBJECTIVE_SOURCE,
            },
            action: {
              kind: "replace_heading",
              to: ABSTRACT_OBJECTIVE_NORMALIZED,
            },
            authoring_payload: {
              label_role: "objective",
              source_label_text: ABSTRACT_OBJECTIVE_SOURCE,
              normalized_label_text: ABSTRACT_OBJECTIVE_NORMALIZED,
            },
            confidence_policy: "always_auto",
            severity: "error",
            enabled: true,
            example_before: ABSTRACT_OBJECTIVE_SOURCE,
            example_after: ABSTRACT_OBJECTIVE_NORMALIZED,
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
            hard_rule_summary: `${ABSTRACT_OBJECTIVE_SOURCE} -> ${ABSTRACT_OBJECTIVE_NORMALIZED}`,
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
          hard_rule_summary: `${ABSTRACT_OBJECTIVE_SOURCE} -> ${ABSTRACT_OBJECTIVE_NORMALIZED}`,
          allowed_content_operations: ["sentence_rewrite"],
          forbidden_operations: ["change_medical_meaning"],
          manual_review_policy:
            "Escalate when medical meaning could change.",
          output_contract: "Return a governed editing payload.",
        },
      }}
    />,
  );

  assert.match(markup, /Rule Center/);
  assert.match(markup, /\u89c4\u5219\u4e2d\u5fc3/u);
  assert.match(markup, /workbench-core-strip is-secondary/);
  assert.match(markup, /\u89c4\u5219\u5f55\u5165\u5de5\u4f5c\u53f0/u);
  assert.match(markup, /\u89c4\u5219\u5b66\u4e60\u5de5\u4f5c\u53f0/u);
  assert.match(markup, /Rule Authoring Navigator/);
  assert.match(markup, /Rule Authoring Form/);
  assert.match(markup, /Rule Authoring Preview/);
  assert.match(markup, /Rule Ledger/);
  assert.match(markup, /Rule Explainability/);
  assert.match(markup, /Journal Template Profiles/);
  assert.match(markup, /AI Instruction Template/);
  assert.match(markup, /Knowledge authoring has moved to the standalone Knowledge Library workbench\./);
  assert.match(markup, /Open Knowledge Library/);
  assert.match(markup, /Continue In Knowledge Library/);
  assert.doesNotMatch(markup, /Create Knowledge Draft/);
  assert.doesNotMatch(markup, /Submit Draft for Review/);
  assert.match(markup, /Statement/);
  assert.match(markup, /Title/);
  assert.match(markup, /Keyword/);
  assert.match(markup, /Journal Column/);
  assert.match(markup, /Semantic Target/);
  assert.match(markup, /Header Path Includes/);
  assert.match(markup, /Expected Runtime Evidence/);
  assert.match(markup, /Treatment group/);
  assert.match(markup, /header_cell/);
  assert.match(markup, /journal-alpha/);
  assert.match(markup, /\u6458\u8981 \u76ee\u7684/);
  assert.match(markup, /\uff08\u6458\u8981\u3000\u76ee\u7684\uff09/);
});
