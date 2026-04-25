import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildProofreadingConfirmationDraftState,
  buildEditingChangeLedgerEntries,
  buildProofreadingConfirmationItems,
  buildProofreadingDocumentBlocks,
  buildProofreadingIssueMarkers,
  buildProofreadingIssueSummary,
  buildWorkbenchAssetDetailHref,
  ManuscriptWorkbenchAssetDetailPage,
  resolveProofreadingFallbackFocusTarget,
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
    surface_mode: "read_only_review",
    status: "ready",
    mime_type: "application/msword",
    comment_source: "onlyoffice",
    comments: [],
    session_id: "preview-session-1",
    correlation_id: "preview-session-1",
    document: {
      document_key: "asset-original-doc-1",
      file_name: "legacy-source.doc",
      file_extension: "doc",
      mime_type: "application/msword",
      download_path: "/api/v1/document-assets/asset-original-doc-1/download",
      permissions: {
        edit: false,
        comment: false,
        review: false,
        download: true,
        print: true,
      },
    },
    authorization: {
      kind: "surface_session",
      requires_surface_session: true,
      token_scheme: "none",
    },
    event_bridge: {
      provider: "onlyoffice",
      transport: "window_post_message",
      capabilities: {
        ready_event: true,
        locate_to_anchor: true,
        selection_from_document: true,
        visible_issue_marks: false,
        bi_directional_sync: true,
      },
    },
    embed: {
      provider: "onlyoffice",
      provider_origin: "http://127.0.0.1:58080",
      api_js_url: "http://127.0.0.1:58080/web-apps/apps/api/documents/api.js",
      document_type: "word",
      ui_type: "desktop",
      editor_config: {
        mode: "view",
        lang: "zh-CN",
        customization: {
          autosave: false,
          chat: false,
          comments: false,
          compactHeader: true,
          compactToolbar: true,
          feedback: false,
          forcesave: false,
          help: false,
          submitForm: false,
        },
      },
    },
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

test("proofreading workspace falls back to block view when preview session is missing onlyoffice embed fields", () => {
  const asset = {
    id: "asset-proof-draft-1",
    manuscript_id: "manuscript-proof-1",
    asset_type: "proofreading_draft_report",
    status: "active",
    storage_key: "uploads/proofreading-draft-report.md",
    mime_type: "text/markdown",
    source_module: "proofreading",
    created_by: "proofreader-1",
    version_no: 1,
    is_current: true,
    file_name: "proofreading-draft-report.md",
    created_at: "2026-04-24T10:00:00.000Z",
    updated_at: "2026-04-24T10:05:00.000Z",
  } as const;
  const legacyPreviewSession = {
    manuscript_id: "manuscript-proof-1",
    source_asset_id: "asset-original-1",
    source_asset_type: "original",
    viewer: "onlyoffice",
    mode: "view",
    status: "ready",
    mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    comment_source: "onlyoffice",
    comments: [],
    save_back_enabled: false,
    warnings: [],
  } as const;

  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchAssetDetailPage
      mode="proofreading"
      manuscriptTitle="proofreading workspace manuscript"
      asset={asset}
      detailKind="proofreading_workspace"
      backHref="#proofreading?manuscriptId=manuscript-proof-1"
      downloadHref="http://localhost/api/v1/document-assets/asset-original-1/download"
      previewSession={legacyPreviewSession as never}
      confirmationItems={[
        {
          itemId: "issue-1",
          title: "术语不统一",
          targetText: "HbA1c",
          replacementText: "糖化血红蛋白（HbA1c）",
          anchor: {
            blockIndex: 0,
            quote: "HbA1c",
            sectionLabel: "结果",
          },
        },
      ]}
      proofreadingDocumentBlocks={[
        {
          blockId: "proofreading-block-0",
          blockIndex: 0,
          sectionLabel: "结果",
          blockKind: "paragraph",
          text: "HbA1c improved after treatment.",
        },
      ]}
    />,
  );

  assert.match(markup, /问题驱动工作台/u);
  assert.match(markup, /HbA1c improved after treatment\./u);
  assert.match(markup, /问题 1 项/u);
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

test("proofreading detail helpers merge governed quality findings into the proofreading confirmation queue", () => {
  const items = buildProofreadingConfirmationItems({
    id: "job-proof-2",
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
        ],
      },
      proofreadingFindings: {
        qualityFindings: [
          {
            id: "quality-1",
            title: "统计学表达需人工确认",
            summary: "P 值表达与期刊规范不一致",
            excerpt: "P < 0.05",
            suggestion: "P=0.032",
            rationale: "统计表达存在高风险误解空间",
            severity: "error",
            location: {
              paragraph_index: 6,
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
      itemId: "quality-1",
      title: "统计学表达需人工确认",
      description: "P 值表达与期刊规范不一致",
      severity: "high",
      source: "quality_check",
      issueType: "quality",
      blocksFinal: true,
      targetText: "P < 0.05",
      replacementText: "P=0.032",
      anchor: {
        blockIndex: 6,
        quote: "P < 0.05",
      },
      suggestionAction: "replace_text",
    },
  ]);
});

test("proofreading detail helpers merge failed governed checks into the proofreading confirmation queue", () => {
  const items = buildProofreadingConfirmationItems({
    id: "job-proof-3",
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
        ],
      },
      proofreadingFindings: {
        failedChecks: [
          {
            ruleId: "rule-statistics-1",
            severity: "error",
            actual: "P < 0.05",
            expected: "P=0.032",
            explanation: "统计学表达未按模板要求精确落位",
            location: {
              paragraph_index: 8,
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
      itemId: "rule-statistics-1",
      title: "规则 rule-statistics-1 需要人工确认",
      description: "统计学表达未按模板要求精确落位",
      severity: "high",
      source: "quality_check",
      issueType: "failed_check",
      blocksFinal: true,
      targetText: "P < 0.05",
      replacementText: "P=0.032",
      anchor: {
        blockIndex: 8,
        quote: "P < 0.05",
      },
      suggestionAction: "replace_text",
    },
  ]);
});

test("proofreading detail helpers keep table failed-check labels for operators while deriving a searchable anchor quote", () => {
  const items = buildProofreadingConfirmationItems({
    id: "job-proof-table-1",
    module: "proofreading",
    job_type: "proofreading_confirm",
    status: "completed",
    requested_by: "proofreader-1",
    attempt_count: 1,
    payload: {
      proofreadingFindings: {
        failedChecks: [
          {
            ruleId: "rule-proofreading-baseline-table-1",
            severity: "high",
            actual: "table-1 > Treatment group > n (%)",
            expected: "Layout requirement: 组别命名、样本量、单位与统计注释一致",
            explanation: "表头命名和统计脚注需要人工确认",
            location: {
              blockIndex: 4,
              semantic_target: "header_cell",
              header_path: ["Treatment group", "n (%)"],
              column_key: "Treatment group > n (%)",
            },
          },
        ],
      },
    },
    created_at: "2026-04-25T10:00:00.000Z",
    updated_at: "2026-04-25T10:01:00.000Z",
  } as never);

  assert.equal(items.length, 1);
  assert.equal(items[0]?.targetText, "table-1 > Treatment group > n (%)");
  assert.equal(items[0]?.anchor?.quote, "n (%)");
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
      previewAsset={{
        id: "asset-edited-1",
        manuscript_id: "manuscript-1",
        asset_type: "edited_docx",
        status: "active",
        storage_key: "runs/editing/edited.docx",
        mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        source_module: "editing",
        created_by: "editor-1",
        version_no: 1,
        is_current: true,
        file_name: "edited.docx",
        created_at: "2026-04-21T08:30:00.000Z",
        updated_at: "2026-04-21T08:45:00.000Z",
      }}
      previewDownloadHref="http://localhost/api/v1/document-assets/asset-edited-1/download"
      previewSession={{
        manuscript_id: "manuscript-1",
        source_asset_id: "asset-edited-1",
        source_asset_type: "normalized_docx",
        viewer: "onlyoffice",
        mode: "view",
        surface_mode: "read_only_review",
        status: "ready",
        mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        comment_source: "onlyoffice",
        comments: [],
        session_id: "preview-session-proof-1",
        correlation_id: "preview-session-proof-1",
        document: {
          document_key: "asset-edited-1",
          file_name: "edited.docx",
          file_extension: "docx",
          mime_type:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          download_path: "/api/v1/document-assets/asset-edited-1/download",
          permissions: {
            edit: false,
            comment: false,
            review: false,
            download: true,
            print: true,
          },
        },
        authorization: {
          kind: "surface_session",
          requires_surface_session: true,
          token_scheme: "none",
        },
        event_bridge: {
          provider: "onlyoffice",
          transport: "window_post_message",
          capabilities: {
            ready_event: true,
            locate_to_anchor: true,
            selection_from_document: true,
            visible_issue_marks: false,
            bi_directional_sync: true,
          },
        },
        embed: {
          provider: "onlyoffice",
          provider_origin: "http://127.0.0.1:58080",
          api_js_url: "http://127.0.0.1:58080/web-apps/apps/api/documents/api.js",
          document_type: "word",
          ui_type: "desktop",
          editor_config: {
            mode: "view",
            lang: "zh-CN",
            customization: {
              autosave: false,
              chat: false,
              comments: false,
              compactHeader: true,
              compactToolbar: true,
              feedback: false,
              forcesave: false,
              help: false,
              submitForm: false,
            },
          },
        },
        save_back_enabled: false,
        warnings: [],
      }}
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
      activeProofreadingLocateTarget={{
        blockIndex: 0,
        quote: "5 mg per dL",
        sectionLabel: "Results",
        anchorKey: "paragraph:results:1",
        anchorKind: "paragraph",
        confidence: "provided",
      }}
      confirmationState={{
        "issue-1": {
          action: "accepted_with_manual_edit",
          editedReplacementText: "5 mg/dL（人工确认）",
          note: "人工确认后保留标准单位写法。",
        },
      }}
      onSaveDraft={() => {}}
      draftSaveLabel="已保存 1 项"
      onProofreadingIssueSelect={() => {}}
    />,
  );

  assert.match(markup, /data-detail-kind="proofreading_workspace"/);
  assert.match(markup, /校对问题工作台/u);
  assert.match(markup, /问题队列/u);
  assert.match(markup, /共发现 1 项问题/u);
  assert.match(markup, /高 0 · 中 1 · 低 0/u);
  assert.match(markup, /当前显示 1 \/ 共 1/u);
  assert.match(markup, /稿件原文/u);
  assert.match(markup, /心血管综述稿 - 编辑稿/u);
  assert.match(markup, /打开稿件原文/u);
  assert.match(markup, /data-document-surface-provider="onlyoffice"/u);
  assert.match(markup, /结构化定位备用视图/u);
  assert.match(markup, /采纳并手改/u);
  assert.match(markup, /仅人工处理/u);
  assert.match(markup, /升级处理/u);
  assert.match(markup, /结果提示 5 mg per dL/u);
  assert.match(markup, /单位表达不规范/u);
  assert.match(markup, /问题 1/u);
  assert.match(markup, /5 mg per dL/);
  assert.match(markup, /5 mg\/dL（人工确认）/u);
  assert.match(markup, /保存进度/u);
  assert.match(markup, /已保存 1 项/u);
  assert.match(markup, /发布人工终稿/u);
  assert.match(markup, /下载校对草稿报告/u);
  assert.match(markup, /问题标记/u);
  assert.match(markup, /共 1 处/u);
  assert.match(markup, /data-proofreading-marker-item-id="issue-1"/u);
  assert.match(markup, /data-proofreading-marker-selected="true"/u);
  assert.match(markup, /data-preview-session-ready="true"/);
  assert.match(markup, /data-active-locate-anchor-key="paragraph:results:1"/);
  assert.match(markup, /data-active-locate-anchor-kind="paragraph"/);
  assert.doesNotMatch(markup, /proofreading-draft\.md/u);
});

test("proofreading detail helpers rebuild confirmation draft state from the persisted confirmation draft payload", () => {
  const state = buildProofreadingConfirmationDraftState({
    payload: {
      confirmationDraft: {
        confirmationDecisions: [
          {
            itemId: "issue-1",
            action: "accepted",
            targetText: "5 mg per dL",
            replacementText: "5 mg/dL",
          },
          {
            itemId: "issue-2",
            action: "accepted_with_manual_edit",
            targetText: "ALT remained stable.",
            replacementText: "Alanine aminotransferase remained stable.",
            finalReplacementText: "Serum alanine aminotransferase (ALT) remained stable.",
            note: "补足术语全称。",
          },
        ],
      },
    },
  } as never);

  assert.deepEqual(state, {
    "issue-1": {
      action: "accepted",
    },
    "issue-2": {
      action: "accepted_with_manual_edit",
      editedReplacementText: "Serum alanine aminotransferase (ALT) remained stable.",
      note: "补足术语全称。",
    },
  });
});

test("proofreading detail helpers summarize total, severity, and processed issue counts", () => {
  const summary = buildProofreadingIssueSummary(
    [
      {
        itemId: "issue-1",
        severity: "high",
        targetText: "5 mg per dL",
        replacementText: "5 mg/dL",
      },
      {
        itemId: "issue-2",
        severity: "medium",
        targetText: "ALT remained stable.",
        replacementText: "Alanine aminotransferase remained stable.",
      },
      {
        itemId: "issue-3",
        severity: "low",
        targetText: "however the sample stayed small",
        replacementText: "however, the sample stayed small",
      },
    ],
    {
      "issue-1": {
        action: "route_to_rule_candidate",
      },
      "issue-2": {
        action: "accepted_with_manual_edit",
        editedReplacementText: "Serum alanine aminotransferase (ALT) remained stable.",
      },
    },
    2,
  );

  assert.deepEqual(summary, {
    totalCount: 3,
    highCount: 1,
    mediumCount: 1,
    lowCount: 1,
    filteredCount: 2,
    processedCount: 2,
    pendingCount: 1,
  });
});

test("proofreading detail helpers build left-rail issue markers with stable ordering and selection state", () => {
  const markers = buildProofreadingIssueMarkers({
    items: [
      {
        itemId: "issue-b",
        title: "第二处问题",
        severity: "high",
        targetText: "B",
        replacementText: "B1",
        anchor: {
          blockIndex: 3,
          quote: "B",
          sectionLabel: "结果",
        },
      },
      {
        itemId: "issue-a",
        title: "第一处问题",
        severity: "medium",
        targetText: "A",
        replacementText: "A1",
        anchor: {
          blockIndex: 1,
          quote: "A",
          sectionLabel: "摘要",
        },
      },
      {
        itemId: "issue-c",
        title: "第三处问题",
        severity: "low",
        targetText: "C",
        replacementText: "C1",
        anchor: {
          blockIndex: 3,
          quote: "C",
          sectionLabel: "结果",
        },
      },
    ],
    confirmationState: {
      "issue-b": {
        action: "accepted",
      },
    },
    proofreadingDocumentBlocks: [
      {
        blockId: "proofreading-block-0",
        blockIndex: 0,
        text: "block-0",
      },
      {
        blockId: "proofreading-block-3",
        blockIndex: 3,
        text: "block-3",
      },
    ],
    activeIssueId: "issue-c",
  });

  assert.equal(markers.length, 3);
  assert.deepEqual(markers[0], {
    itemId: "issue-a",
    title: "第一处问题",
    blockIndex: 1,
    sectionLabel: "摘要",
    severity: "medium",
    processed: false,
    selected: false,
    positionPercent: markers[0]?.positionPercent ?? 0,
    stackIndex: 0,
    stackCount: 1,
  });
  assert.ok(Math.abs((markers[0]?.positionPercent ?? 0) - 100 / 3) < 0.0001);
  assert.deepEqual(markers.slice(1), [
    {
      itemId: "issue-b",
      title: "第二处问题",
      blockIndex: 3,
      sectionLabel: "结果",
      severity: "high",
      processed: true,
      selected: false,
      positionPercent: 100,
      stackIndex: 0,
      stackCount: 2,
    },
    {
      itemId: "issue-c",
      title: "第三处问题",
      blockIndex: 3,
      sectionLabel: "结果",
      severity: "low",
      processed: false,
      selected: true,
      positionPercent: 100,
      stackIndex: 1,
      stackCount: 2,
    },
  ]);
});

test("proofreading detail helpers resolve the fallback block target for explicit block-view focusing", () => {
  const focusTarget = resolveProofreadingFallbackFocusTarget({
    proofreadingDocumentBlocks: [
      {
        blockId: "proofreading-block-0",
        blockIndex: 0,
        text: "block-0",
      },
      {
        blockId: "proofreading-block-3",
        blockIndex: 3,
        text: "block-3",
      },
    ],
    activeBlockIndex: 3,
  });

  assert.deepEqual(focusTarget, {
    blockId: "proofreading-block-3",
    blockIndex: 3,
  });
  assert.equal(
    resolveProofreadingFallbackFocusTarget({
      proofreadingDocumentBlocks: [
        {
          blockId: "proofreading-block-0",
          blockIndex: 0,
          text: "block-0",
        },
      ],
      activeBlockIndex: 9,
    }),
    null,
  );
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
