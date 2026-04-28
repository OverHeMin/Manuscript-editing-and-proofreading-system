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
  TemplateGovernanceRuleWizardStepSemantic,
} = await import("../src/features/template-governance/template-governance-rule-wizard-step-semantic.tsx");
const {
  createRuleWizardAiParsingInput,
  createRuleDraftInput,
  createRuleDraftContentBlocks,
  createRuleWizardBindingFormState,
  createRuleWizardEntryFormState,
  createRuleWizardEntryFormStateFromDetail,
  createRuleWizardBindingInputs,
  createRuleWizardEvidenceGateSummary,
  createRuleWizardSemanticViewModel,
  confirmSemanticLayerInput,
  loadRuleWizardBindingOptions,
  parseRuleWizardManualRuleWithAi,
  saveRuleWizardEntryDraft,
} = await import("../src/features/template-governance/template-governance-rule-wizard-api.ts");

test("rule wizard entry step keeps entry controls without teaching copy", () => {
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

  assert.match(markup, /基础录入与证据补充/u);
  assert.match(markup, /规则名称/u);
  assert.match(markup, /规则正文/u);
  assert.match(markup, /正例示例/u);
  assert.match(markup, /来源依据/u);
  assert.match(markup, /图片 \/ 图表 \/ 截图/u);
  assert.match(markup, /展开高级标签/u);
  assert.doesNotMatch(markup, /这版向导只开放高频治理参数/u);
  assert.doesNotMatch(markup, /低频高级项也在当前规则中心完成/u);
  assert.doesNotMatch(markup, /适用模块决定规则在哪个执行环节被调用/u);
  assert.doesNotMatch(markup, /章节标签和风险标签放到高级标签里补充/u);
  assert.doesNotMatch(markup, /打开旧版高级工作台/u);
});

test("rule wizard confirm step keeps semantic confirmation controls", () => {
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
    />,
  );

  assert.match(markup, /人工确认 AI 结果/u);
  assert.match(markup, /一键采纳高置信结果/u);
  assert.match(markup, /规则类型判断/u);
  assert.match(markup, /风险等级判断/u);
  assert.match(markup, /业务适用范围/u);
  assert.match(markup, /人工确认/u);
  assert.match(markup, /语义摘要/u);
  assert.match(markup, /检索词/u);
  assert.doesNotMatch(markup, /规则类型决定这条规则按什么治理判断复用/u);
  assert.doesNotMatch(markup, /风险等级决定后续审核和发布要多谨慎/u);
  assert.doesNotMatch(markup, /稿件类型填写这条规则默认命中的稿件范围/u);
});

test("rule wizard confirm step uses structured manuscript-type and retrieval-term controls", () => {
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
      entryFormState={createRuleWizardEntryFormState({
        title: "Clinical rule title",
        moduleScope: "editing",
        manuscriptTypes: ["clinical_study", "review"],
        sourceType: "guideline",
        contributor: "editor.zh",
        ruleBody: "Clinical rule body",
        positiveExample: "",
        negativeExample: "",
        imageEvidence: "",
        sourceBasis: "",
        advancedTagsExpanded: false,
        sections: "",
        riskTags: "terminology, abbreviation",
        packageHints: "",
        candidateOnly: false,
        conflictNotes: "",
      })}
    />,
  );

  assert.match(markup, /data-rule-wizard-multi-select="confirm-manuscript-types"/u);
  assert.match(markup, /data-searchable-multi-select-input="confirm-manuscript-types"/u);
  assert.match(markup, /placeholder="\u641c\u7d22\u7a3f\u4ef6\u7c7b\u578b"/u);
  assert.doesNotMatch(markup, /\u93bc\u6ec5\u50a8\u7ecb\u5938\u6b22/u);
  assert.match(markup, /data-rule-wizard-tag-list="confirm-retrieval-terms"/u);
  assert.match(markup, /data-rule-wizard-tag-action="add-confirm-retrieval-term"/u);
  assert.doesNotMatch(markup, /placeholder="clinical_study, review"/u);
  assert.doesNotMatch(markup, /placeholder="clinical_study, review"/u);
});

test("rule wizard binding and publish steps keep package and release controls", () => {
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

  assert.match(bindingMarkup, /放入模板 \/ 规则包/u);
  assert.match(bindingMarkup, /进入哪个规则包/u);
  assert.match(bindingMarkup, /规则包条目/u);
  assert.match(bindingMarkup, /关联模板族/u);
  assert.match(bindingMarkup, /直绑期刊模板/u);
  assert.match(bindingMarkup, /关联知识条目/u);
  assert.match(publishMarkup, /保存与发布/u);
  assert.match(publishMarkup, /当前规则包/u);
  assert.match(publishMarkup, /发布方式/u);
  assert.match(publishMarkup, /保存草稿/u);
  assert.match(publishMarkup, /提交审核/u);
  assert.match(publishMarkup, /直接发布/u);
  assert.doesNotMatch(bindingMarkup, /规则包决定这条规则先落到哪个复用容器/u);
  assert.doesNotMatch(bindingMarkup, /模板族决定哪些稿件默认看见这条规则/u);
  assert.doesNotMatch(bindingMarkup, /复用策略只处理挂到现有包还是新建绑定/u);
  assert.doesNotMatch(publishMarkup, /保存草稿适合先留给当前编辑人继续补充/u);
  assert.doesNotMatch(publishMarkup, /提交审核会进入规则治理审核队列/u);
  assert.doesNotMatch(publishMarkup, /直接发布只适合已经确认无误的场景/u);
});

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

  assert.match(markup, /规则草稿向导/u);
  assert.match(markup, /带入候选/u);
  assert.match(markup, /整理草稿/u);
  assert.match(markup, /确认规则意图/u);
  assert.match(markup, /绑定适用范围/u);
  assert.match(markup, /提交发布/u);
  assert.match(markup, /下一步：整理草稿/u);
  assert.match(markup, /返回规则台账/u);
  assert.match(markup, /保存草稿/u);
  assert.match(markup, /完成并返回规则中心/u);
  assert.match(markup, /录入画布/u);
  assert.match(markup, /规则正文/u);
  assert.match(markup, /正例示例/u);
  assert.match(markup, /反例示例/u);
  assert.match(markup, /图片 \/ 图表 \/ 截图/u);
  assert.match(markup, /来源依据/u);
  assert.match(markup, /展开高级标签/u);
  assert.match(markup, /添加补充文字/u);
  assert.match(markup, /添加表格/u);
  assert.match(markup, /添加图片或截图/u);
  assert.doesNotMatch(markup, /先带入候选并整理规则草稿/u);
  assert.doesNotMatch(markup, /当前步骤聚焦/u);
  assert.doesNotMatch(markup, /AI 辅助提示/u);
  assert.doesNotMatch(markup, /按块组织正文/u);
  assert.doesNotMatch(markup, /表格支持直接粘贴 Excel/u);
  assert.doesNotMatch(markup, /如果只想补充图注/u);
  assert.doesNotMatch(markup, /还没有证据材料，可以先添加/u);
});

test("rule wizard entry form state normalizes advanced tags into structured selections", () => {
  const state = createRuleWizardEntryFormState({
    manuscriptTypes: "clinical_study, review",
    sections: "abstract, discussion",
    riskTags: "terminology, consistency",
    packageHints: "general-package, medical-package",
  });

  assert.deepEqual(state.manuscriptTypes, ["clinical_study", "review"]);
  assert.deepEqual(state.sections, ["abstract", "discussion"]);
  assert.deepEqual(state.riskTags, ["terminology", "consistency"]);
  assert.deepEqual(state.packageHints, ["general-package", "medical-package"]);
});

test("rule wizard entry step renders structured advanced routing controls", () => {
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
      entryFormState={createRuleWizardEntryFormState({
        advancedTagsExpanded: true,
      })}
    />,
  );

  assert.match(markup, /data-rule-wizard-multi-select="manuscript-types"/u);
  assert.match(markup, /data-rule-wizard-multi-select="sections"/u);
  assert.match(markup, /data-searchable-multi-select-input="manuscript-types"/u);
  assert.match(markup, /data-searchable-multi-select-input="sections"/u);
  assert.match(markup, /placeholder="搜索稿件类型"/u);
  assert.match(markup, /placeholder="搜索章节标签"/u);
  assert.match(markup, /data-rule-wizard-tag-list="risk-tags"/u);
  assert.match(markup, /data-rule-wizard-tag-list="package-hints"/u);
  assert.doesNotMatch(markup, /placeholder="abstract, discussion"/u);
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

test("rule wizard preserves uploaded images and table blocks when creating content blocks", () => {
  assert.deepEqual(
    createRuleDraftContentBlocks(
      createRuleWizardEntryFormState({
        title: "图表规范",
        moduleScope: "editing",
        manuscriptTypes: "clinical_study",
        sourceType: "guideline",
        contributor: "editor.zh",
        ruleBody: "表格与图片需要保留可核查证据。",
        positiveExample: "图 1 需要保留完整标题。",
        negativeExample: "缺失表题或只保留截图备注。",
        imageEvidence: "",
        sourceBasis: "期刊模板要求保留图表上下文。",
        advancedTagsExpanded: false,
        sections: "",
        riskTags: "",
        packageHints: "",
        candidateOnly: false,
        conflictNotes: "",
        supplementalBlocks: [
          {
            id: "table-block-1",
            revision_id: "knowledge-1-revision-2",
            block_type: "table_block",
            order_no: 0,
            status: "active",
            content_payload: {
              rows: [
                ["字段", "要求"],
                ["表题", "位于表上"],
              ],
            },
          },
          {
            id: "image-block-1",
            revision_id: "knowledge-1-revision-2",
            block_type: "image_block",
            order_no: 1,
            status: "active",
            content_payload: {
              upload_id: "upload-1",
              storage_key: "knowledge/rule-image-1.png",
              file_name: "rule-image-1.png",
              mime_type: "image/png",
              byte_length: 2048,
              caption: "图 1 保留完整图题与脚注",
            },
          },
        ],
      }),
      "knowledge-1-revision-2",
    ),
    [
      {
        id: "rule-entry-1",
        revision_id: "knowledge-1-revision-2",
        block_type: "text_block",
        order_no: 0,
        status: "active",
        content_payload: {
          label: "规则正文",
          text: "表格与图片需要保留可核查证据。",
        },
      },
      {
        id: "rule-entry-2",
        revision_id: "knowledge-1-revision-2",
        block_type: "text_block",
        order_no: 1,
        status: "active",
        content_payload: {
          label: "正例示例",
          text: "图 1 需要保留完整标题。",
        },
      },
      {
        id: "rule-entry-3",
        revision_id: "knowledge-1-revision-2",
        block_type: "text_block",
        order_no: 2,
        status: "active",
        content_payload: {
          label: "反例示例",
          text: "缺失表题或只保留截图备注。",
        },
      },
      {
        id: "rule-entry-4",
        revision_id: "knowledge-1-revision-2",
        block_type: "text_block",
        order_no: 3,
        status: "active",
        content_payload: {
          label: "来源依据",
          text: "期刊模板要求保留图表上下文。",
        },
      },
      {
        id: "table-block-1",
        revision_id: "knowledge-1-revision-2",
        block_type: "table_block",
        order_no: 4,
        status: "active",
        content_payload: {
          rows: [
            ["字段", "要求"],
            ["表题", "位于表上"],
          ],
        },
      },
      {
        id: "image-block-1",
        revision_id: "knowledge-1-revision-2",
        block_type: "image_block",
        order_no: 5,
        status: "active",
        content_payload: {
          upload_id: "upload-1",
          storage_key: "knowledge/rule-image-1.png",
          file_name: "rule-image-1.png",
          mime_type: "image/png",
          byte_length: 2048,
          caption: "图 1 保留完整图题与脚注",
        },
      },
    ],
  );
});

test("rule wizard can hydrate an existing rule detail back into editable entry fields", () => {
  const form = createRuleWizardEntryFormStateFromDetail({
    asset: {
      id: "knowledge-asset-1",
      status: "active",
      current_revision_id: "knowledge-revision-2",
      current_approved_revision_id: "knowledge-revision-1",
      contributor_label: "editor.zh",
      created_at: "2026-04-15T08:00:00.000Z",
      updated_at: "2026-04-16T09:00:00.000Z",
    },
    selected_revision: {
      id: "knowledge-revision-2",
      asset_id: "knowledge-asset-1",
      revision_no: 2,
      status: "draft",
      title: "图表引用完整性",
      canonical_text: "图表需要保留完整标题、单位和来源。",
      summary: "保证图表证据可核查。",
      knowledge_kind: "rule",
      routing: {
        module_scope: "editing",
        manuscript_types: ["clinical_study"],
        sections: ["results"],
        risk_tags: ["table", "image"],
      },
      source_type: "guideline",
      content_blocks: [
        {
          id: "block-1",
          revision_id: "knowledge-revision-2",
          block_type: "text_block",
          order_no: 0,
          status: "active",
          content_payload: {
            label: "规则正文",
            text: "图表需要保留完整标题、单位和来源。",
          },
        },
        {
          id: "block-2",
          revision_id: "knowledge-revision-2",
          block_type: "text_block",
          order_no: 1,
          status: "active",
          content_payload: {
            label: "正例示例",
            text: "表 1 总例数（n=120）",
          },
        },
        {
          id: "block-3",
          revision_id: "knowledge-revision-2",
          block_type: "table_block",
          order_no: 2,
          status: "active",
          content_payload: {
            rows: [
              ["字段", "要求"],
              ["图题", "完整保留"],
            ],
          },
        },
        {
          id: "block-4",
          revision_id: "knowledge-revision-2",
          block_type: "image_block",
          order_no: 3,
          status: "active",
          content_payload: {
            storage_key: "knowledge/figure-proof.png",
            file_name: "figure-proof.png",
            mime_type: "image/png",
            byte_length: 1024,
            caption: "截图保留图题与脚注",
          },
        },
        {
          id: "block-5",
          revision_id: "knowledge-revision-2",
          block_type: "text_block",
          order_no: 4,
          status: "active",
          content_payload: {
            label: "来源依据",
            text: "按投稿模板保留图表证据。",
          },
        },
      ],
      semantic_layer: {
        revision_id: "knowledge-revision-2",
        status: "confirmed",
      },
      bindings: [],
      contributor_label: "editor.zh",
      created_at: "2026-04-15T08:00:00.000Z",
      updated_at: "2026-04-16T09:00:00.000Z",
    },
    current_approved_revision: undefined,
    revisions: [],
  });

  assert.equal(form.title, "图表引用完整性");
  assert.equal(form.ruleBody, "图表需要保留完整标题、单位和来源。");
  assert.equal(form.positiveExample, "表 1 总例数（n=120）");
  assert.equal(form.sourceBasis, "按投稿模板保留图表证据。");
  assert.equal(form.moduleScope, "editing");
  assert.deepEqual(form.manuscriptTypes, ["clinical_study"]);
  assert.deepEqual(form.sections, ["results"]);
  assert.deepEqual(form.riskTags, ["table", "image"]);
  assert.equal(form.supplementalBlocks.length, 2);
  assert.equal(form.supplementalBlocks[0]?.block_type, "table_block");
  assert.equal(form.supplementalBlocks[1]?.block_type, "image_block");
});

test("rule wizard creates a draft revision before saving edits to an approved rule", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const result = await saveRuleWizardEntryDraft(
    {
      request: async function <TResponse>(input: {
        method: "GET" | "POST";
        url: string;
        body?: unknown;
      }) {
        requests.push(input);

        if (
          input.method === "POST" &&
          input.url === "/api/v1/knowledge/assets/knowledge-asset-1/revisions"
        ) {
          return {
            status: 200,
            body: {
              asset: {
                id: "knowledge-asset-1",
                status: "active",
                current_revision_id: "knowledge-asset-1-revision-2",
                current_approved_revision_id: "knowledge-asset-1-revision-1",
                created_at: "2026-04-15T08:00:00.000Z",
                updated_at: "2026-04-16T09:00:00.000Z",
              },
              selected_revision: {
                id: "knowledge-asset-1-revision-2",
                asset_id: "knowledge-asset-1",
                revision_no: 2,
                status: "draft",
                title: "图表引用完整性",
                canonical_text: "旧规则正文",
                knowledge_kind: "rule",
                routing: {
                  module_scope: "editing",
                  manuscript_types: ["clinical_study"],
                },
                content_blocks: [],
                bindings: [],
                created_at: "2026-04-15T08:00:00.000Z",
                updated_at: "2026-04-16T09:00:00.000Z",
              },
              revisions: [],
            } as TResponse,
          };
        }

        if (
          input.method === "POST" &&
          input.url === "/api/v1/knowledge/revisions/knowledge-asset-1-revision-2/draft"
        ) {
          return {
            status: 200,
            body: {
              asset: {
                id: "knowledge-asset-1",
                status: "active",
                current_revision_id: "knowledge-asset-1-revision-2",
                current_approved_revision_id: "knowledge-asset-1-revision-1",
                created_at: "2026-04-15T08:00:00.000Z",
                updated_at: "2026-04-16T09:00:00.000Z",
              },
              selected_revision: {
                id: "knowledge-asset-1-revision-2",
                asset_id: "knowledge-asset-1",
                revision_no: 2,
                status: "draft",
                title: "图表引用完整性",
                canonical_text: "图表需要保留完整标题、单位和来源。",
                knowledge_kind: "rule",
                routing: {
                  module_scope: "editing",
                  manuscript_types: ["clinical_study"],
                },
                content_blocks: [],
                bindings: [],
                created_at: "2026-04-15T08:00:00.000Z",
                updated_at: "2026-04-16T09:00:00.000Z",
              },
              revisions: [],
            } as TResponse,
          };
        }

        if (
          input.method === "POST" &&
          input.url ===
            "/api/v1/knowledge/revisions/knowledge-asset-1-revision-2/content-blocks/replace"
        ) {
          return {
            status: 200,
            body: {
              id: "knowledge-asset-1-revision-2",
              asset_id: "knowledge-asset-1",
              revision_no: 2,
              status: "draft",
              title: "图表引用完整性",
              canonical_text: "图表需要保留完整标题、单位和来源。",
              knowledge_kind: "rule",
              routing: {
                module_scope: "editing",
                manuscript_types: ["clinical_study"],
              },
              content_blocks: [],
              bindings: [],
              created_at: "2026-04-15T08:00:00.000Z",
              updated_at: "2026-04-16T09:00:00.000Z",
            } as TResponse,
          };
        }

        throw new Error(`Unexpected request: ${input.method} ${input.url}`);
      },
    },
    {
      draftAssetId: "knowledge-asset-1",
      form: createRuleWizardEntryFormState({
        title: "图表引用完整性",
        moduleScope: "editing",
        manuscriptTypes: "clinical_study",
        sourceType: "guideline",
        contributor: "editor.zh",
        ruleBody: "图表需要保留完整标题、单位和来源。",
        positiveExample: "",
        negativeExample: "",
        imageEvidence: "",
        sourceBasis: "按投稿模板保留图表证据。",
        advancedTagsExpanded: false,
        sections: "",
        riskTags: "",
        packageHints: "",
        candidateOnly: false,
        conflictNotes: "",
        supplementalBlocks: [],
      }),
    },
  );

  assert.equal(result.draftAssetId, "knowledge-asset-1");
  assert.equal(result.draftRevisionId, "knowledge-asset-1-revision-2");
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "POST /api/v1/knowledge/assets/knowledge-asset-1/revisions",
      "POST /api/v1/knowledge/revisions/knowledge-asset-1-revision-2/draft",
      "POST /api/v1/knowledge/revisions/knowledge-asset-1-revision-2/content-blocks/replace",
    ],
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

test("rule wizard maps manual entry fields into rule AI parsing input", () => {
  assert.deepEqual(
    createRuleWizardAiParsingInput(
      createRuleWizardEntryFormState({
        title: "摘要缩写规范",
        moduleScope: "proofreading",
        manuscriptTypes: ["clinical_study"],
        ruleBody: "摘要首次出现英文缩写时使用中文全称（英文缩写）。",
        sourceBasis: "期刊投稿须知：摘要中首次出现缩写须释义。",
        sections: ["abstract"],
      }),
    ),
    {
      rule_fields: {
        title: "摘要缩写规范",
        rule_body: "摘要首次出现英文缩写时使用中文全称（英文缩写）。",
        module_scope: "proofreading",
        manuscript_types: ["clinical_study"],
        sections: ["abstract"],
        evidence: [
          {
            kind: "user_description",
            text: "期刊投稿须知：摘要中首次出现缩写须释义。",
            authority: "review_required",
          },
        ],
      },
    },
  );
});

test("rule wizard calls rule AI parsing endpoint with normalized manual fields", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const form = createRuleWizardEntryFormState({
    title: "摘要缩写规范",
    moduleScope: "proofreading",
    manuscriptTypes: ["clinical_study"],
    ruleBody: "摘要首次出现英文缩写时使用中文全称（英文缩写）。",
    sections: ["abstract"],
  });
  const result = await parseRuleWizardManualRuleWithAi(
    {
      async request<TResponse>(input: {
        method: "GET" | "POST";
        url: string;
        body?: unknown;
      }) {
        requests.push(input);
        return {
          status: 200,
          body: {
            ai_understanding_summary: "摘要英文缩写首次出现需要补全中文全称。",
            consistency: "consistent",
            findings: [],
            requires_human_confirmation: false,
            warnings: [],
          } as TResponse,
        };
      },
    },
    form,
  );

  assert.deepEqual(requests, [
    {
      method: "POST",
      url: "/api/v1/editorial-rules/ai-intake/parse-manual-rule",
      body: createRuleWizardAiParsingInput(form),
    },
  ]);
  assert.equal(result.consistency, "consistent");
});

test("rule wizard semantic step renders rule AI parsing consistency findings", () => {
  const Step = TemplateGovernanceRuleWizardStepSemantic as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const semanticValue = createRuleWizardSemanticViewModel({
    form: createRuleWizardEntryFormState({
      title: "摘要缩写规范",
      moduleScope: "proofreading",
      manuscriptTypes: ["clinical_study"],
      ruleBody: "摘要首次出现英文缩写时使用中文全称（英文缩写）。",
      sections: ["abstract"],
    }),
    aiParsing: {
      ai_understanding_summary: "摘要英文缩写首次出现需要补全中文全称。",
      consistency: "consistent",
      findings: [
        {
          field: "evidence",
          severity: "warning",
          message: "建议补充期刊原文证据。",
        },
      ],
      requires_human_confirmation: false,
      warnings: [],
    },
  });
  const markup = renderToStaticMarkup(<Step value={semanticValue} />);

  assert.match(markup, /AI 解析校验/u);
  assert.match(markup, /一致/u);
  assert.match(markup, /摘要英文缩写首次出现需要补全中文全称/u);
  assert.match(markup, /建议补充期刊原文证据/u);
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
      retrievalTerms: ["\u672f\u8bed\u7edf\u4e00", "\u7f29\u5199\u91ca\u4e49"],
      retrievalSnippets: "",
      ruleType: "terminology_consistency",
      riskLevel: "medium",
      moduleScope: "editing",
      manuscriptTypes: ["clinical_study"],
    }),
    {
      pageSummary:
        "\u8be5\u89c4\u5219\u7528\u4e8e\u68c0\u67e5\u533b\u5b66\u672f\u8bed\u3001\u7f29\u7565\u8bed\u548c\u4e2d\u82f1\u6587\u540d\u79f0\u662f\u5426\u7edf\u4e00\u3002",
      retrievalTerms: ["\u672f\u8bed\u7edf\u4e00", "\u7f29\u5199\u91ca\u4e49"],
    },
  );
});

test("rule wizard evidence gate summary blocks non-authoritative exact-capture tables before review submission", () => {
  const summary = createRuleWizardEvidenceGateSummary({
    releaseAction: "submit_review",
    blocks: [
      {
        id: "table-block-1",
        revision_id: "knowledge-1-revision-1",
        block_type: "table_block",
        order_no: 0,
        status: "active",
        content_payload: {
          rows: [["列 1", "列 2"]],
          capture_mode: "html_table_clipboard",
          capture_environment: "windows_chromium",
          source_application: "word",
          exact_capture_failure_codes: ["exact_capture_not_authoritative"],
        },
        table_semantics: {
          snapshot_type: "table_style_snapshot",
          exact_capture_authoritative: false,
          exact_capture_failure_codes: ["exact_capture_not_authoritative"],
        },
      },
    ],
  });

  assert.equal(summary.hasBlockingIssues, true);
  assert.equal(summary.blockingItemCount, 1);
  assert.equal(summary.items[0]?.statusLabel, "阻断提交审核");
  assert.match(summary.items[0]?.detail ?? "", /不是权威 exact-capture/u);
  assert.match(summary.blockingMessage ?? "", /表格块 #1/u);
});

test("rule wizard evidence gate summary allows pending-review symbol snapshots for review but blocks direct publish", () => {
  const blocks = [
    {
      id: "image-block-1",
      revision_id: "knowledge-1-revision-1",
      block_type: "image_block" as const,
      order_no: 1,
      status: "active" as const,
      content_payload: {
        source_kind: "inline_symbol_image",
        upload_id: "upload-1",
        local_context: "统计方法段落",
        review_state: "pending_review",
      },
      image_understanding: {
        snapshot_type: "visual_symbol_snapshot",
        source_kind: "inline_symbol_image",
        review_state: "pending_review",
        local_context: "统计方法段落",
        image_id: "upload-1",
      },
    },
  ];

  const reviewSummary = createRuleWizardEvidenceGateSummary({
    releaseAction: "submit_review",
    blocks,
  });
  const publishSummary = createRuleWizardEvidenceGateSummary({
    releaseAction: "publish_now",
    blocks,
  });

  assert.equal(reviewSummary.hasBlockingIssues, false);
  assert.equal(reviewSummary.items[0]?.statusLabel, "可提交审核");
  assert.equal(publishSummary.hasBlockingIssues, true);
  assert.equal(publishSummary.items[0]?.statusLabel, "阻断直接发布");
  assert.match(publishSummary.items[0]?.detail ?? "", /审核状态未确认/u);
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
  assert.match(bindingMarkup, /\u76f4\u7ed1\u671f\u520a\u6a21\u677f/u);
  assert.match(bindingMarkup, /业务调用模块/u);
  assert.match(bindingMarkup, /推荐复用/u);
  assert.match(bindingMarkup, /影响预览/u);
  assert.match(publishMarkup, /\u53d1\u5e03\u65b9\u5f0f/u);
  assert.match(publishMarkup, /\u63d0\u4ea4\u5ba1\u6838/u);
  assert.match(publishMarkup, /最终摘要/u);
  assert.match(publishMarkup, /高精度证据预检/u);
  assert.match(publishMarkup, /提交前检查/u);
  assert.match(publishMarkup, /提交发布/u);
  assert.match(publishMarkup, /\u5b8c\u6210\u5e76\u8fd4\u56de\u89c4\u5219\u4e2d\u5fc3/u);
});

test("rule wizard publish step blocks direct publish for AI candidate drafts", () => {
  const Wizard = TemplateGovernanceRuleWizard as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    <Wizard
      state={{
        mode: "create",
        step: "publish",
        dirty: true,
        draftRevisionId: "knowledge-ai-revision-1",
      }}
      entryFormState={createRuleWizardEntryFormState({
        title: "AI 生成规则草稿",
        ruleBody: "摘要首次出现英文缩写时使用中文全称（英文缩写）。",
        candidateOnly: true,
        riskTags: ["ai_generated_rule_draft"],
      })}
    />,
  );

  assert.match(markup, /AI 草稿必须先提交审核/u);
  assert.match(
    markup,
    /<small>直接发布<\/small><input[^>]*name="rule-wizard-release-action"[^>]*disabled/u,
  );
});

test("rule wizard publish step surfaces blocking high-fidelity evidence before submission", () => {
  const Wizard = TemplateGovernanceRuleWizard as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    <Wizard
      state={{
        mode: "create",
        step: "publish",
        dirty: true,
        draftRevisionId: "knowledge-1-revision-1",
      }}
      entryFormState={createRuleWizardEntryFormState({
        title: "表格格式规则",
        ruleBody: "表格需要按三线表规范录入。",
        sourceBasis: "期刊表格规范",
        supplementalBlocks: [
          {
            id: "table-block-1",
            revision_id: "knowledge-1-revision-1",
            block_type: "table_block",
            order_no: 0,
            status: "active",
            content_payload: {
              rows: [["列 1", "列 2"]],
              capture_mode: "html_table_clipboard",
              capture_environment: "windows_chromium",
              source_application: "word",
              exact_capture_failure_codes: [
                "border_profile_incomplete",
                "exact_capture_not_authoritative",
              ],
            },
            table_semantics: {
              snapshot_type: "table_style_snapshot",
              exact_capture_authoritative: false,
              exact_capture_failure_codes: [
                "border_profile_incomplete",
                "exact_capture_not_authoritative",
              ],
            },
          },
        ],
      })}
    />,
  );

  assert.match(markup, /高精度证据预检/u);
  assert.match(markup, /表格块 #1/u);
  assert.match(markup, /阻断提交审核/u);
  assert.match(markup, /边框轮廓不完整/u);
  assert.match(markup, /不是权威 exact-capture/u);
});

test("rule wizard binding selections map into package and template family bindings", () => {
  assert.deepEqual(
    createRuleWizardBindingInputs({
      selectedPackageKind: "medical_package",
      selectedPackageId: "pkg-medical",
      selectedPackageLabel: "\u533b\u5b66\u4e13\u4e1a\u6821\u5bf9\u5305",
      reuseStrategy: "reuse_existing",
      selectedTemplateFamilies: [
        {
          id: "family-clinical",
          name: "\u8bba\u8457\u57fa\u7840\u65cf",
        },
      ],
      selectedJournalTemplates: [
        {
          id: "journal-template-1",
          name: "\u4e2d\u56fd\u5faa\u73af\u6742\u5fd7",
        },
      ],
      selectedKnowledgeItems: [],
    }),
    [
      {
        bindingKind: "medical_package",
        bindingTargetId: "pkg-medical",
        bindingTargetLabel: "\u533b\u5b66\u4e13\u4e1a\u6821\u5bf9\u5305\uff08\u9501\u5b9a\u5177\u4f53\u7248\u672c\uff09",
      },
      {
        bindingKind: "template_family",
        bindingTargetId: "family-clinical",
        bindingTargetLabel: "\u8bba\u8457\u57fa\u7840\u65cf",
      },
      {
        bindingKind: "journal_template",
        bindingTargetId: "journal-template-1",
        bindingTargetLabel: "\u4e2d\u56fd\u5faa\u73af\u6742\u5fd7",
      },
    ],
  );
});

test("rule wizard binding step renders explicit journal-template and linked-knowledge selectors", () => {
  const Wizard = TemplateGovernanceRuleWizard as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    <Wizard
      state={{
        mode: "create",
        step: "binding",
        dirty: true,
        draftRevisionId: "knowledge-1-revision-1",
      }}
      bindingOptions={{
        generalPackages: [
          {
            id: "pkg-general",
            label: "General Package",
          },
        ],
        medicalPackages: [
          {
            id: "pkg-medical",
            label: "Medical Package",
          },
        ],
        templateFamilies: [
          {
            id: "family-clinical",
            name: "Clinical Family",
            manuscriptType: "clinical_study",
          },
        ],
        journalTemplates: [
          {
            id: "journal-template-1",
            label: "Journal Alpha",
            familyId: "family-clinical",
            familyName: "Clinical Family",
            journalKey: "journal-alpha",
          },
        ],
        knowledgeItems: [
          {
            id: "knowledge-asset-1",
            label: "Table checklist",
            knowledgeKind: "reference",
            status: "approved",
            moduleScope: "proofreading",
            manuscriptTypes: ["clinical_study"],
          },
        ],
      }}
      bindingFormState={{
        selectedPackageKind: "medical_package",
        selectedPackageId: "pkg-medical",
        selectedPackageLabel: "Medical Package",
        reuseStrategy: "reuse_existing",
        selectedTemplateFamilies: [],
        selectedJournalTemplates: [
          {
            id: "journal-template-1",
            name: "Journal Alpha",
          },
        ],
        selectedKnowledgeItems: [
          {
            id: "knowledge-asset-1",
            title: "Table checklist",
          },
        ],
      }}
    />,
  );

  assert.match(markup, /data-rule-wizard-journal-templates="list"/u);
  assert.match(markup, /data-searchable-multi-select-input="rule-wizard-journal-templates"/u);
  assert.match(markup, /placeholder="搜索期刊模板"/u);
  assert.match(markup, /Journal Alpha/u);
  assert.match(markup, /直绑期刊模板/u);
  assert.match(markup, /Clinical Family（1）/u);
  assert.match(markup, /Clinical Family \/ journal-alpha/u);
  assert.match(markup, /data-rule-wizard-linked-knowledge="list"/u);
  assert.match(markup, /data-searchable-multi-select-input="rule-wizard-linked-knowledge"/u);
  assert.match(markup, /placeholder="搜索关联知识条目"/u);
  assert.match(markup, /Table checklist/u);
  assert.match(markup, /关联知识条目/u);
  assert.match(markup, /参考资料（1）/u);
  assert.match(markup, /参考资料 \/ 已通过 \/ 校对/u);
  assert.doesNotMatch(markup, /这里展示已激活的真实期刊模板/u);
  assert.doesNotMatch(markup, /关联知识只展示已批准且非“规则投影”的条目/u);
  assert.doesNotMatch(markup, /reference \/ approved/u);
});

test("rule wizard binding options load approved knowledge items for linking", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const result = await loadRuleWizardBindingOptions({
    request: async function <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) {
      requests.push(input);

      if (
        input.method === "GET" &&
        input.url ===
          "/api/v1/manuscript-quality-packages?packageKind=general_style_package&status=published"
      ) {
        return {
          status: 200,
          body: [
            {
              id: "pkg-general",
              package_name: "General Package",
              package_kind: "general_style_package",
              target_scopes: ["general_proofreading"],
              version: 3,
              status: "published",
            },
          ] as TResponse,
        };
      }

      if (
        input.method === "GET" &&
        input.url ===
          "/api/v1/manuscript-quality-packages?packageKind=medical_analyzer_package&status=published"
      ) {
        return {
          status: 200,
          body: [
            {
              id: "pkg-medical",
              package_name: "Medical Package",
              package_kind: "medical_analyzer_package",
              target_scopes: ["medical_specialized"],
              version: 7,
              status: "published",
            },
          ] as TResponse,
        };
      }

      if (input.method === "GET" && input.url === "/api/v1/templates/families") {
        return {
          status: 200,
          body: [
            {
              id: "family-clinical",
              name: "Clinical Family",
              manuscript_type: "clinical_study",
              status: "active",
            },
          ] as TResponse,
        };
      }

      if (
        input.method === "GET" &&
        input.url === "/api/v1/templates/families/family-clinical/journal-templates"
      ) {
        return {
          status: 200,
          body: [
            {
              id: "journal-template-1",
              template_family_id: "family-clinical",
              journal_key: "journal-alpha",
              journal_name: "Journal Alpha",
              status: "active",
            },
            {
              id: "journal-template-2",
              template_family_id: "family-clinical",
              journal_key: "journal-beta",
              journal_name: "Journal Beta",
              status: "archived",
            },
          ] as TResponse,
        };
      }

      if (input.method === "GET" && input.url === "/api/v1/knowledge/library") {
        return {
          status: 200,
          body: {
            query_mode: "keyword",
            items: [
              {
                asset_id: "knowledge-asset-1",
                title: "Table checklist",
                knowledge_kind: "reference",
                status: "approved",
                module_scope: "proofreading",
                manuscript_types: ["clinical_study"],
                selected_revision_id: "knowledge-revision-1",
                content_block_count: 2,
              },
              {
                asset_id: "knowledge-asset-2",
                title: "Draft knowledge",
                knowledge_kind: "reference",
                status: "draft",
                module_scope: "proofreading",
                manuscript_types: ["clinical_study"],
                selected_revision_id: "knowledge-revision-2",
                content_block_count: 1,
              },
              {
                asset_id: "knowledge-asset-3",
                title: "Executable rule",
                knowledge_kind: "rule",
                status: "approved",
                module_scope: "proofreading",
                manuscript_types: ["clinical_study"],
                selected_revision_id: "knowledge-revision-3",
                content_block_count: 1,
              },
            ],
          } as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  assert.deepEqual(requests.map((request) => `${request.method} ${request.url}`), [
    "GET /api/v1/manuscript-quality-packages?packageKind=general_style_package&status=published",
    "GET /api/v1/manuscript-quality-packages?packageKind=medical_analyzer_package&status=published",
    "GET /api/v1/templates/families",
    "GET /api/v1/knowledge/library",
    "GET /api/v1/templates/families/family-clinical/journal-templates",
  ]);
  assert.deepEqual((result as { generalPackages?: unknown }).generalPackages, [
    {
      id: "pkg-general",
      label: "General Package v3 / 通用包（锁定具体版本）",
    },
    {
      id: "general_style_package",
      label: "按通用包类型激活（不锁版本）",
    },
  ]);
  assert.deepEqual((result as { medicalPackages?: unknown }).medicalPackages, [
    {
      id: "pkg-medical",
      label: "Medical Package v7 / 医用包（锁定具体版本）",
    },
    {
      id: "medical_analyzer_package",
      label: "按医用包类型激活（不锁版本）",
    },
  ]);
  assert.deepEqual((result as { journalTemplates?: unknown }).journalTemplates, [
    {
      id: "journal-template-1",
      label: "Journal Alpha",
      familyId: "family-clinical",
      familyName: "Clinical Family",
      journalKey: "journal-alpha",
    },
  ]);
  assert.deepEqual(
    (result as { knowledgeItems?: unknown }).knowledgeItems,
    [
      {
        id: "knowledge-asset-1",
        label: "Table checklist",
        knowledgeKind: "reference",
        status: "approved",
        moduleScope: "proofreading",
        manuscriptTypes: ["clinical_study"],
      },
    ],
  );
});

test("rule wizard binding selections map linked knowledge items into knowledge item bindings", () => {
  assert.deepEqual(
    createRuleWizardBindingInputs({
      selectedPackageKind: "medical_package",
      selectedPackageId: "pkg-medical",
      selectedPackageLabel: "Medical Package",
      reuseStrategy: "reuse_existing",
      selectedTemplateFamilies: [
        {
          id: "family-clinical",
          name: "Clinical Family",
        },
      ],
      selectedJournalTemplates: [
        {
          id: "journal-template-1",
          name: "Journal Alpha",
        },
      ],
      selectedKnowledgeItems: [
        {
          id: "knowledge-asset-1",
          title: "Table checklist",
        },
      ],
    } as never),
    [
      {
        bindingKind: "medical_package",
        bindingTargetId: "pkg-medical",
        bindingTargetLabel: "Medical Package（锁定具体版本）",
      },
      {
        bindingKind: "template_family",
        bindingTargetId: "family-clinical",
        bindingTargetLabel: "Clinical Family",
      },
      {
        bindingKind: "journal_template",
        bindingTargetId: "journal-template-1",
        bindingTargetLabel: "Journal Alpha",
      },
      {
        bindingKind: "knowledge_item",
        bindingTargetId: "knowledge-asset-1",
        bindingTargetLabel: "Table checklist",
      },
    ],
  );
});

test("rule wizard binding form state restores linked knowledge selections from detail bindings", () => {
  const state = createRuleWizardBindingFormState({
    options: {
      generalPackages: [],
      medicalPackages: [
        {
          id: "pkg-medical",
          label: "Medical Package",
        },
      ],
      templateFamilies: [
        {
          id: "family-clinical",
          name: "Clinical Family",
          manuscriptType: "clinical_study",
        },
      ],
      journalTemplates: [
        {
          id: "journal-template-1",
          label: "Journal Alpha",
          familyId: "family-clinical",
          familyName: "Clinical Family",
          journalKey: "journal-alpha",
        },
      ],
      knowledgeItems: [
        {
          id: "knowledge-asset-1",
          label: "Table checklist",
          knowledgeKind: "reference",
          status: "approved",
        },
      ],
    },
    detail: {
      selected_revision: {
        bindings: [
          {
            id: "binding-1",
            revision_id: "knowledge-1-revision-1",
            binding_kind: "medical_package",
            binding_target_id: "pkg-medical",
            binding_target_label: "Medical Package",
            created_at: "2026-04-16T08:00:00.000Z",
          },
          {
            id: "binding-2",
            revision_id: "knowledge-1-revision-1",
            binding_kind: "template_family",
            binding_target_id: "family-clinical",
            binding_target_label: "Clinical Family",
            created_at: "2026-04-16T08:00:00.000Z",
          },
          {
            id: "binding-3",
            revision_id: "knowledge-1-revision-1",
            binding_kind: "journal_template",
            binding_target_id: "journal-template-1",
            binding_target_label: "Journal Alpha",
            created_at: "2026-04-16T08:00:00.000Z",
          },
          {
            id: "binding-4",
            revision_id: "knowledge-1-revision-1",
            binding_kind: "knowledge_item",
            binding_target_id: "knowledge-asset-1",
            binding_target_label: "Table checklist",
            created_at: "2026-04-16T08:00:00.000Z",
          },
        ],
      },
    },
  } as never);

  assert.deepEqual((state as { selectedKnowledgeItems?: unknown }).selectedKnowledgeItems, [
    {
      id: "knowledge-asset-1",
      title: "Table checklist",
    },
  ]);
  assert.deepEqual((state as { selectedJournalTemplates?: unknown }).selectedJournalTemplates, [
    {
      id: "journal-template-1",
      name: "Journal Alpha",
    },
  ]);
});

test("rule wizard binding form state prefers an exact package version over the package-kind fallback by default", () => {
  const state = createRuleWizardBindingFormState({
    options: {
      generalPackages: [
        {
          id: "general_style_package",
          label: "按通用包类型激活（不锁版本）",
        },
        {
          id: "pkg-general",
          label: "General Package v3 / 通用包（锁定具体版本）",
        },
      ],
      medicalPackages: [],
      templateFamilies: [],
      journalTemplates: [],
      knowledgeItems: [],
    },
  } as never);

  assert.equal((state as { selectedPackageId?: unknown }).selectedPackageId, "pkg-general");
  assert.equal(
    (state as { selectedPackageLabel?: unknown }).selectedPackageLabel,
    "General Package v3 / 通用包（锁定具体版本）",
  );
});
