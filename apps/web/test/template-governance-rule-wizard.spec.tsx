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
  createRuleWizardBindingInputs,
  confirmSemanticLayerInput,
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
  assert.match(markup, /录入画布/u);
  assert.match(markup, /AI 辅助提示/u);
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

test("rule wizard semantic step renders ai semantic result surfaces", () => {
  const Wizard = TemplateGovernanceRuleWizard as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    <Wizard
      state={{
        mode: "create",
        step: "semantic",
        dirty: true,
        draftRevisionId: "knowledge-1-revision-1",
      }}
      entryFormState={{
        title: "\u672f\u8bed\u7edf\u4e00\u89c4\u5219",
        moduleScope: "editing",
        manuscriptTypes: "clinical_study",
        sourceType: "guideline",
        contributor: "editor.zh",
        ruleBody:
          "\u8be5\u89c4\u5219\u7528\u4e8e\u68c0\u67e5\u533b\u5b66\u672f\u8bed\u3001\u7f29\u7565\u8bed\u548c\u4e2d\u82f1\u6587\u540d\u79f0\u662f\u5426\u7edf\u4e00\u3002",
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
      }}
    />,
  );

  assert.match(markup, /AI \u8bed\u4e49\u5c42\u7ed3\u679c/u);
  assert.match(markup, /\u8bc6\u522b\u53ef\u4fe1\u5ea6/u);
  assert.match(markup, /\u91cd\u65b0\u8bc6\u522b/u);
});

test("rule wizard confirm step renders human confirmation and change summary surfaces", () => {
  const Wizard = TemplateGovernanceRuleWizard as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    <Wizard
      state={{
        mode: "create",
        step: "confirm",
        dirty: true,
        draftRevisionId: "knowledge-1-revision-1",
      }}
      entryFormState={{
        title: "\u672f\u8bed\u7edf\u4e00\u89c4\u5219",
        moduleScope: "editing",
        manuscriptTypes: "clinical_study",
        sourceType: "guideline",
        contributor: "editor.zh",
        ruleBody:
          "\u8be5\u89c4\u5219\u7528\u4e8e\u68c0\u67e5\u533b\u5b66\u672f\u8bed\u3001\u7f29\u7565\u8bed\u548c\u4e2d\u82f1\u6587\u540d\u79f0\u662f\u5426\u7edf\u4e00\u3002",
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
      }}
    />,
  );

  assert.match(markup, /\u4eba\u5de5\u786e\u8ba4 AI \u7ed3\u679c/u);
  assert.match(markup, /\u4e00\u952e\u91c7\u7eb3\u9ad8\u7f6e\u4fe1\u7ed3\u679c/u);
  assert.match(markup, /AI 建议/u);
  assert.match(markup, /人工确认/u);
  assert.match(markup, /规则类型判断/u);
  assert.match(markup, /\u53d8\u66f4\u6458\u8981/u);
});

test("rule wizard confirm input keeps semantic summary and retrieval terms aligned", () => {
  assert.deepEqual(
    confirmSemanticLayerInput({
      semanticSummary:
        "\u8be5\u89c4\u5219\u7528\u4e8e\u68c0\u67e5\u533b\u5b66\u672f\u8bed\u3001\u7f29\u7565\u8bed\u548c\u4e2d\u82f1\u6587\u540d\u79f0\u662f\u5426\u7edf\u4e00\u3002",
      retrievalTerms: "\u672f\u8bed\u7edf\u4e00, \u7f29\u5199\u91ca\u4e49",
      retrievalSnippets: "",
      ruleType: "terminology_consistency",
      riskLevel: "medium",
      moduleScope: "editing",
      manuscriptTypes: "clinical_study",
    }),
    {
      pageSummary:
        "\u8be5\u89c4\u5219\u7528\u4e8e\u68c0\u67e5\u533b\u5b66\u672f\u8bed\u3001\u7f29\u7565\u8bed\u548c\u4e2d\u82f1\u6587\u540d\u79f0\u662f\u5426\u7edf\u4e00\u3002",
      retrievalTerms: ["\u672f\u8bed\u7edf\u4e00", "\u7f29\u5199\u91ca\u4e49"],
    },
  );
});

test("rule wizard binding and publish steps render package and release controls", () => {
  const Wizard = TemplateGovernanceRuleWizard as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const bindingMarkup = renderToStaticMarkup(
    <Wizard
      state={{
        mode: "create",
        step: "binding",
        dirty: true,
        draftRevisionId: "knowledge-1-revision-1",
      }}
    />,
  );
  const publishMarkup = renderToStaticMarkup(
    <Wizard
      state={{
        mode: "create",
        step: "publish",
        dirty: true,
        draftRevisionId: "knowledge-1-revision-1",
      }}
    />,
  );

  assert.match(bindingMarkup, /\u8fdb\u5165\u54ea\u4e2a\u89c4\u5219\u5305/u);
  assert.match(bindingMarkup, /\u901a\u7528\u6821\u5bf9\u5305/u);
  assert.match(bindingMarkup, /\u533b\u5b66\u4e13\u4e1a\u6821\u5bf9\u5305/u);
  assert.match(bindingMarkup, /业务调用模块/u);
  assert.match(bindingMarkup, /推荐复用/u);
  assert.match(bindingMarkup, /影响预览/u);
  assert.match(publishMarkup, /\u53d1\u5e03\u65b9\u5f0f/u);
  assert.match(publishMarkup, /\u63d0\u4ea4\u5ba1\u6838/u);
  assert.match(publishMarkup, /最终摘要/u);
  assert.match(publishMarkup, /提交前检查/u);
  assert.match(publishMarkup, /\u5b8c\u6210\u5e76\u8fd4\u56de\u89c4\u5219\u4e2d\u5fc3/u);
});

test("rule wizard binding selections map into package and template family bindings", () => {
  assert.deepEqual(
    createRuleWizardBindingInputs({
      selectedPackageKind: "medical_package",
      selectedPackageId: "pkg-medical",
      selectedPackageLabel: "\u533b\u5b66\u4e13\u4e1a\u6821\u5bf9\u5305",
      selectedTemplateFamilies: [
        {
          id: "family-clinical",
          name: "\u8bba\u8457\u57fa\u7840\u65cf",
        },
      ],
    }),
    [
      {
        bindingKind: "medical_package",
        bindingTargetId: "pkg-medical",
        bindingTargetLabel: "\u533b\u5b66\u4e13\u4e1a\u6821\u5bf9\u5305",
      },
      {
        bindingKind: "template_family",
        bindingTargetId: "family-clinical",
        bindingTargetLabel: "\u8bba\u8457\u57fa\u7840\u65cf",
      },
    ],
  );
});
