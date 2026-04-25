import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildProofreadingConfirmationDraftState,
  buildEditingChangeLedgerEntries,
  buildEditingCompletionGateSummary,
  buildEditingDocumentBlocks,
  buildEditingGuardrailEntries,
  buildEditingSlotGovernanceSummary,
  buildProofreadingConfirmationItems,
  buildProofreadingDocumentBlocks,
  buildProofreadingIssueMarkers,
  buildProofreadingIssueSummary,
  buildScreeningDocumentBlocks,
  buildScreeningWorkspaceFocusItems,
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
    "screening_workspace",
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
      blockIndex: undefined,
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

test("editing slot governance helper extracts persisted slot summaries from job payload", () => {
  const summary = buildEditingSlotGovernanceSummary({
    payload: {
      slotGovernanceSummary: {
        observation_status: "reported",
        target_model_version_no: 2,
        unresolved_required_count: 1,
        blocking_slot_keys: ["author_line"],
        slots: [
          {
            slot_key: "author_line",
            label: "作者署名",
            required: true,
            enabled: true,
            zone: "front_matter",
            anchor: "after_title",
            completion_gate: "block_on_unresolved",
            state: "low_confidence_pending_review",
            resolution_reason: "候选存在但置信度不足。",
            candidate_count: 1,
            candidates: [
              {
                candidate_id: "author_line:1",
                slot_key: "author_line",
                raw_text: "张三, 李四",
                normalized_text: "张三, 李四",
                source_zone: "title_area",
                source_locator: "body:p:1",
                semantic_role: "author_line",
                confidence: 0.84,
                recommended_action: "move_to_target",
              },
            ],
          },
        ],
      },
    },
  } as never);

  assert.equal(summary?.target_model_version_no, 2);
  assert.deepEqual(summary?.blocking_slot_keys, ["author_line"]);
  assert.equal(summary?.slots[0]?.state, "low_confidence_pending_review");
});

test("editing completion gate helper extracts persisted gate summaries from job payload", () => {
  const summary = buildEditingCompletionGateSummary({
    payload: {
      editingCompletionGateSummary: {
        observation_status: "reported",
        verdict: "blocked_by_high_risk_objects",
        passed: false,
        blocker_count: 3,
        unresolved_required_slots: [],
        pending_manual_resolution_items: [
          {
            item_key: "manual:1",
            category: "manual_resolution",
            source: "manual_review_item",
            summary: "摘要目的仍需人工核对",
            detail: "AI 改写存在语义风险。",
            status: "pending",
          },
        ],
        high_risk_object_items: [
          {
            item_key: "object:1",
            category: "high_risk_object",
            source: "editing_guardrail",
            summary: "高风险对象待人工确认：图片对象",
            detail:
              "原始对象：图片对象 / drawing / rId5；提取证据：卡方检验符号图片；意图目标：χ²；降级原因：object_type_not_safe",
            location_text: "body:p:2",
            status: "pending",
          },
        ],
        table_high_risk_items: [
          {
            item_key: "table:1",
            category: "table_high_risk",
            source: "table_inspection_finding",
            summary: "表 1 三线表样式待人工确认",
            detail: "当前快照识别到表格结构，但仍需人工确认样式。",
            location_text: "结果表 1",
            status: "pending",
          },
        ],
        blocking_format_failures: [
          {
            item_key: "format:1",
            category: "blocking_format_failure",
            source: "table_patch_result",
            summary: "表 1 样式落稿被阻断",
            detail: "三线表样式改写当前仍不安全。",
            location_text: "结果表 1",
            status: "pending",
          },
        ],
      },
    },
  } as never);

  assert.equal(summary?.verdict, "blocked_by_high_risk_objects");
  assert.equal(summary?.blocker_count, 3);
  assert.equal(summary?.table_high_risk_items[0]?.item_key, "table:1");
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

test("editing detail helpers surface full-document blocks for the shared review workbench", () => {
  const blocks = buildEditingDocumentBlocks({
    payload: {
      editingSourceBlocks: [
        {
          blockIndex: 1,
          source_locator: "body:p:1",
          section: "作者信息",
          block_kind: "paragraph",
          text: "张三, 李四",
        },
        {
          blockIndex: 2,
          source_locator: "body:p:2",
          section: "结果",
          block_kind: "paragraph",
          text: "卡方检验结果见表 1。",
        },
      ],
    },
  } as never);

  assert.deepEqual(blocks, [
    {
      blockId: "editing-block-1",
      blockIndex: 1,
      sourceLocator: "body:p:1",
      sectionLabel: "作者信息",
      blockKind: "paragraph",
      text: "张三, 李四",
    },
    {
      blockId: "editing-block-2",
      blockIndex: 2,
      sourceLocator: "body:p:2",
      sectionLabel: "结果",
      blockKind: "paragraph",
      text: "卡方检验结果见表 1。",
    },
  ]);
});

test("screening detail helpers surface full-document blocks for the shared review workbench", () => {
  const blocks = buildScreeningDocumentBlocks({
    payload: {
      screeningSourceBlocks: [
        {
          section: "abstract",
          block_kind: "paragraph",
          text: "Abstract: Primary endpoint definition is incomplete.",
        },
        {
          section: "results",
          block_kind: "paragraph",
          text: "Results: Table labels should be normalized.",
        },
      ],
    },
  } as never);

  assert.deepEqual(blocks, [
    {
      blockId: "screening-block-0",
      blockIndex: 0,
      sectionLabel: "abstract",
      blockKind: "paragraph",
      text: "Abstract: Primary endpoint definition is incomplete.",
    },
    {
      blockId: "screening-block-1",
      blockIndex: 1,
      sectionLabel: "results",
      blockKind: "paragraph",
      text: "Results: Table labels should be normalized.",
    },
  ]);
});

test("screening detail page renders the shared review workbench with risks and evidence summary", () => {
  const screeningJob = {
    payload: {
      screeningReport: {
        summary: "主要终点定义不完整，需要进一步人工判断。",
        riskLevel: "high",
        recommendedDecision: "major_revision",
        majorFindings: ["Primary endpoint definition is incomplete."],
        minorFindings: ["Table labels should be normalized."],
      },
      screeningSourceBlocks: [
        {
          section: "abstract",
          block_kind: "paragraph",
          text: "Primary endpoint definition is incomplete.",
        },
        {
          section: "results",
          block_kind: "paragraph",
          text: "Table labels should be normalized.",
        },
      ],
      qualityFindingSummary: {
        total_issue_count: 2,
        highest_action: "manual_review",
      },
      qualityFindings: [
        {
          issue_id: "screening-quality-1",
          issue_type: "medical_logic.primary_endpoint",
          severity: "high",
          action: "manual_review",
          paragraph_index: 0,
          text_excerpt: "Primary endpoint definition is incomplete.",
          explanation: "主要终点定义需要人工核对。",
          summary: "主要终点定义不完整",
          source_id: "medical/primary-endpoint",
        },
      ],
    },
  } as never;
  const screeningBlocks = buildScreeningDocumentBlocks(screeningJob);
  const screeningFocusItems = buildScreeningWorkspaceFocusItems({
    job: screeningJob,
    documentBlocks: screeningBlocks,
  });

  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchAssetDetailPage
      mode="screening"
      manuscriptTitle="肿瘤临床稿"
      asset={{
        id: "asset-screening-1",
        manuscript_id: "manuscript-1",
        asset_type: "screening_report",
        status: "active",
        storage_key: "runs/screening/report.md",
        mime_type: "text/markdown",
        source_module: "screening",
        created_by: "screener-1",
        version_no: 2,
        is_current: true,
        file_name: "screening-report.md",
        created_at: "2026-04-25T09:00:00.000Z",
        updated_at: "2026-04-25T09:05:00.000Z",
      }}
      detailKind="screening_workspace"
      backHref="#screening?manuscriptId=manuscript-1"
      downloadHref="http://localhost/api/v1/document-assets/asset-screening-1/download"
      screeningDocumentBlocks={screeningBlocks}
      screeningWorkspaceFocusItems={screeningFocusItems}
    />,
  );

  assert.match(markup, /data-detail-kind="screening_workspace"/);
  assert.match(markup, /data-screening-layout="shared-review"/);
  assert.match(markup, /初筛共享审阅工作台/u);
  assert.match(markup, /稿件全文/u);
  assert.match(markup, /风险与建议/u);
  assert.match(markup, /风险等级/u);
  assert.match(markup, /建议结论/u);
  assert.match(markup, /证据摘要/u);
  assert.match(markup, /高风险/u);
  assert.match(markup, /medical_logic\.primary_endpoint/u);
  assert.match(markup, /Primary endpoint definition is incomplete\./u);
  assert.match(markup, /下载初筛报告/u);
  assert.doesNotMatch(markup, /screening-report\.md/u);
});

test("screening workspace focus items preserve actionable summaries for quality findings", () => {
  const focusItems = buildScreeningWorkspaceFocusItems({
    job: {
      payload: {
        screeningReport: {
          summary: "主要终点定义不完整，需要进一步人工判断。",
          riskLevel: "high",
          recommendedDecision: "major_revision",
        },
        qualityFindings: [
          {
            issue_id: "screening-quality-1",
            issue_type: "medical_logic.primary_endpoint",
            severity: "high",
            action: "manual_review",
            paragraph_index: 0,
            text_excerpt: "Primary endpoint definition is incomplete.",
            explanation: "主要终点定义需要人工核对。",
            summary: "主要终点定义不完整",
            source_id: "medical/primary-endpoint",
          },
        ],
      },
    } as never,
    documentBlocks: [
      {
        blockId: "screening-block-0",
        blockIndex: 0,
        sectionLabel: "abstract",
        blockKind: "paragraph",
        text: "Primary endpoint definition is incomplete.",
      },
    ],
  });

  const findingItem = focusItems.find((item) => item.id === "screening-quality-1");
  assert.equal(findingItem?.summary, "主要终点定义需要人工核对。");
  assert.equal(findingItem?.locationLabel, "段落 0");
  assert.equal(findingItem?.blockIndex, 0);
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

test("editing detail page renders slot governance blockers and candidate origins", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchAssetDetailPage
      mode="editing"
      manuscriptTitle="前置信息治理稿件"
      asset={{
        id: "asset-edited-slot-1",
        manuscript_id: "manuscript-1",
        asset_type: "edited_docx",
        status: "active",
        storage_key: "runs/editing/slot.docx",
        mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        source_module: "editing",
        created_by: "editor-1",
        version_no: 2,
        is_current: true,
        file_name: "editing-slot.docx",
        created_at: "2026-04-24T09:00:00.000Z",
        updated_at: "2026-04-24T09:05:00.000Z",
      }}
      detailKind="document_preview"
      backHref="#editing?manuscriptId=manuscript-1"
      downloadHref="http://localhost/api/v1/document-assets/asset-edited-slot-1/download"
      editingSlotSummary={{
        observation_status: "reported",
        journal_template_id: "journal-1",
        target_model_version_id: "journal-1-v2",
        target_model_version_no: 2,
        generated_at: "2026-04-24T09:00:00.000Z",
        unresolved_required_count: 1,
        blocking_slot_keys: ["author_line"],
        slots: [
          {
            slot_key: "author_line",
            label: "作者署名",
            required: true,
            enabled: true,
            zone: "front_matter",
            anchor: "after_title",
            completion_gate: "block_on_unresolved",
            state: "low_confidence_pending_review",
            resolution_reason: "候选存在但置信度不足，不能直接自动落位。",
            candidate_count: 1,
            candidates: [
              {
                candidate_id: "candidate-author-1",
                slot_key: "author_line",
                raw_text: "张三, 李四",
                normalized_text: "张三, 李四",
                source_zone: "title_area",
                source_locator: "body:p:1",
                semantic_role: "author_line",
                confidence: 0.84,
                recommended_action: "move_to_target",
              },
            ],
          },
          {
            slot_key: "classification_code",
            label: "中图分类号",
            required: false,
            enabled: true,
            zone: "keywords",
            anchor: "after_keywords",
            completion_gate: "warn_only",
            state: "resolved_manual",
            resolution_reason: "已回放人工槽位裁决。",
            resolved_text: "R541.4",
            candidate_count: 0,
            candidates: [],
            manual_resolution: {
              slot_key: "classification_code",
              resolution_kind: "manual_entry",
              resolved_text: "R541.4",
            },
          },
        ],
      }}
    />,
  );

  assert.match(markup, /前置信息槽位/u);
  assert.match(markup, /阻断槽位/u);
  assert.match(markup, /author_line/u);
  assert.match(markup, /作者署名 · 低置信待核对/u);
  assert.match(markup, /body:p:1/u);
  assert.match(markup, /中图分类号 · 人工解决/u);
  assert.match(markup, /R541\.4/u);
});

test("editing detail page renders explicit completion gate blocker sections", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchAssetDetailPage
      mode="editing"
      manuscriptTitle="编辑门禁稿件"
      asset={{
        id: "asset-edited-gate-1",
        manuscript_id: "manuscript-1",
        asset_type: "edited_docx",
        status: "active",
        storage_key: "runs/editing/gate.docx",
        mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        source_module: "editing",
        created_by: "editor-1",
        version_no: 2,
        is_current: true,
        file_name: "editing-gate.docx",
        created_at: "2026-04-24T09:00:00.000Z",
        updated_at: "2026-04-24T09:05:00.000Z",
      }}
      detailKind="document_preview"
      backHref="#editing?manuscriptId=manuscript-1"
      downloadHref="http://localhost/api/v1/document-assets/asset-edited-gate-1/download"
      editingCompletionGateSummary={{
        observation_status: "reported",
        verdict: "blocked_by_high_risk_objects",
        passed: false,
        blocker_count: 4,
        target_model_version_no: 2,
        unresolved_required_slots: [],
        pending_manual_resolution_items: [
          {
            item_key: "manual:1",
            category: "manual_resolution",
            source: "manual_review_item",
            summary: "摘要目的仍需人工核对",
            detail: "AI 改写存在语义风险。",
            status: "pending",
          },
        ],
        high_risk_object_items: [
          {
            item_key: "object:1",
            category: "high_risk_object",
            source: "editing_guardrail",
            summary: "高风险对象待人工确认：图片对象",
            detail:
              "原始对象：图片对象 / drawing / rId5；提取证据：卡方检验符号图片；意图目标：χ²；降级原因：object_type_not_safe",
            location_text: "body:p:2",
            status: "pending",
          },
        ],
        table_high_risk_items: [
          {
            item_key: "table:1",
            category: "table_high_risk",
            source: "table_inspection_finding",
            summary: "表 1 三线表样式待人工确认",
            detail: "当前快照识别到表格结构，但仍需人工确认样式。",
            location_text: "结果表 1",
            status: "pending",
          },
        ],
        blocking_format_failures: [
          {
            item_key: "format:1",
            category: "blocking_format_failure",
            source: "table_patch_result",
            summary: "表 1 样式落稿被阻断",
            detail: "三线表样式改写当前仍不安全。",
            location_text: "结果表 1",
            status: "pending",
          },
        ],
      }}
    />,
  );

  assert.match(markup, /编辑完成门禁/u);
  assert.match(markup, /被高风险对象\/表格\/格式阻断/u);
  assert.match(markup, /人工处理项/u);
  assert.match(markup, /高风险对象/u);
  assert.match(markup, /原始对象：图片对象 \/ drawing \/ rId5/u);
  assert.match(markup, /提取证据：卡方检验符号图片/u);
  assert.match(markup, /意图目标：χ²/u);
  assert.match(markup, /降级原因：object_type_not_safe/u);
  assert.match(markup, /表格高风险项/u);
  assert.match(markup, /格式阻断项/u);
  assert.match(markup, /摘要目的仍需人工核对/u);
  assert.match(markup, /表 1 三线表样式待人工确认/u);
  assert.match(markup, /表 1 样式落稿被阻断/u);
});

test("editing detail page exposes manual slot resolution actions when save callbacks are available", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchAssetDetailPage
      mode="editing"
      manuscriptTitle="前置信息治理稿件"
      asset={{
        id: "asset-edited-slot-action-1",
        manuscript_id: "manuscript-1",
        asset_type: "edited_docx",
        status: "active",
        storage_key: "runs/editing/slot-action.docx",
        mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        source_module: "editing",
        created_by: "editor-1",
        version_no: 2,
        is_current: true,
        file_name: "editing-slot-action.docx",
        created_at: "2026-04-24T09:00:00.000Z",
        updated_at: "2026-04-24T09:05:00.000Z",
      }}
      detailKind="document_preview"
      backHref="#editing?manuscriptId=manuscript-1"
      downloadHref="http://localhost/api/v1/document-assets/asset-edited-slot-action-1/download"
      editingSlotSummary={{
        observation_status: "reported",
        journal_template_id: "journal-1",
        target_model_version_id: "journal-1-v2",
        target_model_version_no: 2,
        generated_at: "2026-04-24T09:00:00.000Z",
        unresolved_required_count: 1,
        blocking_slot_keys: ["author_line"],
        slots: [
          {
            slot_key: "author_line",
            label: "作者署名",
            required: true,
            enabled: true,
            zone: "front_matter",
            anchor: "after_title",
            completion_gate: "block_on_unresolved",
            state: "conflicted_candidates",
            resolution_reason: "识别到 2 个冲突候选，需人工裁决。",
            candidate_count: 2,
            candidates: [
              {
                candidate_id: "candidate-author-1",
                slot_key: "author_line",
                raw_text: "张三, 李四",
                normalized_text: "张三, 李四",
                source_zone: "title_area",
                source_locator: "body:p:1",
                semantic_role: "author_line",
                confidence: 0.88,
                recommended_action: "move_to_target",
              },
            ],
          },
        ],
      }}
      onEditingSlotSave={() => {}}
    />,
  );

  assert.match(markup, /采用此候选/u);
  assert.match(markup, /人工录入内容/u);
  assert.match(markup, /保存人工录入/u);
  assert.match(markup, /标记为豁免/u);
});

test("editing detail page renders the shared review workspace with full text on the left and issues on the right", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchAssetDetailPage
      mode="editing"
      manuscriptTitle="编辑共享审阅稿件"
      asset={{
        id: "asset-edited-review-1",
        manuscript_id: "manuscript-1",
        asset_type: "edited_docx",
        status: "active",
        storage_key: "runs/editing/review.docx",
        mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        source_module: "editing",
        created_by: "editor-1",
        version_no: 2,
        is_current: true,
        file_name: "editing-review.docx",
        created_at: "2026-04-24T09:00:00.000Z",
        updated_at: "2026-04-24T09:05:00.000Z",
      }}
      detailKind="document_preview"
      backHref="#editing?manuscriptId=manuscript-1"
      downloadHref="http://localhost/api/v1/document-assets/asset-edited-review-1/download"
      editingDocumentBlocks={[
        {
          blockId: "editing-block-1",
          blockIndex: 1,
          sourceLocator: "body:p:1",
          sectionLabel: "作者信息",
          blockKind: "paragraph",
          text: "张三, 李四",
        },
        {
          blockId: "editing-block-2",
          blockIndex: 2,
          sourceLocator: "body:p:2",
          sectionLabel: "结果",
          blockKind: "paragraph",
          text: "卡方检验结果见表 1。",
        },
      ]}
      changeLedger={[
        {
          id: "change-1",
          sourceLabel: "rule-author-layout",
          before: "张三, 李四",
          after: "张三^1, 李四^2",
          locationText: "body:p:1",
          blockIndex: 1,
        },
      ]}
      editingGuardrails={[
        {
          id: "guardrail-1",
          sourceStage: "docx_transform",
          reasonCode: "object_type_not_safe",
          excerpt: "卡方检验符号图片",
        },
      ]}
      editingSlotSummary={{
        observation_status: "reported",
        target_model_version_no: 2,
        unresolved_required_count: 1,
        blocking_slot_keys: ["author_line"],
        slots: [
          {
            slot_key: "author_line",
            label: "作者署名",
            required: true,
            enabled: true,
            zone: "front_matter",
            anchor: "after_title",
            completion_gate: "block_on_unresolved",
            state: "low_confidence_pending_review",
            resolution_reason: "候选存在但置信度不足，需人工确认。",
            candidate_count: 1,
            candidates: [
              {
                candidate_id: "candidate-author-1",
                slot_key: "author_line",
                raw_text: "张三, 李四",
                normalized_text: "张三, 李四",
                source_zone: "title_area",
                source_locator: "body:p:1",
                semantic_role: "author_line",
                confidence: 0.84,
                recommended_action: "move_to_target",
              },
            ],
          },
        ],
      }}
      editingCompletionGateSummary={{
        observation_status: "reported",
        verdict: "blocked_by_high_risk_objects",
        passed: false,
        blocker_count: 2,
        target_model_version_no: 2,
        unresolved_required_slots: [],
        pending_manual_resolution_items: [],
        high_risk_object_items: [
          {
            item_key: "object:1",
            category: "high_risk_object",
            source: "editing_guardrail",
            summary: "高风险对象待人工确认：图片对象",
            detail: "卡方检验符号图片仍需人工核对。",
            location_text: "body:p:2",
            status: "pending",
          },
        ],
        table_high_risk_items: [],
        blocking_format_failures: [],
      }}
      executionSnapshot={{
        id: "snapshot-editing-review-1",
        manuscript_id: "manuscript-1",
        module: "editing",
        job_id: "job-editing-review-1",
        execution_profile_id: "execution-profile-editing-1",
        module_template_id: "template-editing-1",
        module_template_version_no: 1,
        prompt_template_id: "prompt-editing-1",
        prompt_template_version: "v1",
        skill_package_ids: [],
        skill_package_versions: [],
        model_id: "gpt-5.4",
        quality_packages: [],
        knowledge_item_ids: [],
        created_asset_ids: ["asset-edited-review-1"],
        created_at: "2026-04-24T09:00:00.000Z",
        agent_execution: {
          observation_status: "not_linked",
        },
        runtime_binding_readiness: {
          observation_status: "failed_open",
          error: "not used",
        },
      }}
      knowledgeHitLogs={[]}
    />,
  );

  assert.match(markup, /data-editing-layout="shared-review"/);
  assert.match(markup, /编辑共享审阅工作台/u);
  assert.match(markup, /左全文右问题的编辑审阅台/u);
  assert.match(markup, /稿件全文/u);
  assert.match(markup, /问题与台账/u);
  assert.match(markup, /张三, 李四/u);
  assert.match(markup, /卡方检验结果见表 1/u);
  assert.match(markup, /槽位 · 作者署名/u);
  assert.match(markup, /门禁 · 高风险对象待人工确认：图片对象/u);
  assert.match(markup, /拦截 · 对象类型不安全（object_type_not_safe）/u);
  assert.match(markup, /改动 · rule-author-layout/u);
  assert.match(markup, /前置信息槽位/u);
  assert.match(markup, /编辑完成门禁/u);
  assert.match(markup, /改动台账/u);
  assert.match(markup, /自动改动被拦截/u);
  assert.match(markup, /治理命中依据/u);
});
