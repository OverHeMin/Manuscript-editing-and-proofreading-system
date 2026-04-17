import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

register(new URL("./helpers/ignore-css-loader.mjs", import.meta.url), import.meta.url);

const templateGovernanceWorkbenchModule = await import(
  "../src/features/template-governance/template-governance-workbench-page.tsx"
);
const {
  TemplateGovernanceProofreadingStrategyPane,
} = await import(
  "../src/features/template-governance/template-governance-proofreading-strategy-pane.tsx"
);
const {
  TemplateGovernanceWorkbenchPage,
  createKnowledgeDraftFormState,
  createKnowledgeDraftInput,
  createRuleWizardEntryFormStateFromRuleLedgerRow,
  resolveRuleLedgerCategoryAfterWizardCompletion,
  toKnowledgeDraftFormState,
} = templateGovernanceWorkbenchModule;

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
          signals: [
            {
              kind: "retrieval_drift",
              title: "\u53ec\u56de\u8d28\u91cf\u4e0b\u6ed1",
              body: "\u8fd1\u671f\u53ec\u56de\u7ed3\u679c\u4e0e\u6807\u6ce8\u96c6\u5dee\u5f02\u6269\u5927\u3002",
              evidence: {
                retrieval_run_id: "run-1",
                retrieval_snapshot_id: "snapshot-1",
              },
            },
            {
              kind: "missing_knowledge",
              title: "\u8868\u683c\u4f9d\u636e\u7f3a\u53e3",
              body: "\u8868\u6ce8\u4e0e\u7edf\u8ba1\u6ce8\u91ca\u7f3a\u5c11\u6210\u5957\u77e5\u8bc6\u4f9d\u636e\u3002",
              evidence: {
                retrieval_run_id: "run-2",
                retrieval_snapshot_id: "snapshot-2",
              },
            },
          ],
          message: "当前模板族还没有检索质量运行记录。",
        },
        knowledgeItems: [],
        visibleKnowledgeItems: [
          {
            id: "knowledge-table-proofreading-1",
            title: "表格校对依据",
            canonical_text: "核查表题、单位、表注与统计注释是否完整。",
            summary: "面向校对的表格核查依据",
            knowledge_kind: "reference",
            status: "approved",
            routing: {
              module_scope: "proofreading",
              manuscript_types: ["clinical_study"],
              sections: ["tables"],
              risk_tags: ["table-proofreading"],
              discipline_tags: ["cardiology"],
            },
            evidence_level: "high",
            source_type: "guideline",
            source_link: "https://example.test/table-guideline",
            aliases: ["表格核查", "表格校对"],
            template_bindings: ["template-editing-1"],
          },
        ],
        boundKnowledgeItems: [
          {
            id: "knowledge-table-proofreading-1",
            title: "表格校对依据",
            canonical_text: "核查表题、单位、表注与统计注释是否完整。",
            summary: "面向校对的表格核查依据",
            knowledge_kind: "reference",
            status: "approved",
            routing: {
              module_scope: "proofreading",
              manuscript_types: ["clinical_study"],
              sections: ["tables"],
              risk_tags: ["table-proofreading"],
              discipline_tags: ["cardiology"],
            },
            evidence_level: "high",
            source_type: "guideline",
            source_link: "https://example.test/table-guideline",
            aliases: ["表格核查", "表格校对"],
            template_bindings: ["template-editing-1"],
          },
        ],
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
  assert.match(markup, /\u56de\u6d41\u5de5\u4f5c\u533a/u);
  assert.match(markup, /\u89c4\u5219\u5305/u);
  assert.match(markup, /\u89c4\u5219\u521b\u5efa/u);
  assert.match(markup, /\u6a21\u677f\u5957\u7528/u);
  assert.match(markup, /\u6821\u5bf9\u7b56\u7565/u);
  assert.match(markup, /\u901a\u7528\u6821\u5bf9/u);
  assert.match(markup, /\u533b\u5b66\u4e13\u4e1a\u6821\u5bf9/u);
  assert.match(markup, /\u8868\u683c\u6821\u5bf9\u4e13\u9879/u);
  assert.match(markup, /\u8868\u683c\u4e13\u9879\u77e5\u8bc6\u6a21\u677f/u);
  assert.match(markup, /\u547d\u4e2d\u9a8c\u8bc1\u5173\u6ce8\u70b9/u);
  assert.match(markup, /data-table-proofreading-knowledge-templates="field"/u);
  assert.match(markup, /data-table-proofreading-hit-validation="field"/u);
  assert.match(markup, /\u89c4\u5219\u4e2d\u5fc3\u5b58\u68c0\u67e5\u52a8\u4f5c\uff0c\u77e5\u8bc6\u5e93\u5b58\u4f9d\u636e\u4e0e\u793a\u4f8b/u);
  assert.match(markup, /\u5f53\u524d\u5df2\u8986\u76d6 1 \u6761\u8868\u683c\u89c4\u5219\u4e0e 1 \u6761\u8868\u683c\u77e5\u8bc6/u);
  assert.match(markup, /\u671f\u520a\u8868\u683c\u6837\u5f0f\u4f9d\u636e/u);
  assert.match(markup, /\u7edf\u8ba1\u6ce8\u91ca\u4e0e\u7b26\u53f7\u4f9d\u636e/u);
  assert.match(markup, /\u5355\u4f4d\u4e0e\u6570\u503c\u62a5\u544a\u4f9d\u636e/u);
  assert.match(markup, /\u8868\u683c\u5f02\u5e38\u793a\u4f8b\u5e93/u);
  assert.match(markup, /data-prefill-knowledge-template="journal_table_style_basis"/u);
  assert.match(markup, /data-prefill-knowledge-template="statistical_annotation_basis"/u);
  assert.match(markup, /data-prefill-knowledge-template="unit_reporting_basis"/u);
  assert.match(markup, /data-prefill-knowledge-template="table_exception_examples"/u);
  assert.match(markup, /knowledgePrefillTemplateId=journal_table_style_basis/u);
  assert.match(markup, /knowledgePrefillTemplateId=statistical_annotation_basis/u);
  assert.match(markup, /knowledgePrefillTemplateId=unit_reporting_basis/u);
  assert.match(markup, /knowledgePrefillTemplateId=table_exception_examples/u);
  assert.match(markup, /\u68c0\u7d22\u5148\u547d\u4e2d\u8868\u9898\u3001\u8868\u6ce8\u3001\u5355\u4f4d\u6216\u7edf\u8ba1\u5173\u952e\u8bcd/u);
  assert.match(markup, /\u89c4\u5219\u547d\u4e2d\u540e\u9700\u80fd\u89e3\u91ca\u662f\u54ea\u4e2a\u8868\u683c\u5757\u3001\u54ea\u6761\u8868\u5934\u6216\u811a\u6ce8\u89e6\u53d1/u);
  assert.match(markup, /\u672a\u547d\u4e2d\u8868\u683c\u5757\u4f46\u89e6\u53d1\u8868\u683c\u89c4\u5219\u65f6\u8f6c\u4eba\u5de5\u590d\u6838/u);
  assert.match(markup, /\u8868\u9898\u7f6e\u4e8e\u8868\u4e0a/u);
  assert.match(markup, /\u8868\u6ce8\u7f6e\u4e8e\u8868\u4e0b/u);
  assert.match(markup, /\u4e09\u7ebf\u8868\u4e0e\u7981\u7528\u7ad6\u7ebf/u);
  assert.match(markup, /AI \u6307\u4ee4\u6a21\u677f/u);
  assert.match(markup, /\u77e5\u8bc6\u5e93/u);
  assert.match(markup, /\u6253\u5f00\u77e5\u8bc6\u5e93/u);
  assert.match(markup, /\u68c0\u7d22\u6f02\u79fb/u);
  assert.match(markup, /\u7f3a\u5c11\u77e5\u8bc6\u4f9d\u636e/u);
  assert.match(markup, /\u5141\u8bb8\u6539\u5199\u53e5\u5f0f/u);
  assert.match(markup, /\u7981\u6b62\u6539\u53d8\u533b\u5b66\u542b\u4e49/u);
  assert.doesNotMatch(markup, /Rule Center/);
  assert.doesNotMatch(markup, /AI Instruction Template/);
  assert.doesNotMatch(markup, /retrieval_drift/);
  assert.doesNotMatch(markup, /missing_knowledge/);
  assert.doesNotMatch(markup, /sentence_rewrite/);
  assert.doesNotMatch(markup, /change_medical_meaning/);
  assert.match(markup, /front_matter/);
  assert.match(markup, /作者行/);
  assert.match(markup, /自动化姿态/);
  assert.match(markup, /人工复核/);
  assert.match(markup, /谨慎自动/);
  assert.match(markup, /规则集/);
  assert.match(markup, /\u6458\u8981 \u76ee\u7684/);
  assert.match(markup, /\uff08\u6458\u8981\u3000\u76ee\u7684\uff09/);
});

test("table proofreading guidance defines reusable knowledge templates and hit-validation checks", async () => {
  const {
    listTableProofreadingHitValidationChecks,
    listTableProofreadingKnowledgeTemplates,
  } = await import(
    "../src/features/template-governance/template-governance-table-proofreading-guidance.ts"
  );

  const templates = listTableProofreadingKnowledgeTemplates();
  const checks = listTableProofreadingHitValidationChecks();

  assert.deepEqual(
    templates.map((template) => template.id),
    [
      "journal_table_style_basis",
      "statistical_annotation_basis",
      "unit_reporting_basis",
      "table_exception_examples",
    ],
  );
  assert.equal(templates.every((template) => template.moduleScope === "proofreading"), true);
  assert.equal(templates.every((template) => template.sections.includes("tables")), true);
  assert.deepEqual(
    checks.map((check) => check.id),
    [
      "retrieval_keyword_hit",
      "rule_scope_explainability",
      "manual_review_gate",
    ],
  );
});

test("table proofreading guidance cards use Chinese metadata labels instead of raw code values", () => {
  const Pane = TemplateGovernanceProofreadingStrategyPane as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    <Pane
      proofreadingRuleSetCount={1}
      proofreadingTemplateCount={1}
      proofreadingInstructionCount={1}
      tableRuleCount={1}
      tableKnowledgeCount={1}
    />,
  );

  assert.match(markup, /参考资料/u);
  assert.match(markup, /指南\/规范/u);
  assert.match(markup, /高证据/u);
  assert.match(markup, /内部案例/u);
  assert.match(markup, /专家经验/u);
  assert.doesNotMatch(markup, /reference/u);
  assert.doesNotMatch(markup, /guideline/u);
  assert.doesNotMatch(markup, /expert_opinion/u);
});

test("template governance overview keeps rule ledger as the daily-driver entry", () => {
  const Page = TemplateGovernanceWorkbenchPage as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    <Page
      controller={{
        loadOverview: async () => {
          throw new Error("not used");
        },
        loadExtractionLedger: async () => ({
          summary: {
            awaitingConfirmationCount: 6,
          },
        }),
      }}
      initialView="overview"
      initialOverview={{
        templateFamilies: [],
        selectedTemplateFamilyId: null,
        selectedTemplateFamily: null,
        journalTemplateProfiles: [],
        selectedJournalTemplateId: null,
        selectedJournalTemplateProfile: null,
        moduleTemplates: [],
        retrievalInsights: null,
        knowledgeItems: [],
        visibleKnowledgeItems: [],
        boundKnowledgeItems: [],
        selectedKnowledgeItemId: null,
        selectedKnowledgeItem: null,
        filters: {
          searchText: "",
          knowledgeStatus: "all",
        },
        ruleSets: [],
        selectedRuleSetId: null,
        selectedRuleSet: null,
        rules: [],
        instructionTemplates: [],
        selectedInstructionTemplateId: null,
        selectedInstructionTemplate: null,
      }}
    />,
  );

  assert.match(markup, /\u89c4\u5219\u53f0\u8d26/u);
  assert.match(markup, /\u65b0\u5efa\u89c4\u5219/u);
  assert.match(markup, /\u8fdb\u5165\u89c4\u5219\u53f0\u8d26/u);
  assert.match(markup, /\u67e5\u770b\u5f85\u5ba1\u6838/u);
});

test("template governance workbench page opens the shared rule wizard when authoring is requested directly", () => {
  const Page = TemplateGovernanceWorkbenchPage as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    <Page
      controller={{
        loadRuleLedger: async () => ({
          category: "all",
          rows: [],
        }),
      }}
      initialView="authoring"
    />,
  );

  assert.match(markup, /\u89c4\u5219\u8349\u7a3f\u5411\u5bfc/u);
  assert.match(markup, /\u57fa\u7840\u5f55\u5165\u4e0e\u8bc1\u636e\u8865\u5145/u);
  assert.match(markup, /\u4e0b\u4e00\u6b65\uff1a\u6574\u7406\u8349\u7a3f/u);
});

test("template governance hidden knowledge draft seed defaults to reference", () => {
  assert.equal(typeof createKnowledgeDraftFormState, "function");
  assert.equal(createKnowledgeDraftFormState?.().knowledgeKind, "reference");
});

test("template governance hidden knowledge draft seed keeps structured routing defaults", () => {
  assert.deepEqual(
    createKnowledgeDraftFormState({
      manuscriptType: "clinical_study",
      templateBindings: ["template-editing-1", "template-proofreading-1"],
    }),
    {
      title: "",
      canonicalText: "",
      summary: "",
      knowledgeKind: "reference",
      moduleScope: "any",
      manuscriptTypes: ["clinical_study"],
      templateBindings: ["template-editing-1", "template-proofreading-1"],
      aliases: [],
      sections: [],
      riskTags: [],
      disciplineTags: [],
      evidenceLevel: "unknown",
      sourceType: "other",
      sourceLink: "",
    },
  );
});

test("template governance knowledge draft payload keeps structured arrays instead of comma text", () => {
  assert.deepEqual(
    createKnowledgeDraftInput({
      title: "表格校对依据",
      canonicalText: "核查表题、单位与表注。",
      summary: "面向校对的表格核查依据",
      knowledgeKind: "reference",
      moduleScope: "proofreading",
      manuscriptTypes: ["clinical_study", "review"],
      templateBindings: ["template-proofreading-1"],
      aliases: ["表格核查", "表格校对"],
      sections: ["results", "tables"],
      riskTags: ["table", "layout"],
      disciplineTags: ["cardiology"],
      evidenceLevel: "high",
      sourceType: "guideline",
      sourceLink: "https://example.com/table-guideline",
    }),
    {
      title: "表格校对依据",
      canonicalText: "核查表题、单位与表注。",
      summary: "面向校对的表格核查依据",
      knowledgeKind: "reference",
      moduleScope: "proofreading",
      manuscriptTypes: ["clinical_study", "review"],
      sections: ["results", "tables"],
      riskTags: ["table", "layout"],
      disciplineTags: ["cardiology"],
      evidenceLevel: "high",
      sourceType: "guideline",
      sourceLink: "https://example.com/table-guideline",
      aliases: ["表格核查", "表格校对"],
      templateBindings: ["template-proofreading-1"],
    },
  );
});

test("template governance knowledge draft hydration restores structured arrays", () => {
  assert.deepEqual(
    toKnowledgeDraftFormState({
      title: "表格校对依据",
      canonical_text: "核查表题、单位与表注。",
      summary: "面向校对的表格核查依据",
      knowledge_kind: "reference",
      routing: {
        module_scope: "proofreading",
        manuscript_types: ["clinical_study", "review"],
        sections: ["results", "tables"],
        risk_tags: ["table", "layout"],
        discipline_tags: ["cardiology"],
      },
      aliases: ["表格核查", "表格校对"],
      template_bindings: ["template-proofreading-1"],
      evidence_level: "high",
      source_type: "guideline",
      source_link: "https://example.com/table-guideline",
    }),
    {
      title: "表格校对依据",
      canonicalText: "核查表题、单位与表注。",
      summary: "面向校对的表格核查依据",
      knowledgeKind: "reference",
      moduleScope: "proofreading",
      manuscriptTypes: ["clinical_study", "review"],
      templateBindings: ["template-proofreading-1"],
      aliases: ["表格核查", "表格校对"],
      sections: ["results", "tables"],
      riskTags: ["table", "layout"],
      disciplineTags: ["cardiology"],
      evidenceLevel: "high",
      sourceType: "guideline",
      sourceLink: "https://example.com/table-guideline",
    },
  );
});

test("template governance workbench page renders the unified rule ledger when rule-ledger is the selected view", () => {
  const Page = TemplateGovernanceWorkbenchPage as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    <Page
      controller={{
        loadRuleLedger: async () => ({
          category: "all",
          rows: [
            {
              id: "rule-1",
              asset_kind: "rule",
              title: "统一术语规则",
              module_label: "编辑",
              manuscript_type_label: "论著",
              semantic_status: "待确认",
              publish_status: "草稿",
              contributor_label: "editor.zh",
              updated_at: "2026-04-14T09:00:00.000Z",
            },
          ],
        }),
      }}
      initialView="rule-ledger"
    />,
  );

  assert.match(markup, /\u89c4\u5219\u53f0\u8d26/u);
  assert.match(markup, /\u5168\u90e8\u8d44\u4ea7/u);
  assert.match(markup, /\u56de\u6d41\u5019\u9009/u);
  assert.doesNotMatch(markup, /\u89c4\u5219\u5f55\u5165/u);
});

test("template governance workbench page folds learning candidates into the rule ledger handoff", () => {
  const Page = TemplateGovernanceWorkbenchPage as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    <Page
      controller={{
        loadRuleLedger: async () => ({
          category: "recycled_candidate",
          rows: [],
        }),
      }}
      initialMode="learning"
      initialLearningCandidates={[
        {
          id: "candidate-rule-1",
          type: "rule_candidate",
          status: "pending_review",
          module: "editing",
          manuscript_type: "clinical_study",
          governed_provenance_kind: "reviewed_case_snapshot",
          snapshot_asset_id: "snapshot-asset-1",
          title: "Abstract heading normalization",
          proposal_text:
            "Normalize abstract objective headings to the governed journal style.",
          candidate_payload: {
            extraction_kind: "reviewed_fragment_diff",
            before_fragment: ABSTRACT_OBJECTIVE_SOURCE,
            after_fragment: ABSTRACT_OBJECTIVE_NORMALIZED,
            evidence_summary: "Human-reviewed abstract heading normalization.",
          },
          suggested_rule_object: "abstract",
          suggested_template_family_id: "family-1",
          suggested_journal_template_id: "journal-alpha",
          created_by: "editor-1",
          created_at: "2026-04-08T08:00:00.000Z",
          updated_at: "2026-04-08T08:05:00.000Z",
        },
      ]}
      initialSelectedLearningCandidateId="candidate-rule-1"
    />,
  );

  assert.match(markup, /\u89c4\u5219\u4e2d\u5fc3 · \u8f6c\u89c4\u5219\u7ad9/u);
  assert.match(markup, /\u56de\u6d41\u5019\u9009\u8f6c\u89c4\u5219/u);
  assert.match(markup, /\u56de\u6d41\u5019\u9009/u);
  assert.match(markup, /Abstract heading normalization/);
  assert.match(markup, /\u8f6c\u6210\u89c4\u5219\u8349\u7a3f/u);
  assert.doesNotMatch(markup, /RulePackageAuthoringShell/);
});

test("recycled candidate ledger rows keep the evidence needed to prefill the shared rule wizard", () => {
  const entryForm = createRuleWizardEntryFormStateFromRuleLedgerRow({
    id: "candidate-rule-1",
    asset_kind: "recycled_candidate",
    title: "Abstract heading normalization",
    module_label: "\u7f16\u8f91",
    manuscript_type_label: "\u4e34\u5e8a\u7814\u7a76",
    semantic_status: "\u56de\u6d41\u5f85\u6536\u7f16",
    publish_status: "\u5f85\u5ba1\u6838",
    contributor_label: "editor-1",
    learning_candidate: {
      id: "candidate-rule-1",
      type: "rule_candidate",
      status: "pending_review",
      module: "editing",
      manuscript_type: "clinical_study",
      governed_provenance_kind: "reviewed_case_snapshot",
      snapshot_asset_id: "snapshot-asset-1",
      title: "Abstract heading normalization",
      proposal_text:
        "Normalize abstract objective headings to the governed journal style.",
      candidate_payload: {
        extraction_kind: "reviewed_fragment_diff",
        before_fragment: ABSTRACT_OBJECTIVE_SOURCE,
        after_fragment: ABSTRACT_OBJECTIVE_NORMALIZED,
        evidence_summary: "Human-reviewed abstract heading normalization.",
      },
      suggested_rule_object: "abstract",
      suggested_template_family_id: "family-1",
      suggested_journal_template_id: "journal-alpha",
      created_by: "editor-1",
      created_at: "2026-04-08T08:00:00.000Z",
      updated_at: "2026-04-08T08:05:00.000Z",
    },
  });

  assert.equal(
    entryForm?.ruleBody,
    "Normalize abstract objective headings to the governed journal style.",
  );
  assert.equal(entryForm?.positiveExample, ABSTRACT_OBJECTIVE_NORMALIZED);
  assert.equal(entryForm?.negativeExample, ABSTRACT_OBJECTIVE_SOURCE);
  assert.equal(
    entryForm?.sourceBasis,
    "Human-reviewed abstract heading normalization.",
  );
});

test("candidate conversions switch the ledger back to rule rows after wizard completion", () => {
  assert.equal(
    resolveRuleLedgerCategoryAfterWizardCompletion(
      {
        mode: "candidate",
        step: "publish",
        dirty: false,
        sourceRowId: "candidate-rule-1",
        draftAssetId: "knowledge-rule-1",
      },
      "recycled_candidate",
    ),
    "rule",
  );

  assert.equal(
    resolveRuleLedgerCategoryAfterWizardCompletion(
      {
        mode: "edit",
        step: "publish",
        dirty: false,
        sourceRowId: "knowledge-rule-1",
        draftAssetId: "knowledge-rule-1",
      },
      "all",
    ),
    "all",
  );
});
