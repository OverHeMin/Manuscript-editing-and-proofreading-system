import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ManuscriptWorkbenchControls } from "../src/features/manuscript-workbench/manuscript-workbench-controls.tsx";

test("drawer layout surfaces intake controls without extra intro scaffolding above them", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchControls
      mode="proofreading"
      busy={false}
      layout="drawer"
      showLookupPanel={false}
      intake={{
        uploadForm: {
          title: "Neurology case review",
          createdBy: "web-workbench",
          fileName: "case-report.docx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          fileContentBase64: "SGVsbG8=",
        },
        attachedFileCount: 2,
        attachedFileNames: ["case-report.docx", "case-report-supplement.docx"],
        canSubmit: true,
        onTitleChange: () => {},
        onStorageKeyChange: () => {},
        onFilesSelect: () => {},
        onSubmit: () => {},
      }}
      lookup={{
        manuscriptId: "manuscript-1",
        onChange: () => {},
        onLoad: () => {},
      }}
      templateSelection={{
        title: "Journal Template",
        resolvedManuscriptTypeLabel: "Clinical Study",
        confidenceLabel: "Low confidence",
        confidenceLevel: "low",
        requiresOperatorReview: true,
        showManualManuscriptTypeSelect: true,
        manualManuscriptTypeValue: "clinical_study",
        manualManuscriptTypeOptions: [
          {
            value: "clinical_study",
            label: "临床研究",
          },
          {
            value: "review",
            label: "综述",
          },
        ],
        baseTemplateLabel: "Clinical Study Family",
        selectedTemplateFamilyId: "family-clinical",
        templateFamilyOptions: [
          {
            value: "family-clinical",
            label: "Clinical Study Family",
          },
          {
            value: "family-review",
            label: "Review Family",
          },
        ],
        selectedJournalTemplateId: "",
        currentAppliedLabel: "Base family only",
        hasPendingChange: false,
        options: [
          {
            value: "journal-template-1",
            label: "Journal Template One",
          },
        ],
        onManualManuscriptTypeSelect: () => {},
        onTemplateFamilySelect: () => {},
        onSelect: () => {},
        onApply: () => {},
      }}
      utilities={{
        canExport: true,
        canRefreshLatestJob: true,
        onExport: () => {},
        onRefreshLatestJob: () => {},
      }}
    />,
  );

  assert.match(markup, /manuscript-workbench-controls--drawer/);
  assert.match(markup, /type="file"/);
  assert.match(markup, /multiple/);
  assert.match(markup, /上传稿件/u);
  assert.match(markup, /data-dropzone="manuscript-upload"/);
  assert.match(markup, /拖拽稿件到这里/u);
  assert.match(markup, /人工确认稿件类型/u);
  assert.match(markup, /期刊模板（小期刊\/场景）/u);
  assert.match(markup, /低置信度时请先人工确认稿件类型/u);
  assert.doesNotMatch(markup, /manuscript-workbench-controls-intro/);
  assert.doesNotMatch(markup, /manuscript-workbench-batch-drawer-trigger/);
  assert.doesNotMatch(markup, /manuscript-workbench-batch-slab-meta/);
});

test("full layout keeps execution context read only with localized execution status copy", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchControls
      mode="editing"
      busy={false}
      lookup={{
        manuscriptId: "manuscript-1",
        onChange: () => {},
        onLoad: () => {},
      }}
      executionContext={{
        mode: "editing",
        executionProfileId: "profile-editing-1",
        modelRoutingPolicyVersionId: "policy-editing-v2",
        resolvedModelId: "model-editing-1",
        modelSource: "template_family_policy",
        providerReadinessStatus: "warning",
        runtimeBindingReadinessStatus: "degraded",
      }}
    />,
  );

  assert.match(markup, /data-execution-context="readonly"/);
  assert.match(markup, /data-execution-mode="editing"/);
  assert.match(markup, /AI 接入/u);
  assert.match(markup, /model-editing-1/);
  assert.match(markup, /policy-editing-v2/);
  assert.match(markup, /模板族策略/u);
  assert.match(markup, /需关注/u);
  assert.match(markup, /已降级/u);
  assert.doesNotMatch(markup, /template_family_policy/);
  assert.doesNotMatch(markup, /warning/);
  assert.doesNotMatch(markup, /degraded/);
  assert.doesNotMatch(markup, /name="provider"/);
  assert.doesNotMatch(markup, /name="temperature"/);
});

test("module action panels expose a one-time bare AI secondary action without changing the primary governed action", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchControls
      mode="screening"
      busy={false}
      lookup={{
        manuscriptId: "manuscript-1",
        onChange: () => {},
        onLoad: () => {},
      }}
      moduleAction={{
        title: "Screening Run",
        selectedAssetId: "asset-original-1",
        emptyLabel: "请选择资产",
        actionLabel: "Run Screening",
        secondaryActionLabel: "Run Bare AI Once",
        options: [
          {
            value: "asset-original-1",
            label: "original.docx · original · asset-original-1",
          },
        ],
        selectedContextLabel: "Selected Parent Asset",
        onSelect: () => {},
        onRun: () => {},
        onSecondaryRun: () => {},
      }}
    />,
  );

  assert.match(markup, /执行初筛/u);
  assert.match(markup, /AI 自动处理（本次）/u);
  assert.match(markup, /data-secondary-action="available"/);
});
