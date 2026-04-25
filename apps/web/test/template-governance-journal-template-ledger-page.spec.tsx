import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TemplateGovernanceJournalTemplateLedgerPage } from "../src/features/template-governance/index.ts";
import type { TemplateGovernanceLedgerSearchState } from "../src/features/template-governance/template-governance-ledger-types.ts";

const journalFixture = {
  templateFamilies: [
    {
      id: "family-1",
      manuscript_type: "clinical_study" as const,
      name: "临床研究大模板",
      status: "active" as const,
    },
  ],
  selectedTemplateFamilyId: "family-1",
  selectedTemplateFamily: {
    id: "family-1",
    manuscript_type: "clinical_study" as const,
    name: "临床研究大模板",
    status: "active" as const,
  },
  journalTemplates: [
    {
      id: "journal-1",
      template_family_id: "family-1",
      journal_key: "zxyjhzz",
      journal_name: "《中西医结合杂志》",
      status: "active" as const,
      target_model_version_id: "journal-1-v2",
      target_model_version_no: 2,
      journal_format_target_model: {
        skeleton: [
          "front_matter",
          "title",
          "abstract",
          "keywords",
          "body",
          "figures_tables",
          "references",
        ],
        target_blocks: [
          {
            block_key: "author_bio",
            label: "作者简介",
            zone: "front_matter" as const,
            anchor: "before_title" as const,
            order: 10,
            required: false,
            repeatable: true,
            enabled: true,
            format_policy: {
              display_label: "作者简介",
              prefix: "作者简介：",
              target_position: "标题上方",
              style_requirements: ["独立成段"],
              allow_auto_reorder: true,
            },
            content_source_policy: "prefer_existing_with_manual_fill" as const,
            completion_gate: "warn_only" as const,
          },
          {
            block_key: "classification_code",
            label: "中图分类号",
            zone: "keywords" as const,
            anchor: "after_keywords" as const,
            order: 20,
            required: true,
            repeatable: false,
            enabled: true,
            format_policy: {
              display_label: "中图分类号",
              prefix: "中图分类号：",
              target_position: "关键词下方",
              style_requirements: ["与文献标志码并列"],
              allow_auto_reorder: true,
            },
            content_source_policy: "must_harvest_existing" as const,
            completion_gate: "block_on_missing" as const,
          },
        ],
      },
    },
  ],
  selectedJournalTemplateId: "journal-1",
  selectedJournalTemplate: {
    id: "journal-1",
    template_family_id: "family-1",
    journal_key: "zxyjhzz",
    journal_name: "《中西医结合杂志》",
    status: "active" as const,
    target_model_version_id: "journal-1-v2",
    target_model_version_no: 2,
    journal_format_target_model: {
      skeleton: [
        "front_matter",
        "title",
        "abstract",
        "keywords",
        "body",
        "figures_tables",
        "references",
      ],
      target_blocks: [
        {
          block_key: "author_bio",
          label: "作者简介",
          zone: "front_matter" as const,
          anchor: "before_title" as const,
          order: 10,
          required: false,
          repeatable: true,
          enabled: true,
          format_policy: {
            display_label: "作者简介",
            prefix: "作者简介：",
            target_position: "标题上方",
            style_requirements: ["独立成段"],
            allow_auto_reorder: true,
          },
          content_source_policy: "prefer_existing_with_manual_fill" as const,
          completion_gate: "warn_only" as const,
        },
        {
          block_key: "classification_code",
          label: "中图分类号",
          zone: "keywords" as const,
          anchor: "after_keywords" as const,
          order: 20,
          required: true,
          repeatable: false,
          enabled: true,
          format_policy: {
            display_label: "中图分类号",
            prefix: "中图分类号：",
            target_position: "关键词下方",
            style_requirements: ["与文献标志码并列"],
            allow_auto_reorder: true,
          },
          content_source_policy: "must_harvest_existing" as const,
          completion_gate: "block_on_missing" as const,
        },
      ],
    },
  },
  summary: {
    familyCount: 1,
    journalCount: 1,
    activeCount: 1,
  },
};

test("journal template ledger renders family-scoped journal rows", () => {
  const markup = renderToStaticMarkup(
    <TemplateGovernanceJournalTemplateLedgerPage viewModel={journalFixture} />,
  );

  assert.match(markup, /template-governance-journal-template-ledger-page/u);
  assert.match(markup, /期刊模板台账/u);
  assert.match(markup, /大模板台账/u);
  assert.match(markup, /所属大模板/u);
  assert.match(markup, /期刊键/u);
  assert.match(markup, /《中西医结合杂志》/u);
  assert.match(markup, /目标模型版本/u);
  assert.match(markup, /作者简介/u);
  assert.match(markup, /中图分类号/u);
  assert.match(markup, /新增期刊模板/u);
});

test("journal template ledger renders inline edit form and search results when requested", () => {
  const searchState: TemplateGovernanceLedgerSearchState = {
    mode: "results",
    query: "中西医结合",
    title: "期刊模板查找结果",
    rows: [
      {
        id: "journal-1",
        primary: "《中西医结合杂志》",
        secondary: "临床研究大模板 / zxyjhzz",
        cells: ["clinical_study", "启用中", "active"],
      },
    ],
  };

  const markup = renderToStaticMarkup(
    <TemplateGovernanceJournalTemplateLedgerPage
      viewModel={journalFixture}
      formMode="edit"
      formValues={{
        templateFamilyId: "family-1",
        journalName: "《中西医结合杂志》",
        journalKey: "zxyjhzz",
        targetModel: journalFixture.selectedJournalTemplate.journal_format_target_model,
        targetModelVersionId: "journal-1-v2",
        targetModelVersionNo: 2,
      }}
      searchState={searchState}
    />,
  );

  assert.match(markup, /编辑期刊模板/u);
  assert.match(markup, /保存期刊模板修改/u);
  assert.match(markup, /期刊模板查找结果/u);
  assert.match(markup, /《中西医结合杂志》/u);
});
