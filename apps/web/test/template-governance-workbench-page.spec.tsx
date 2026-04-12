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

function buildRulePackageWorkspaceFixture() {
  return {
    source: {
      sourceKind: "reviewed_case" as const,
      reviewedCaseSnapshotId: "reviewed-case-snapshot-demo-1",
    },
    selectedPackageId: "package-front-matter",
    candidates: [
      {
        package_id: "package-front-matter",
        package_kind: "front_matter" as const,
        title: "\u524d\u7f6e\u4fe1\u606f\u5305",
        rule_object: "front_matter",
        suggested_layer: "journal_template" as const,
        automation_posture: "guarded_auto" as const,
        status: "draft" as const,
        cards: {
          rule_what: {
            title: "\u524d\u7f6e\u4fe1\u606f\u5305",
            object: "front_matter",
            publish_layer: "journal_template" as const,
          },
          ai_understanding: {
            summary:
              "\u7edf\u4e00\u4f5c\u8005\u3001\u5355\u4f4d\u4e0e\u901a\u4fe1\u4f5c\u8005\u5757\u3002",
            hit_objects: ["author_line", "corresponding_author"],
            hit_locations: ["front_matter"],
          },
          applicability: {
            manuscript_types: ["clinical_study"],
            modules: ["editing"],
            sections: ["front_matter"],
            table_targets: [],
          },
          evidence: {
            examples: [
              {
                before: "\u7b2c\u4e00\u4f5c\u8005\uff1a\u5f20\u4e09",
                after: "\uff08\u4f5c\u8005\u7b80\u4ecb\uff09\u5f20\u4e09",
              },
            ],
          },
          exclusions: {
            not_applicable_when: ["\u539f\u7a3f\u5143\u6570\u636e\u7f3a\u5931"],
            human_review_required_when: ["\u65b0\u589e\u901a\u4fe1\u4f5c\u8005"],
            risk_posture: "guarded_auto" as const,
          },
        },
        preview: {
          hit_summary: "\u547d\u4e2d\u524d\u7f6e\u4fe1\u606f\u5757",
          hits: [
            {
              target: "author_line",
              reason: "\u4f5c\u8005\u884c\u6837\u5f0f\u53d1\u751f\u5f52\u4e00\u5316",
              matched_text: "\u5f20\u4e09 \u674e\u56db",
            },
          ],
          misses: [
            {
              target: "classification_line",
              reason: "\u6837\u672c\u6587\u672c\u4e2d\u672a\u51fa\u73b0\u5206\u7c7b\u53f7",
            },
          ],
          decision: {
            automation_posture: "guarded_auto" as const,
            needs_human_review: true,
            reason: "\u4f5c\u8005\u5143\u6570\u636e\u53d8\u66f4\u9700\u8981\u4eba\u5de5\u590d\u6838\u3002",
          },
        },
        semantic_draft: {
          semantic_summary:
            "\u7edf\u4e00\u4f5c\u8005\u3001\u5355\u4f4d\u4e0e\u901a\u4fe1\u4f5c\u8005\u5757\u3002",
          hit_scope: ["author_line:text_style_normalization"],
          applicability: ["front_matter"],
          evidence_examples: [
            {
              before: "\u7b2c\u4e00\u4f5c\u8005\uff1a\u5f20\u4e09",
              after: "\uff08\u4f5c\u8005\u7b80\u4ecb\uff09\u5f20\u4e09",
            },
          ],
          failure_boundaries: ["\u539f\u7a3f\u5143\u6570\u636e\u7f3a\u5931"],
          normalization_recipe: ["\u7edf\u4e00\u4f5c\u8005\u4e0e\u901a\u4fe1\u4f5c\u8005\u6807\u7b7e"],
          review_policy: ["\u65b0\u589e\u901a\u4fe1\u4f5c\u8005\u65f6\u4eba\u5de5\u590d\u6838"],
          confirmed_fields: ["summary", "applicability", "evidence", "boundaries"],
        },
        supporting_signals: [],
      },
    ],
  };
}

test("template governance workbench page renders the package-first rule center while keeping journal-aware governance panels", () => {
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
          message: "当前模板族还没有检索质量运行记录。",
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
      initialRulePackageWorkspace={buildRulePackageWorkspaceFixture()}
    />,
  );

  assert.match(markup, /\u89c4\u5219\u4e2d\u5fc3/u);
  assert.match(markup, /workbench-core-strip is-secondary/);
  assert.match(markup, /\u89c4\u5219\u5f55\u5165/u);
  assert.match(markup, /\u5b66\u4e60\u56de\u6d41/u);
  assert.match(markup, /\u89c4\u5219\u5305/u);
  assert.match(markup, /\u89c4\u5219\u521b\u5efa/u);
  assert.match(markup, /\u6a21\u677f\u5957\u7528/u);
  assert.match(markup, /\u6821\u5bf9\u7b56\u7565/u);
  assert.match(markup, /\u901a\u7528\u6821\u5bf9/u);
  assert.match(markup, /\u533b\u5b66\u4e13\u4e1a\u6821\u5bf9/u);
  assert.match(markup, /AI \u6307\u4ee4\u6a21\u677f/u);
  assert.match(markup, /\u77e5\u8bc6\u5e93/u);
  assert.match(markup, /\u6253\u5f00\u77e5\u8bc6\u5e93/u);
  assert.doesNotMatch(markup, /Rule Center/);
  assert.doesNotMatch(markup, /AI Instruction Template/);
  assert.match(markup, /front_matter/);
  assert.match(markup, /作者行/);
  assert.match(markup, /自动化姿态/);
  assert.match(markup, /人工复核/);
  assert.match(markup, /谨慎自动/);
  assert.match(markup, /规则集/);
  assert.match(markup, /\u6458\u8981 \u76ee\u7684/);
  assert.match(markup, /\uff08\u6458\u8981\u3000\u76ee\u7684\uff09/);
});
