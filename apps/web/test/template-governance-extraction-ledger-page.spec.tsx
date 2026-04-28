import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TemplateGovernanceExtractionLedgerPage } from "../src/features/template-governance/template-governance-extraction-ledger-page.tsx";

function buildExtractionLedgerFixture() {
  return {
    tasks: [
      {
        id: "task-demo-1",
        task_name: "原稿/编辑稿提取",
        manuscript_type: "clinical_study" as const,
        original_file_name: "original.docx",
        edited_file_name: "edited.docx",
        source_session_id: "session-demo-1",
        status: "awaiting_confirmation" as const,
        candidate_count: 1,
        pending_confirmation_count: 1,
        created_at: "2026-04-13T09:30:00.000Z",
        updated_at: "2026-04-13T09:30:00.000Z",
      },
    ],
    selectedTaskId: "task-demo-1",
    selectedTask: {
      id: "task-demo-1",
      task_name: "原稿/编辑稿提取",
      manuscript_type: "clinical_study" as const,
      original_file_name: "original.docx",
      edited_file_name: "edited.docx",
      source_session_id: "session-demo-1",
      status: "awaiting_confirmation" as const,
      candidate_count: 1,
      pending_confirmation_count: 1,
      created_at: "2026-04-13T09:30:00.000Z",
      updated_at: "2026-04-13T09:30:00.000Z",
      candidates: [
        {
          id: "candidate-demo-1",
          task_id: "task-demo-1",
          package_id: "package-front-matter",
          package_kind: "front_matter" as const,
          title: "前置信息包",
          confirmation_status: "ai_semantic_ready" as const,
          suggested_destination: "template" as const,
          candidate_payload: {
            package_id: "package-front-matter",
            package_kind: "front_matter" as const,
            title: "前置信息包",
            rule_object: "front_matter",
            suggested_layer: "journal_template" as const,
            automation_posture: "guarded_auto" as const,
            status: "draft" as const,
            cards: {
              rule_what: {
                title: "前置信息包",
                object: "front_matter",
                publish_layer: "journal_template" as const,
              },
              ai_understanding: {
                summary: "统一作者、单位与通讯作者块。",
                hit_objects: ["author_line"],
                hit_locations: ["front_matter"],
              },
              applicability: {
                manuscript_types: ["clinical_study"],
                modules: ["editing"],
                sections: ["front_matter"],
                table_targets: [],
              },
              evidence: { examples: [] },
              exclusions: {
                not_applicable_when: [],
                human_review_required_when: [],
                risk_posture: "guarded_auto" as const,
              },
            },
            preview: {
              hit_summary: "命中前置信息块。",
              hits: [],
              misses: [],
              decision: {
                automation_posture: "guarded_auto" as const,
                needs_human_review: true,
                reason: "需要人工确认。",
              },
            },
            semantic_draft: {
              semantic_summary: "统一作者、单位与通讯作者块。",
              hit_scope: ["author_line"],
              applicability: ["front_matter"],
              evidence_examples: [],
              failure_boundaries: [],
              normalization_recipe: ["统一作者标签"],
              review_policy: ["人工确认后入库"],
              confirmed_fields: [],
            },
          },
          semantic_draft_payload: {
            semantic_summary: "统一作者、单位与通讯作者块。",
            hit_scope: ["author_line"],
            applicability: ["front_matter"],
            evidence_examples: [],
            failure_boundaries: [],
            normalization_recipe: ["统一作者标签"],
            review_policy: ["人工确认后入库"],
            confirmed_fields: [],
          },
          created_at: "2026-04-13T09:30:00.000Z",
          updated_at: "2026-04-13T09:30:00.000Z",
        },
      ],
    },
    summary: {
      totalTaskCount: 1,
      candidateCount: 1,
      awaitingConfirmationCount: 1,
    },
  };
}

test("extraction ledger renders task table without page disclosure copy", () => {
  const markup = renderToStaticMarkup(
    <TemplateGovernanceExtractionLedgerPage viewModel={buildExtractionLedgerFixture()} />,
  );

  assert.match(markup, /template-governance-extraction-ledger-page/u);
  assert.match(markup, /template-governance-ledger-kpi-strip/u);
  assert.match(markup, /原稿\/编辑稿提取台账/u);
  assert.match(markup, /新建提取任务/u);
  assert.match(markup, /搜索任务/u);
  assert.match(markup, /批量处理/u);
  assert.match(markup, /提取任务/u);
  assert.match(markup, /候选台账/u);
  assert.match(markup, /待确认数/u);
  assert.match(markup, /任务名称/u);
  assert.match(markup, /候选名称/u);
  assert.match(markup, /候选语义摘要/u);
  assert.doesNotMatch(
    markup,
    /提取台账里的候选语义摘要来自文本与表格差异提取；DOCX 图片、图表和截图不会在这里被 AI 理解。/u,
  );
});

test("candidate confirmation opens candidate semantic review before intake", () => {
  const markup = renderToStaticMarkup(
    <TemplateGovernanceExtractionLedgerPage
      viewModel={buildExtractionLedgerFixture()}
      initialCandidateFormOpen
    />,
  );

  assert.match(markup, /template-governance-candidate-confirmation-form/u);
  assert.match(markup, /候选语义复核/u);
  assert.match(markup, /确认入库/u);
  assert.doesNotMatch(
    markup,
    /这里复核的是提取候选语义，不是规则向导里的多模态 AI 识别结果。/u,
  );
  assert.match(markup, /通用包台账|医学专用包台账|大模板台账/u);
});
