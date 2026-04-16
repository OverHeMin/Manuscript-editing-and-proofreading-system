import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildAuthSessionViewModel,
} from "../src/features/auth/index.ts";
import { buildWorkbenchNavigationGroups } from "../src/app/workbench-navigation.ts";
import {
  createTemplateGovernanceWorkbenchController,
} from "../src/features/template-governance/template-governance-controller.ts";
import {
  buildRuleAuthoringPreview,
  createRuleAuthoringDraft,
  resolveRuleAuthoringDraftForOverview,
  serializeRuleAuthoringDraft,
} from "../src/features/template-governance/rule-authoring-serialization.ts";
import {
  RuleAuthoringForm,
} from "../src/features/template-governance/rule-authoring-form.tsx";
import {
  getRuleAuthoringPreset,
  listRuleAuthoringPresets,
} from "../src/features/template-governance/rule-authoring-presets.ts";

const ABSTRACT_OBJECTIVE_SOURCE = "\u6458\u8981 \u76ee\u7684";
const ABSTRACT_OBJECTIVE_NORMALIZED = "\uff08\u6458\u8981\u3000\u76ee\u7684\uff09";

test("admin navigation exposes rule center as the single rule-governance entry", () => {
  const session = buildAuthSessionViewModel({
    userId: "admin-1",
    username: "admin.user",
    displayName: "admin display",
    role: "admin",
  });
  const groups = buildWorkbenchNavigationGroups(session.availableWorkbenchEntries);
  const allItems = groups.flatMap((group) => group.items);
  const ruleCenterItem =
    allItems.find((item) => item.id === "template-governance") ?? null;

  assert.ok(ruleCenterItem);
  assert.equal(ruleCenterItem?.label, "\u89c4\u5219\u4e2d\u5fc3");
  assert.equal(allItems.some((item) => item.id === "learning-review"), false);
});

test("abstract preset serializes the exact normalized abstract objective example", () => {
  const preset = getRuleAuthoringPreset("abstract");
  const draft = createRuleAuthoringDraft("abstract");

  draft.orderNo = 10;
  draft.executionMode = "apply_and_inspect";
  draft.confidencePolicy = "always_auto";
  draft.payload.sourceLabelText = ABSTRACT_OBJECTIVE_SOURCE;
  draft.payload.normalizedLabelText = ABSTRACT_OBJECTIVE_NORMALIZED;
  draft.payload.labelRole = "objective";

  const serialized = serializeRuleAuthoringDraft(draft);

  assert.equal(preset.objectLabel, "摘要");
  assert.equal(serialized.ruleObject, "abstract");
  assert.deepEqual(serialized.selector, {
    section_selector: "abstract",
    label_selector: {
      text: ABSTRACT_OBJECTIVE_SOURCE,
    },
  });
  assert.equal(serialized.trigger.kind, "exact_text");
  assert.equal(serialized.trigger.text, ABSTRACT_OBJECTIVE_SOURCE);
  assert.equal(serialized.action.kind, "replace_heading");
  assert.equal(serialized.action.to, ABSTRACT_OBJECTIVE_NORMALIZED);
  assert.equal(serialized.exampleBefore, ABSTRACT_OBJECTIVE_SOURCE);
  assert.equal(serialized.exampleAfter, ABSTRACT_OBJECTIVE_NORMALIZED);
  assert.deepEqual(serialized.authoringPayload, {
    label_role: "objective",
    source_label_text: ABSTRACT_OBJECTIVE_SOURCE,
    normalized_label_text: ABSTRACT_OBJECTIVE_NORMALIZED,
    punctuation_style: "full_width_parentheses",
    spacing_style: "full_width_gap",
  });
});

test("rule authoring catalog covers the medical rule objects needed by rule center v2", () => {
  const presetObjects = new Set(
    listRuleAuthoringPresets().map((preset) => preset.object),
  );

  for (const object of [
    "abstract",
    "table",
    "statistical_expression",
    "reference",
    "statement",
    "title",
    "author_line",
    "keyword",
    "terminology",
    "figure",
    "manuscript_structure",
    "journal_column",
  ]) {
    assert.equal(presetObjects.has(object), true, `missing preset for ${object}`);
  }
});

test("table preset serializes semantic table selectors as inspect-first rules", () => {
  const preset = getRuleAuthoringPreset("table");
  const draft = createRuleAuthoringDraft("table");

  draft.orderNo = 30;
  draft.payload.tableKind = "three_line_table";
  draft.payload.semanticTarget = "header_cell";
  draft.payload.headerPathIncludes = ["Treatment group", "n (%)"];
  draft.payload.columnKey = "Treatment group > n (%)";
  draft.payload.captionRequirement = "\u8868\u9898\u7f6e\u4e8e\u8868\u4e0a";
  draft.payload.layoutRequirement = "\u7981\u7528\u7ad6\u7ebf";
  draft.payload.manualReviewReasonTemplate =
    "\u4e09\u7ebf\u8868\u9700\u4eba\u5de5\u6838\u5bf9\u6392\u7248\u4e0e\u8868\u6ce8";

  const serialized = serializeRuleAuthoringDraft(draft);

  assert.equal(preset.objectLabel, "表格");
  assert.equal(serialized.ruleObject, "table");
  assert.equal(serialized.executionMode, "inspect");
  assert.deepEqual(serialized.selector, {
    semantic_target: "header_cell",
    header_path_includes: ["Treatment group", "n (%)"],
    column_key: "Treatment group > n (%)",
  });
  assert.deepEqual(serialized.trigger, {
    kind: "table_shape",
    layout: "three_line_table",
  });
  assert.equal(serialized.authoringPayload.table_kind, "three_line_table");
  assert.equal(serialized.authoringPayload.semantic_target, "header_cell");
  assert.deepEqual(serialized.authoringPayload.header_path_includes, [
    "Treatment group",
    "n (%)",
  ]);
  assert.equal(
    serialized.authoringPayload.column_key,
    "Treatment group > n (%)",
  );
  assert.equal(
    serialized.authoringPayload.layout_requirement,
    "\u7981\u7528\u7ad6\u7ebf",
  );
  assert.equal(
    serialized.manualReviewReasonTemplate,
    "\u4e09\u7ebf\u8868\u9700\u4eba\u5de5\u6838\u5bf9\u6392\u7248\u4e0e\u8868\u6ce8",
  );
});

test("table preview explains semantic target and journal override scope", () => {
  const draft = createRuleAuthoringDraft("table");

  draft.journalTemplateId = "journal-alpha";
  draft.payload.semanticTarget = "header_cell";
  draft.payload.headerPathIncludes = ["Treatment group", "n (%)"];
  draft.payload.columnKey = "Treatment group > n (%)";

  const preview = buildRuleAuthoringPreview(draft);

  assert.match(preview.selectorSummary, /semantic_target=header_cell/);
  assert.match(preview.selectorSummary, /header_path=Treatment group > n \(%\)/);
  assert.match(preview.semanticHitSummary, /header_cell/i);
  assert.match(preview.semanticHitSummary, /Treatment group > n \(%\)/);
  assert.match(preview.expectedEvidenceSummary, /table_id=runtime-resolved/);
  assert.match(preview.overrideSummary, /journal-alpha/);
  assert.match(preview.overrideSummary, /期刊加层/);
  assert.equal(preview.automationRiskPosture, "仅检查");
});

test("empty rule-set synchronization falls back to the abstract onboarding draft", () => {
  const draft = resolveRuleAuthoringDraftForOverview({
    overview: {
      rules: [],
      selectedJournalTemplateId: "journal-alpha",
      selectedRuleSetId: "rule-set-journal-1",
    },
    preferredRuleObject: "table",
    previousSelectedRuleSetId: "seeded-table-rule-set",
  });

  const preview = buildRuleAuthoringPreview(draft);

  assert.equal(draft.ruleObject, "abstract");
  assert.equal(draft.journalTemplateId, "journal-alpha");
  assert.equal(
    preview.normalizedExample,
    `${ABSTRACT_OBJECTIVE_SOURCE} -> ${ABSTRACT_OBJECTIVE_NORMALIZED}`,
  );
});

test("table authoring form renders semantic selector fields", () => {
  const draft = createRuleAuthoringDraft("table");

  const markup = renderToStaticMarkup(
    React.createElement(RuleAuthoringForm, {
      selectedRuleSet: {
        id: "rule-set-1",
        template_family_id: "family-1",
        journal_template_id: "journal-alpha",
        module: "editing",
        version_no: 1,
        status: "draft",
      },
      draft,
      isBusy: false,
      onDraftChange: () => undefined,
      onSubmit: () => undefined,
    }),
  );

  assert.match(markup, /语义目标/);
  assert.match(markup, /表头路径/);
  assert.match(markup, /列标识/);
  assert.match(markup, /预期表格形态/);
});

test("statement preset serializes required statement placement as an inspect-first rule", () => {
  const preset = getRuleAuthoringPreset("statement");
  const draft = createRuleAuthoringDraft("statement");

  draft.orderNo = 70;
  draft.payload.statementKind = "ethics";
  draft.payload.requiredStatement = "\u9700\u8bf4\u660e\u4f26\u7406\u5ba1\u6279\u53ca\u6279\u51c6\u7f16\u53f7";
  draft.payload.placement = "\u6b63\u6587\u672b\u5c3e\u58f0\u660e\u90e8\u5206";

  const serialized = serializeRuleAuthoringDraft(draft);

  assert.equal(preset.objectLabel, "规范声明");
  assert.equal(serialized.ruleObject, "statement");
  assert.equal(serialized.executionMode, "inspect");
  assert.deepEqual(serialized.selector, {
    statement_selector: {
      statement_kind: "ethics",
    },
  });
  assert.equal(serialized.trigger.kind, "required_statement");
  assert.equal(serialized.action.kind, "inspect_required_statement");
  assert.equal(
    serialized.authoringPayload.statement_kind,
    "ethics",
  );
});

test("template governance controller preserves journal template selection in rule-set creation payloads", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createTemplateGovernanceWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.url === "/api/v1/editorial-rules/rule-sets" && input.method === "POST") {
        return {
          status: 201,
          body: {
            id: "rule-set-journal-1",
            template_family_id: "family-1",
            journal_template_id: "journal-alpha",
            module: "editing",
            version_no: 1,
            status: "draft",
          } as TResponse,
        };
      }

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

      if (input.url === "/api/v1/templates/families/family-1/journal-templates") {
        return {
          status: 200,
          body: [
            {
              id: "journal-alpha",
              template_family_id: "family-1",
              journal_key: "zxyjhzz",
              journal_name: "\u300a\u4e2d\u897f\u533b\u7ed3\u5408\u6742\u5fd7\u300b",
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

      if (input.url === "/api/v1/editorial-rules/rule-sets" && input.method === "GET") {
        return {
          status: 200,
          body: [
            {
              id: "rule-set-journal-1",
              template_family_id: "family-1",
              journal_template_id: "journal-alpha",
              module: "editing",
              version_no: 1,
              status: "draft",
            },
          ] as TResponse,
        };
      }

      if (input.url === "/api/v1/editorial-rules/rule-sets/rule-set-journal-1/rules") {
        return {
          status: 200,
          body: [] as TResponse,
        };
      }

      if (input.url === "/api/v1/prompt-skill-registry/prompt-templates") {
        return {
          status: 200,
          body: [] as TResponse,
        };
      }

      if (
        input.url === "/api/v1/templates/families/family-1/retrieval-quality-runs/latest"
      ) {
        throw new Error("not found");
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const result = await controller.createRuleSetAndReload({
    actorRole: "admin",
    templateFamilyId: "family-1",
    journalTemplateId: "journal-alpha",
    module: "editing",
    selectedTemplateFamilyId: "family-1",
    selectedJournalTemplateId: "journal-alpha",
  });

  assert.equal(result.ruleSet.journal_template_id, "journal-alpha");
  assert.equal(result.overview.selectedJournalTemplateProfile?.id, "journal-alpha");
  assert.deepEqual(requests[0], {
    method: "POST",
    url: "/api/v1/editorial-rules/rule-sets",
    body: {
      actorRole: "admin",
      templateFamilyId: "family-1",
      journalTemplateId: "journal-alpha",
      module: "editing",
    },
  });
});
