import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildEditingChangeLedgerEntries,
  buildEditingGuardrailEntries,
  buildProofreadingConfirmationItems,
  buildProofreadingDocumentBlocks,
  buildWorkbenchAssetDetailHref,
  ManuscriptWorkbenchAssetDetailPage,
  resolvePreviewOperationalState,
  resolveManuscriptAssetDetailKind,
} from "../src/features/manuscript-workbench/manuscript-workbench-detail.tsx";

test("asset detail helpers build hash-based preview routes for manuscript assets", () => {
  assert.equal(
    buildWorkbenchAssetDetailHref({
      mode: "editing",
      manuscriptId: "manuscript-1",
      assetId: "asset-edited-1",
    }),
    "#editing?manuscriptId=manuscript-1&assetId=asset-edited-1",
  );
  assert.equal(
    buildWorkbenchAssetDetailHref({
      mode: "proofreading",
      manuscriptId: "manuscript-2",
      assetId: "asset-proof-1",
      reviewedCaseSnapshotId: "snapshot-9",
    }),
    "#proofreading?manuscriptId=manuscript-2&assetId=asset-proof-1&reviewedCaseSnapshotId=snapshot-9",
  );
});

test("document preview detail keeps legacy doc manuscripts operationally pending and surfaces normalization warnings", () => {
  const asset = {
    id: "asset-original-doc-1",
    manuscript_id: "manuscript-1",
    asset_type: "original",
    status: "active",
    storage_key: "uploads/legacy-source.doc",
    mime_type: "application/msword",
    source_module: "upload",
    created_by: "uploader-1",
    version_no: 1,
    is_current: true,
    file_name: "legacy-source.doc",
    created_at: "2026-04-21T09:00:00.000Z",
    updated_at: "2026-04-21T09:05:00.000Z",
  } as const;
  const previewSession = {
    manuscript_id: "manuscript-1",
    source_asset_id: "asset-original-doc-1",
    source_asset_type: "original",
    viewer: "onlyoffice",
    mode: "view",
    status: "ready",
    mime_type: "application/msword",
    comment_source: "onlyoffice",
    comments: [],
    save_back_enabled: false,
    warnings: ["LibreOffice unavailable; doc to docx normalization deferred."],
  } as const;

  const operationalState = resolvePreviewOperationalState({
    asset,
    previewSession,
  });

  assert.equal(operationalState?.status, "pending_normalization");
  assert.deepEqual(operationalState?.warnings, [
    "LibreOffice unavailable; doc to docx normalization deferred.",
  ]);

  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchAssetDetailPage
      mode="editing"
      manuscriptTitle="legacy doc manuscript"
      asset={asset}
      detailKind="document_preview"
      backHref="#editing?manuscriptId=manuscript-1"
      downloadHref="http://localhost/api/v1/document-assets/asset-original-doc-1/download"
      previewSession={previewSession}
    />,
  );

  assert.match(markup, /LibreOffice unavailable; doc to docx normalization deferred\./);
  assert.match(markup, /稿件预览/u);
  assert.match(markup, /只读查看/u);
  assert.match(markup, /批注来源/u);
  assert.match(markup, /文档批注/u);
  assert.doesNotMatch(markup, /预览会话/u);
  assert.doesNotMatch(markup, /onlyoffice/u);
  assert.doesNotMatch(markup, /<dd>view<\/dd>/u);
  assert.doesNotMatch(markup, /<dt>资产类型<\/dt>/u);
});

test("asset detail kind routes proofreading draft reports into the dedicated issue workbench", () => {
  assert.equal(
    resolveManuscriptAssetDetailKind({
      mode: "proofreading",
      assetType: "proofreading_draft_report",
    }),
    "proofreading_workspace",
  );
  assert.equal(
    resolveManuscriptAssetDetailKind({
      mode: "proofreading",
      assetType: "final_proof_annotated_docx",
    }),
    "proofreading_confirmation",
  );
  assert.equal(
    resolveManuscriptAssetDetailKind({
      mode: "screening",
      assetType: "screening_report",
    }),
    "report_preview",
  );
  assert.equal(
    resolveManuscriptAssetDetailKind({
      mode: "editing",
      assetType: "edited_docx",
    }),
    "document_preview",
  );
});

test("editing detail helpers surface a visible change ledger from appliedChanges", () => {
  const entries = buildEditingChangeLedgerEntries({
    id: "job-edit-1",
    module: "editing",
    job_type: "editing_run",
    status: "completed",
    requested_by: "editor-1",
    attempt_count: 1,
    payload: {
      appliedChanges: [
        {
          ruleId: "rule-abstract-objective",
          before: "Background",
          after: "Objective",
          semantic_hit: {
            paragraph_index: 4,
          },
        },
      ],
    },
    created_at: "2026-04-21T09:00:00.000Z",
    updated_at: "2026-04-21T09:01:00.000Z",
  } as never);

  assert.deepEqual(entries, [
    {
      id: "change-1",
      sourceLabel: "rule-abstract-objective",
      before: "Background",
      after: "Objective",
      locationText: "段落 4",
    },
  ]);
});

test("editing guardrail helpers extract planning and DOCX-stage downgrade reasons", () => {
  const entries = buildEditingGuardrailEntries({
    payload: {
      editingPlan: {
        manualReviewItems: [
          "editing_guardrail:anchor_not_precise:摘要 目的",
          "editing_guardrail:insufficient_style_evidence:Introduction",
          "Verify the rewritten heading against the journal template.",
        ],
      },
      skippedAiReplacements: [
        {
          replacementId: "ai-replacement-1",
          reason: "anchor_not_precise",
          targetText: "摘要 目的",
        },
        {
          replacementId: "ai-replacement-2",
          reason: "insufficient_style_evidence",
          targetText: "Table 1",
        },
      ],
    },
  } as never);

  assert.deepEqual(entries, [
    {
      id: "editing-guardrail-plan:anchor_not_precise:摘要 目的",
      sourceStage: "planning",
      reasonCode: "anchor_not_precise",
      excerpt: "摘要 目的",
    },
    {
      id: "editing-guardrail-plan:insufficient_style_evidence:Introduction",
      sourceStage: "planning",
      reasonCode: "insufficient_style_evidence",
      excerpt: "Introduction",
    },
    {
      id: "editing-guardrail-docx-1",
      sourceStage: "docx_transform",
      reasonCode: "anchor_not_precise",
      excerpt: "摘要 目的",
    },
    {
      id: "editing-guardrail-docx-2",
      sourceStage: "docx_transform",
      reasonCode: "insufficient_style_evidence",
      excerpt: "Table 1",
    },
  ]);
});

test("proofreading detail helpers extract issue-based human confirmation rows from proofreading plans", () => {
  const items = buildProofreadingConfirmationItems({
    id: "job-proof-1",
    module: "proofreading",
    job_type: "proofreading_confirm",
    status: "completed",
    requested_by: "proofreader-1",
    attempt_count: 1,
    payload: {
      proofreadingPlan: {
        issues: [
          {
            itemId: "issue-1",
            title: "单位表达不规范",
            description: "将单位表达统一为标准写法。",
            severity: "medium",
            source: "residual_ai",
            issueType: "style",
            blocksFinal: false,
            anchor: {
              blockIndex: 0,
              quote: "5 mg per dL",
              sectionLabel: "结果",
            },
            suggestion: {
              action: "replace_text",
              replacementText: "5 mg/dL",
            },
          },
          {
            itemId: "issue-2",
            title: "主谓一致错误",
            description: "需要修正文法一致性。",
            severity: "medium",
            source: "residual_ai",
            issueType: "grammar",
            blocksFinal: false,
            anchor: {
              blockIndex: 1,
              quote: "The hemoglobin were stable.",
              sectionLabel: "讨论",
            },
            suggestion: {
              action: "replace_text",
              replacementText: "The hemoglobin was stable.",
            },
          },
        ],
      },
    },
    created_at: "2026-04-21T09:00:00.000Z",
    updated_at: "2026-04-21T09:01:00.000Z",
  } as never);

  assert.deepEqual(items, [
    {
      itemId: "issue-1",
      title: "单位表达不规范",
      description: "将单位表达统一为标准写法。",
      severity: "medium",
      source: "residual_ai",
      issueType: "style",
      blocksFinal: false,
      targetText: "5 mg per dL",
      replacementText: "5 mg/dL",
      anchor: {
        blockIndex: 0,
        quote: "5 mg per dL",
        sectionLabel: "结果",
      },
      suggestionAction: "replace_text",
    },
    {
      itemId: "issue-2",
      title: "主谓一致错误",
      description: "需要修正文法一致性。",
      severity: "medium",
      source: "residual_ai",
      issueType: "grammar",
      blocksFinal: false,
      targetText: "The hemoglobin were stable.",
      replacementText: "The hemoglobin was stable.",
      anchor: {
        blockIndex: 1,
        quote: "The hemoglobin were stable.",
        sectionLabel: "讨论",
      },
      suggestionAction: "replace_text",
    },
  ]);
});

test("proofreading detail helpers surface full-document blocks for the issue workbench", () => {
  const blocks = buildProofreadingDocumentBlocks({
    payload: {
      proofreadingSourceBlocks: [
        {
          blockIndex: 0,
          section: "结果",
          block_kind: "paragraph",
          text: "结果提示 5 mg per dL。",
        },
        {
          blockIndex: 1,
          section: "讨论",
          block_kind: "paragraph",
          text: "The hemoglobin were stable.",
        },
      ],
    },
  } as never);

  assert.deepEqual(blocks, [
    {
      blockId: "proofreading-block-0",
      blockIndex: 0,
      sectionLabel: "结果",
      blockKind: "paragraph",
      text: "结果提示 5 mg per dL。",
    },
    {
      blockId: "proofreading-block-1",
      blockIndex: 1,
      sectionLabel: "讨论",
      blockKind: "paragraph",
      text: "The hemoglobin were stable.",
    },
  ]);
});

test("proofreading detail page renders the dedicated issue workbench with explicit confirmation actions", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchAssetDetailPage
      mode="proofreading"
      manuscriptTitle="心血管综述稿"
      asset={{
        id: "asset-proof-1",
        manuscript_id: "manuscript-1",
        asset_type: "proofreading_draft_report",
        status: "active",
        storage_key: "runs/proofreading/draft.md",
        mime_type: "text/markdown",
        source_module: "proofreading",
        created_by: "proofreader-1",
        version_no: 2,
        is_current: false,
        file_name: "proofreading-draft.md",
        created_at: "2026-04-21T09:00:00.000Z",
        updated_at: "2026-04-21T09:05:00.000Z",
      }}
      detailKind="proofreading_workspace"
      backHref="#proofreading?manuscriptId=manuscript-1"
      downloadHref="http://localhost/api/v1/document-assets/asset-proof-1/download"
      proofreadingDocumentBlocks={[
        {
          blockId: "proofreading-block-0",
          blockIndex: 0,
          sectionLabel: "结果",
          blockKind: "paragraph",
          text: "结果提示 5 mg per dL。",
        },
        {
          blockId: "proofreading-block-1",
          blockIndex: 1,
          sectionLabel: "讨论",
          blockKind: "paragraph",
          text: "The hemoglobin were stable.",
        },
      ]}
      confirmationItems={[
        {
          itemId: "issue-1",
          title: "单位表达不规范",
          description: "将单位表达统一为标准写法。",
          severity: "medium",
          source: "residual_ai",
          issueType: "style",
          blocksFinal: false,
          targetText: "5 mg per dL",
          replacementText: "5 mg/dL",
          anchor: {
            blockIndex: 0,
            quote: "5 mg per dL",
            sectionLabel: "结果",
          },
          suggestionAction: "replace_text",
        },
      ]}
      activeProofreadingIssueId="issue-1"
      confirmationState={{
        "issue-1": {
          action: "accepted_with_manual_edit",
          editedReplacementText: "5 mg/dL（人工确认）",
          note: "人工确认后保留标准单位写法。",
        },
      }}
      onProofreadingIssueSelect={() => {}}
    />,
  );

  assert.match(markup, /data-detail-kind="proofreading_workspace"/);
  assert.match(markup, /校对问题工作台/u);
  assert.match(markup, /问题队列/u);
  assert.match(markup, /稿件原文/u);
  assert.match(markup, /心血管综述稿 - 校对草稿报告/u);
  assert.match(markup, /采纳并手改/u);
  assert.match(markup, /仅人工处理/u);
  assert.match(markup, /升级处理/u);
  assert.match(markup, /结果提示 5 mg per dL/u);
  assert.match(markup, /单位表达不规范/u);
  assert.match(markup, /5 mg per dL/);
  assert.match(markup, /5 mg\/dL（人工确认）/u);
  assert.match(markup, /发布人工终稿/u);
  assert.match(markup, /下载校对草稿报告/u);
  assert.doesNotMatch(markup, /proofreading-draft\.md/u);
});

test("proofreading report detail keeps draft reports labeled as reports instead of manuscript deliverables", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchAssetDetailPage
      mode="proofreading"
      manuscriptTitle="校对报告稿件"
      asset={{
        id: "asset-proof-draft-1",
        manuscript_id: "manuscript-1",
        asset_type: "proofreading_draft_report",
        status: "active",
        storage_key: "runs/proofreading/draft.md",
        mime_type: "text/markdown",
        source_module: "proofreading",
        created_by: "proofreader-1",
        version_no: 2,
        is_current: false,
        file_name: "proofreading-draft.md",
        created_at: "2026-04-21T09:00:00.000Z",
        updated_at: "2026-04-21T09:05:00.000Z",
      }}
      detailKind="report_preview"
      backHref="#proofreading?manuscriptId=manuscript-1"
      downloadHref="http://localhost/api/v1/document-assets/asset-proof-draft-1/download"
      reportBody="# 校对报告"
    />,
  );

  assert.match(markup, /data-detail-kind="report_preview"/);
  assert.match(markup, /校对报告稿件 - 校对草稿报告/u);
  assert.match(markup, /下载校对草稿报告/u);
  assert.doesNotMatch(markup, /proofreading-draft\.md/u);
});

test("detail page exposes real governance evidence for why this fired", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchAssetDetailPage
      mode="editing"
      manuscriptTitle="三线表稿件"
      asset={{
        id: "asset-edited-1",
        manuscript_id: "manuscript-1",
        asset_type: "edited_docx",
        status: "active",
        storage_key: "runs/editing/output.docx",
        mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        source_module: "editing",
        created_by: "editor-1",
        version_no: 2,
        is_current: true,
        file_name: "editing-output.docx",
        created_at: "2026-04-24T09:00:00.000Z",
        updated_at: "2026-04-24T09:05:00.000Z",
      }}
      detailKind="document_preview"
      backHref="#editing?manuscriptId=manuscript-1"
      downloadHref="http://localhost/api/v1/document-assets/asset-edited-1/download"
      executionSnapshot={{
        id: "snapshot-editing-1",
        manuscript_id: "manuscript-1",
        module: "editing",
        job_id: "job-editing-1",
        execution_profile_id: "execution-profile-editing-1",
        module_template_id: "template-editing-1",
        module_template_version_no: 2,
        prompt_template_id: "prompt-editing-1",
        prompt_template_version: "2026-04-24",
        skill_package_ids: [],
        skill_package_versions: [],
        model_id: "gpt-5.4",
        quality_packages: [
          {
            package_id: "package-general-v3",
            package_name: "通用样式包",
            package_kind: "general_style_package",
            target_scopes: ["general_proofreading"],
            version: 3,
          },
        ],
        knowledge_item_ids: ["knowledge-table-1"],
        created_asset_ids: ["asset-edited-1"],
        quality_findings_summary: {
          total_issue_count: 2,
          issue_count_by_scope: {
            general_proofreading: 2,
          },
          issue_count_by_action: {
            manual_review: 2,
          },
          issue_count_by_severity: {
            high: 1,
            medium: 1,
          },
          highest_action: "manual_review",
          representative_issue_ids: ["issue-1"],
        },
        created_at: "2026-04-24T09:00:00.000Z",
        agent_execution: {
          observation_status: "not_linked",
        },
        runtime_binding_readiness: {
          observation_status: "failed_open",
          error: "not used",
        },
      }}
      knowledgeHitLogs={[
        {
          id: "hit-1",
          snapshot_id: "snapshot-editing-1",
          knowledge_item_id: "knowledge-table-1",
          match_source_id:
            "general_package_kind:general_style_package:package-general-v3",
          binding_rule_id: "rule-table-1",
          match_source: "knowledge_item_binding",
          match_reasons: ["命中期刊表格格式说明", "由通用包绑定激活"],
          score: 0.97,
          section: "结果",
          created_at: "2026-04-24T09:01:00.000Z",
        },
      ]}
      knowledgeReferences={{
        "knowledge-table-1": {
          id: "knowledge-table-1",
          title: "三线表格式要求",
          revisionId: "revision-1",
          status: "approved",
        },
      }}
    />,
  );

  assert.match(markup, /治理命中依据/u);
  assert.match(markup, /snapshot-editing-1/);
  assert.match(markup, /通用样式包 v3 · 通用包/u);
  assert.match(markup, /人工复核/u);
  assert.match(markup, /三线表格式要求/u);
  assert.match(markup, /知识项绑定/u);
  assert.match(markup, /激活链路/u);
  assert.match(markup, /按通用包类型激活/u);
  assert.match(markup, /package-general-v3/);
  assert.match(markup, /命中期刊表格格式说明/u);
  assert.match(markup, /rule-table-1/);
  assert.match(markup, /结果/u);
});

test("editing detail page shows explicit editing guardrail downgrade reasons", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchAssetDetailPage
      mode="editing"
      manuscriptTitle="编辑守门稿件"
      asset={{
        id: "asset-edited-guardrail-1",
        manuscript_id: "manuscript-1",
        asset_type: "edited_docx",
        status: "active",
        storage_key: "runs/editing/guardrail.docx",
        mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        source_module: "editing",
        created_by: "editor-1",
        version_no: 2,
        is_current: true,
        file_name: "editing-guardrail.docx",
        created_at: "2026-04-24T09:00:00.000Z",
        updated_at: "2026-04-24T09:05:00.000Z",
      }}
      detailKind="document_preview"
      backHref="#editing?manuscriptId=manuscript-1"
      downloadHref="http://localhost/api/v1/document-assets/asset-edited-guardrail-1/download"
      editingGuardrails={[
        {
          id: "guardrail-1",
          sourceStage: "planning",
          reasonCode: "anchor_not_precise",
          excerpt: "摘要 目的",
        },
        {
          id: "guardrail-2",
          sourceStage: "docx_transform",
          reasonCode: "insufficient_style_evidence",
          excerpt: "Table 1",
        },
      ]}
    />,
  );

  assert.match(markup, /自动改动被拦截/u);
  assert.match(markup, /锚点不够精确（anchor_not_precise）/u);
  assert.match(markup, /样式证据不足（insufficient_style_evidence）/u);
  assert.match(markup, /AI 规划拦截/u);
  assert.match(markup, /DOCX 落稿拦截/u);
  assert.match(markup, /摘要 目的/u);
  assert.match(markup, /Table 1/u);
});
