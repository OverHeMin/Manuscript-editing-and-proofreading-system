import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

register(new URL("./helpers/ignore-css-loader.mjs", import.meta.url), import.meta.url);

const {
  TemplateGovernanceRuleWizard,
} = await import("../src/features/template-governance/template-governance-rule-wizard.tsx");
const {
  createRuleDraftInput,
} = await import("../src/features/template-governance/template-governance-rule-wizard-api.ts");

test("rule wizard shell renders shared step navigation and closeout actions", () => {
  const Wizard = TemplateGovernanceRuleWizard as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    <Wizard
      state={{
        mode: "create",
        step: "entry",
        dirty: true,
      }}
    />,
  );

  assert.match(markup, /下一步：AI 识别语义层/u);
  assert.match(markup, /保存草稿/u);
  assert.match(markup, /完成并返回规则中心/u);
  assert.match(markup, /规则正文/u);
  assert.match(markup, /正例示例/u);
  assert.match(markup, /反例示例/u);
  assert.match(markup, /图片 \/ 图表 \/ 截图/u);
  assert.match(markup, /来源依据/u);
  assert.match(markup, /展开高级标签/u);
});

test("rule wizard step entry maps form state into a governed rule draft input", () => {
  assert.deepEqual(
    createRuleDraftInput({
      title: "术语统一规则",
      moduleScope: "editing",
      manuscriptTypes: "clinical_study",
      sourceType: "guideline",
      contributor: "editor.zh",
      ruleBody: "医学术语应全文统一。",
      positiveExample: "",
      negativeExample: "",
      imageEvidence: "",
      sourceBasis: "",
      advancedTagsExpanded: false,
      sections: "",
      riskTags: "",
      packageHints: "",
      candidateOnly: false,
      conflictNotes: "",
    }),
    {
      title: "术语统一规则",
      canonicalText: "医学术语应全文统一。",
      knowledgeKind: "rule",
      moduleScope: "editing",
      manuscriptTypes: ["clinical_study"],
      sourceType: "guideline",
    },
  );
});
