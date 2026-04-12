import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TemplateGovernanceWorkbenchPage } from "../src/features/template-governance/template-governance-workbench-page.tsx";

function buildRulePackageWorkspaceFixture() {
  return {
    source: {
      sourceKind: "reviewed_case",
      reviewedCaseSnapshotId: "reviewed-case-snapshot-demo-1",
    },
    selectedPackageId: "package-front-matter",
    candidates: [
      {
        package_id: "package-front-matter",
        package_kind: "front_matter",
        title: "前置信息包",
        rule_object: "front_matter",
        suggested_layer: "journal_template",
        automation_posture: "guarded_auto",
        status: "draft",
        cards: {
          rule_what: {
            title: "前置信息包",
            object: "front_matter",
            publish_layer: "journal_template",
          },
          ai_understanding: {
            summary: "统一作者、单位与通信作者块。",
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
                before: "第一作者：张三",
                after: "（作者简介）张三",
              },
            ],
          },
          exclusions: {
            not_applicable_when: ["原稿元数据缺失"],
            human_review_required_when: ["新增通信作者时人工复核"],
            risk_posture: "guarded_auto",
          },
        },
        preview: {
          hit_summary: "命中前置信息块",
          hits: [
            {
              target: "author_line",
              reason: "作者行样式发生归一化",
              matched_text: "张三 李四",
            },
          ],
          misses: [
            {
              target: "classification_line",
              reason: "样本文本中未出现分类号",
            },
          ],
          decision: {
            automation_posture: "guarded_auto",
            needs_human_review: true,
            reason: "作者元数据变更需要人工复核。",
          },
        },
        semantic_draft: {
          semantic_summary: "统一作者、单位与通信作者块。",
          hit_scope: ["author_line:text_style_normalization"],
          applicability: ["front_matter"],
          evidence_examples: [
            {
              before: "第一作者：张三",
              after: "（作者简介）张三",
            },
          ],
          failure_boundaries: ["原稿元数据缺失"],
          normalization_recipe: ["统一作者与通信作者标签"],
          review_policy: ["新增通信作者时人工复核"],
          confirmed_fields: ["summary", "applicability", "evidence", "boundaries"],
        },
        supporting_signals: [],
      },
    ],
  };
}

test("template governance authoring mode renders package list, five semantic cards, and preview panel", () => {
  const markup = renderToStaticMarkup(
    React.createElement(TemplateGovernanceWorkbenchPage as never, {
      initialMode: "authoring",
      prefilledReviewedCaseSnapshotId: "reviewed-case-snapshot-demo-1",
      initialRulePackageWorkspace: buildRulePackageWorkspaceFixture(),
    }),
  );

  assert.match(markup, /示例驱动录入/);
  assert.match(markup, /规则包/);
  assert.match(markup, /规则是什么/);
  assert.match(markup, /AI 怎么理解它/);
  assert.match(markup, /适用于哪里/);
  assert.match(markup, /前后示例/);
  assert.match(markup, /什么时候不要用/);
  assert.match(markup, /命中预览/);
  assert.match(markup, /刷新预览/);
  assert.doesNotMatch(markup, /Publish Rule Package/);
  assert.doesNotMatch(markup, /Compile to editorial_rule/);
});
