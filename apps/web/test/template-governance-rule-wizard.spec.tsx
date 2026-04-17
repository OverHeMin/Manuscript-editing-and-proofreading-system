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
  createRuleDraftContentBlocks,
  createRuleWizardBindingFormState,
  createRuleWizardEntryFormState,
  createRuleWizardEntryFormStateFromDetail,
  createRuleWizardBindingInputs,
  confirmSemanticLayerInput,
  loadRuleWizardBindingOptions,
  saveRuleWizardEntryDraft,
} = await import("../src/features/template-governance/template-governance-rule-wizard-api.ts");

test("rule wizard entry step explains high-frequency parameters and advanced tags", () => {
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

  assert.match(markup, /这版向导只开放高频治理参数/u);
  assert.match(markup, /低频运行参数继续放在旧工作台/u);
  assert.match(markup, /适用模块决定规则在哪个执行环节被调用/u);
  assert.match(markup, /章节标签和风险标签放到高级标签里补充/u);
  assert.match(markup, /打开旧版高级工作台/u);
  assert.match(markup, /templateGovernanceView=classic/u);
});

test("rule wizard confirm step explains semantic confirmation parameters", () => {
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

  assert.match(markup, /规则类型决定这条规则按什么治理判断复用/u);
  assert.match(markup, /风险等级决定后续审核和发布要多谨慎/u);
  assert.match(markup, /稿件类型填写这条规则默认命中的稿件范围/u);
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
        title: "鏈缁熶竴瑙勫垯",
        moduleScope: "editing",
        manuscriptTypes: ["clinical_study", "review"],
        sourceType: "guideline",
        contributor: "editor.zh",
        ruleBody: "缁熶竴鍖诲鏈鍜岀缉鍐欒В閲娿€?",
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
  assert.match(markup, /placeholder="鎼滅储绋夸欢绫诲瀷"/u);
  assert.match(markup, /data-rule-wizard-tag-list="confirm-retrieval-terms"/u);
  assert.match(markup, /data-rule-wizard-tag-action="add-confirm-retrieval-term"/u);
  assert.doesNotMatch(markup, /placeholder="clinical_study, review"/u);
  assert.doesNotMatch(markup, /placeholder="鏈缁熶竴, 缂╁啓閲婁箟"/u);
});

test("rule wizard binding and publish steps explain package and release choices", () => {
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

  assert.match(bindingMarkup, /规则包决定这条规则先落到哪个复用容器/u);
  assert.match(bindingMarkup, /模板族决定哪些稿件默认看见这条规则/u);
  assert.match(bindingMarkup, /复用策略只处理挂到现有包还是新建绑定/u);
  assert.match(publishMarkup, /保存草稿适合先留给当前编辑人继续补充/u);
  assert.match(publishMarkup, /提交审核会进入规则治理审核队列/u);
  assert.match(publishMarkup, /直接发布只适合已经确认无误的场景/u);
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
  assert.match(publishMarkup, /提交发布/u);
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

test("rule wizard binding step renders an explicit linked knowledge selector", () => {
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
        selectedKnowledgeItems: [
          {
            id: "knowledge-asset-1",
            title: "Table checklist",
          },
        ],
      }}
    />,
  );

  assert.match(markup, /data-rule-wizard-linked-knowledge="list"/u);
  assert.match(markup, /data-searchable-multi-select-input="rule-wizard-linked-knowledge"/u);
  assert.match(markup, /placeholder="搜索关联知识条目"/u);
  assert.match(markup, /Table checklist/u);
  assert.match(markup, /关联知识只展示已批准且非“规则投影”的条目/u);
  assert.match(markup, /参考资料（1）/u);
  assert.match(markup, /参考资料 \/ 已通过 \/ 校对/u);
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
        input.url === "/api/v1/templates/content-modules?moduleClass=general"
      ) {
        return {
          status: 200,
          body: [
            {
              id: "pkg-general",
              name: "General Package",
            },
          ] as TResponse,
        };
      }

      if (
        input.method === "GET" &&
        input.url ===
          "/api/v1/templates/content-modules?moduleClass=medical_specialized"
      ) {
        return {
          status: 200,
          body: [
            {
              id: "pkg-medical",
              name: "Medical Package",
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
    "GET /api/v1/templates/content-modules?moduleClass=general",
    "GET /api/v1/templates/content-modules?moduleClass=medical_specialized",
    "GET /api/v1/templates/families",
    "GET /api/v1/knowledge/library",
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
        bindingTargetLabel: "Medical Package",
      },
      {
        bindingKind: "template_family",
        bindingTargetId: "family-clinical",
        bindingTargetLabel: "Clinical Family",
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
});
