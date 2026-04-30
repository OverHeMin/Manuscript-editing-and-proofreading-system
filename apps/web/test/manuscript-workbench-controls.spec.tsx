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
        bindingEnabled: true,
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
        onBindingEnabledChange: () => {},
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
  assert.doesNotMatch(markup, /高级导入/u);
  assert.doesNotMatch(markup, /远程稿件地址（可选）/u);
  assert.doesNotMatch(markup, /远程导入/u);
  assert.match(markup, /已选择 2 个稿件/u);
  assert.match(markup, /人工确认稿件类型/u);
  assert.match(markup, /是否绑定模板/u);
  assert.match(markup, /通用包/u);
  assert.match(markup, /医用包/u);
  assert.match(markup, /深度校对/u);
  assert.match(markup, /期刊模板（小期刊\/场景）/u);
  assert.doesNotMatch(markup, /AI 识别稿件类型/u);
  assert.doesNotMatch(markup, /识别置信度/u);
  assert.doesNotMatch(markup, /存储键/u);
  assert.doesNotMatch(markup, /case-report\.docx/u);
  assert.doesNotMatch(markup, /case-report-supplement\.docx/u);
  assert.doesNotMatch(markup, /manuscript-workbench-controls-intro/);
  assert.doesNotMatch(markup, /manuscript-workbench-batch-drawer-trigger/);
  assert.doesNotMatch(markup, /manuscript-workbench-batch-slab-meta/);
});

test("full layout keeps only operator-facing AI readiness copy on the main page", () => {
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
  assert.match(markup, /稿件处理/u);
  assert.match(markup, /稿件编号/u);
  assert.doesNotMatch(markup, /稿件 ID/u);
  assert.doesNotMatch(markup, /治理动作/u);
  assert.match(markup, /AI 准备情况/u);
  assert.match(markup, /当前方式/u);
  assert.match(markup, /受控处理/u);
  assert.match(markup, /当前模板/u);
  assert.match(markup, /已按当前模板装载/u);
  assert.match(markup, /AI 状态/u);
  assert.match(markup, /需检查/u);
  assert.match(markup, /需要调整时前往系统设置/u);
  assert.doesNotMatch(markup, /执行上下文/u);
  assert.doesNotMatch(markup, /模型 ID/u);
  assert.doesNotMatch(markup, /路由策略/u);
  assert.doesNotMatch(markup, /模型来源/u);
  assert.doesNotMatch(markup, /运行时绑定/u);
  assert.doesNotMatch(markup, /服务商就绪/u);
  assert.doesNotMatch(markup, /运行时就绪/u);
  assert.doesNotMatch(markup, /model-editing-1/);
  assert.doesNotMatch(markup, /policy-editing-v2/);
  assert.doesNotMatch(markup, /template_family_policy/);
  assert.doesNotMatch(markup, /warning/);
  assert.doesNotMatch(markup, /degraded/);
  assert.doesNotMatch(markup, /name="provider"/);
  assert.doesNotMatch(markup, /name="temperature"/);
});

test("template selection warnings keep pending changes in operator language", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchControls
      mode="editing"
      busy={false}
      layout="drawer"
      showLookupPanel={false}
      lookup={{
        manuscriptId: "manuscript-1",
        onChange: () => {},
        onLoad: () => {},
      }}
      templateSelection={{
        title: "Journal Template",
        bindingEnabled: true,
        resolvedManuscriptTypeLabel: "Clinical Study",
        confidenceLabel: "High confidence",
        confidenceLevel: "high",
        requiresOperatorReview: false,
        showManualManuscriptTypeSelect: false,
        manualManuscriptTypeValue: "",
        manualManuscriptTypeOptions: [],
        baseTemplateLabel: "Clinical Study Family",
        selectedTemplateFamilyId: "family-clinical",
        templateFamilyOptions: [
          {
            value: "family-clinical",
            label: "Clinical Study Family",
          },
        ],
        selectedJournalTemplateId: "",
        currentAppliedLabel: "Base family only",
        hasPendingChange: true,
        options: [],
        onBindingEnabledChange: () => {},
        onTemplateFamilySelect: () => {},
        onSelect: () => {},
        onApply: () => {},
      }}
    />,
  );

  assert.match(markup, /已有未保存的模板切换，请先保存，再继续处理。/u);
  assert.doesNotMatch(markup, /治理动作/u);
});

test("template selection hides template menus when the operator chooses bare AI", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchControls
      mode="proofreading"
      busy={false}
      layout="drawer"
      showLookupPanel={false}
      lookup={{
        manuscriptId: "manuscript-1",
        onChange: () => {},
        onLoad: () => {},
      }}
      templateSelection={{
        title: "Journal Template",
        bindingEnabled: false,
        resolvedManuscriptTypeLabel: "Clinical Study",
        confidenceLabel: "人工选择",
        confidenceLevel: "high",
        requiresOperatorReview: false,
        showManualManuscriptTypeSelect: true,
        manualManuscriptTypeValue: "clinical_study",
        manualManuscriptTypeOptions: [
          {
            value: "clinical_study",
            label: "临床研究",
          },
        ],
        baseTemplateLabel: "Clinical Study Family",
        selectedTemplateFamilyId: "family-clinical",
        templateFamilyOptions: [
          {
            value: "family-clinical",
            label: "Clinical Study Family",
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
        onBindingEnabledChange: () => {},
        onManualManuscriptTypeSelect: () => {},
        onTemplateFamilySelect: () => {},
        onSelect: () => {},
        onApply: () => {},
      }}
    />,
  );

  assert.match(markup, /是否绑定模板/u);
  assert.match(markup, /bare AI/u);
  assert.doesNotMatch(markup, /人工确认稿件类型/u);
  assert.doesNotMatch(markup, /通用包/u);
  assert.doesNotMatch(markup, /医用包/u);
  assert.doesNotMatch(markup, /深度校对/u);
  assert.doesNotMatch(markup, /基础模板家族/u);
  assert.doesNotMatch(markup, /期刊模板（小期刊\/场景）/u);
});

test("module action panels expose only the primary execution action", () => {
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
        options: [
          {
            value: "asset-original-1",
            label: "original.docx · original · asset-original-1",
          },
        ],
        selectedContextLabel: "Selected Parent Asset",
        onSelect: () => {},
        onRun: () => {},
      }}
    />,
  );

  assert.match(markup, /执行初筛/u);
  assert.doesNotMatch(markup, /AI 自动处理（本次）/u);
  assert.doesNotMatch(markup, /AI识别/u);
  assert.match(markup, /data-secondary-action="hidden"/);
});

test("proofreading utilities keep result review entry owned by the result card", () => {
  const markup = renderToStaticMarkup(
    <ManuscriptWorkbenchControls
      mode="proofreading"
      busy={false}
      lookup={{
        manuscriptId: "manuscript-1",
        onChange: () => {},
        onLoad: () => {},
      }}
      utilities={{
        canExport: true,
        canRefreshLatestJob: true,
        canPublishHumanFinal: true,
        onExport: () => {},
        onRefreshLatestJob: () => {},
        onPublishHumanFinal: () => {},
      }}
    />,
  );

  assert.doesNotMatch(markup, /打开校对工作台/u);
  assert.doesNotMatch(markup, /在需要时打开校对工作台/u);
  assert.doesNotMatch(markup, /发布人工终稿/u);
  assert.match(markup, /导出当前文件/u);
  assert.match(markup, /刷新最新任务/u);
});
