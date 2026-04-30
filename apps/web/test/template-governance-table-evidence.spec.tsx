import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

register(new URL("./helpers/ignore-css-loader.mjs", import.meta.url), import.meta.url);

const {
  KnowledgeLibraryRichContentEditor,
  appendKnowledgeLibraryTableEvidenceBlock,
} = await import(
  "../src/features/knowledge-library/knowledge-library-rich-content-editor.tsx"
);
const {
  TemplateGovernanceRuleWizard,
} = await import("../src/features/template-governance/template-governance-rule-wizard.tsx");
const {
  TemplateGovernanceRuleWizardStepEntry,
} = await import("../src/features/template-governance/template-governance-rule-wizard-step-entry.tsx");
const {
  createRuleWizardAiParsingInput,
  createRuleWizardEntryFormStateFromDetail,
  createRuleWizardEntryFormState,
  createRuleWizardEvidenceGateSummary,
  publishRuleWizardRevision,
} = await import("../src/features/template-governance/template-governance-rule-wizard-api.ts");

const confirmedTablePackage = {
  package_id: "table-package-1",
  asset_id: "table-asset-1",
  revision_id: "table-revision-1",
  revision_no: 2,
  source_file_asset_id: "source-file-1",
  authority: "authoritative" as const,
  confirmation_status: "confirmed" as const,
  fidelity_status: "confirmed" as const,
  confirmed_by_human: true,
  confirmed_by: "reviewer.zh",
  confirmed_at: "2026-04-28T08:00:00.000Z",
  parser: "python_docx_ooxml" as const,
  parser_version: "1.0.0",
  source_snapshot_hash: "source-hash",
  confirmed_snapshot_hash: "confirmed-hash",
  ai_table_package_hash: "package-hash",
  notes: [],
  structure: {
    row_count: 2,
    column_count: 2,
    header_depth: 1,
    merged_cells: [],
  },
  cells: [],
  fidelity_report: {
    status: "confirmed" as const,
    failure_codes: [],
    unsupported_fact_groups: [],
    required_confirmations: [],
    invisible_chars_confirmed: true,
    special_symbols_confirmed: true,
  },
};

test("rule wizard AI parsing keeps source basis and sends confirmed table packages as structured evidence", () => {
  const input = createRuleWizardAiParsingInput(
    createRuleWizardEntryFormState({
      title: "三线表格式",
      ruleBody: "统计表应保留原始 Word 表格证据。",
      sourceBasis: "期刊表格规范第 3 条。",
      confirmedTablePackages: [confirmedTablePackage],
    } as never),
  );

  assert.deepEqual(input.rule_fields.evidence, [
    {
      kind: "user_description",
      text: "期刊表格规范第 3 条。",
      authority: "review_required",
    },
    {
      kind: "confirmed_table_package",
      source_id: "table-revision-1",
      authority: "authoritative",
      confirmed_table_package: confirmedTablePackage,
    },
  ]);
});

test("rule wizard evidence gate handles confirmed pending and missing table evidence blocks by release action", () => {
  const confirmedBlock = createTableEvidenceBlock("block-confirmed", {
    table_evidence_revision_id: "table-revision-confirmed",
    revision_status: "confirmed",
  });
  const pendingBlock = createTableEvidenceBlock("block-pending", {
    table_evidence_revision_id: "table-revision-pending",
    revision_status: "pending",
  });
  const missingBlock = createTableEvidenceBlock("block-missing", {
    revision_status: "confirmed",
  });

  const saveSummary = createRuleWizardEvidenceGateSummary({
    blocks: [pendingBlock, missingBlock],
    releaseAction: "save_draft",
  });
  assert.equal(saveSummary.hasBlockingIssues, false);
  assert.equal(saveSummary.items.length, 2);
  assert.match(saveSummary.items[0]?.detail ?? "", /正式提交前仍需补齐/u);
  assert.match(saveSummary.items[0]?.detail ?? "", /表格证据状态未确认/u);
  assert.match(saveSummary.items[1]?.detail ?? "", /缺少表格证据 revision id/u);

  const submitSummary = createRuleWizardEvidenceGateSummary({
    blocks: [confirmedBlock, pendingBlock, missingBlock],
    releaseAction: "submit_review",
  });
  assert.equal(submitSummary.items.length, 3);
  assert.equal(submitSummary.blockingItemCount, 2);
  assert.equal(submitSummary.items[0]?.blocking, false);
  assert.equal(submitSummary.items[1]?.blocking, true);
  assert.equal(submitSummary.items[2]?.blocking, true);
  assert.match(submitSummary.items[1]?.detail ?? "", /表格证据状态未确认/u);

  const publishSummary = createRuleWizardEvidenceGateSummary({
    blocks: [pendingBlock],
    releaseAction: "publish_now",
  });
  assert.equal(publishSummary.hasBlockingIssues, true);
  assert.match(publishSummary.blockingMessage ?? "", /表格证据状态未确认/u);
});

test("rule wizard hydrates table evidence revision ids and confirmed packages from rule detail blocks", () => {
  const form = createRuleWizardEntryFormStateFromDetail({
    asset: {
      id: "knowledge-asset-1",
      status: "active",
      current_revision_id: "knowledge-revision-1",
      contributor_label: "editor.zh",
      created_at: "2026-04-28T08:00:00.000Z",
      updated_at: "2026-04-28T08:00:00.000Z",
    },
    selected_revision: {
      id: "knowledge-revision-1",
      asset_id: "knowledge-asset-1",
      revision_no: 1,
      status: "draft",
      title: "三线表格式",
      canonical_text: "统计表应保留原始 Word 表格证据。",
      knowledge_kind: "rule",
      routing: {
        module_scope: "editing",
        manuscript_types: ["clinical_study"],
      },
      content_blocks: [
        createTableEvidenceBlock("block-1", {
          table_evidence_revision_id: "table-revision-1",
          revision_status: "confirmed",
          confirmed_table_package: confirmedTablePackage,
        }),
      ],
      bindings: [],
      contributor_label: "editor.zh",
      created_at: "2026-04-28T08:00:00.000Z",
      updated_at: "2026-04-28T08:00:00.000Z",
    },
    current_approved_revision: undefined,
    revisions: [],
  } as never);

  assert.deepEqual(form.tableEvidenceRevisionIds, ["table-revision-1"]);
  assert.deepEqual(form.confirmedTablePackages, [confirmedTablePackage]);
});

test("rule wizard carries confirmed table package from selected table evidence block into AI parsing", async () => {
  const blocks = await appendKnowledgeLibraryTableEvidenceBlock({
    blocks: [],
    currentRevisionId: "knowledge-revision-1",
    selection: {
      assetId: "table-asset-1",
      revisionId: "table-revision-1",
      revisionStatus: "confirmed",
      confirmedTablePackage,
    },
  });

  assert.deepEqual(blocks[0]?.content_payload.confirmed_table_package, confirmedTablePackage);

  const form = createRuleWizardEntryFormState({
    title: "三线表格式",
    ruleBody: "统计表应保留原始 Word 表格证据。",
    sourceBasis: "期刊表格规范第 3 条。",
    supplementalBlocks: blocks,
  });
  assert.deepEqual(form.tableEvidenceRevisionIds, ["table-revision-1"]);
  assert.deepEqual(form.confirmedTablePackages, [confirmedTablePackage]);

  assert.deepEqual(createRuleWizardAiParsingInput(form).rule_fields.evidence, [
    {
      kind: "user_description",
      text: "期刊表格规范第 3 条。",
      authority: "review_required",
    },
    {
      kind: "confirmed_table_package",
      source_id: "table-revision-1",
      authority: "authoritative",
      confirmed_table_package: confirmedTablePackage,
    },
  ]);
});

test("rule wizard entry step merges confirmed packages from table evidence block changes", () => {
  const blocks = [
    createTableEvidenceBlock("block-1", {
      table_evidence_revision_id: "table-revision-1",
      revision_status: "confirmed",
      confirmed_table_package: confirmedTablePackage,
    }),
  ];
  let nextState: ReturnType<typeof createRuleWizardEntryFormState> | null = null;
  const element = TemplateGovernanceRuleWizardStepEntry({
    value: createRuleWizardEntryFormState({
      title: "三线表格式",
      ruleBody: "统计表应保留原始 Word 表格证据。",
    }),
    onChange: (value) => {
      nextState = value;
    },
    draftRevisionId: "knowledge-revision-1",
  });
  const editorElement = findReactElementByType(element, KnowledgeLibraryRichContentEditor);

  editorElement.props.onChange(blocks);

  assert.deepEqual(nextState?.tableEvidenceRevisionIds, ["table-revision-1"]);
  assert.deepEqual(nextState?.confirmedTablePackages, [confirmedTablePackage]);
});

test("rule wizard entry step removes confirmed packages and revision ids when table evidence blocks are deleted", async () => {
  let nextState: ReturnType<typeof createRuleWizardEntryFormState> | null = null;
  const value = createRuleWizardEntryFormState({
    title: "三线表格式",
    ruleBody: "统计表应保留原始 Word 表格证据。",
    sourceBasis: "期刊表格规范第 3 条。",
    supplementalBlocks: [
      createTableEvidenceBlock("block-1", {
        table_evidence_revision_id: "table-revision-1",
        revision_status: "confirmed",
        confirmed_table_package: confirmedTablePackage,
      }),
    ],
  });
  const element = TemplateGovernanceRuleWizardStepEntry({
    value,
    onChange: (nextValue) => {
      nextState = nextValue;
    },
    draftRevisionId: "knowledge-revision-1",
  });
  const editorElement = findReactElementByType(element, KnowledgeLibraryRichContentEditor);

  editorElement.props.onChange([]);

  assert.deepEqual(nextState?.tableEvidenceRevisionIds, []);
  assert.deepEqual(nextState?.confirmedTablePackages, []);
  assert.deepEqual(createRuleWizardAiParsingInput(nextState).rule_fields.evidence, [
    {
      kind: "user_description",
      text: "期刊表格规范第 3 条。",
      authority: "review_required",
    },
  ]);

  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  await publishRuleWizardRevision(
    {
      request: async function <TResponse>(input: {
        method: "GET" | "POST";
        url: string;
        body?: unknown;
      }) {
        requests.push(input);
        return {
          status: 200,
          body: {
            asset: {},
            selected_revision: {},
            revisions: [],
          } as TResponse,
        };
      },
    },
    "knowledge-revision-1",
    "ready",
    nextState,
  );

  assert.deepEqual(requests[0]?.body, {
    actorRole: "admin",
    reviewNote: "ready",
  });
});

test("rule wizard entry exposes table evidence only when a real draft revision id exists", () => {
  const StepEntry = TemplateGovernanceRuleWizardStepEntry as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;

  const unavailableMarkup = renderToStaticMarkup(
    <StepEntry
      value={createRuleWizardEntryFormState()}
      onChange={() => undefined}
      tableEvidenceClient={{ request: async () => ({ status: 200, body: {} }) }}
    />,
  );
  assert.match(unavailableMarkup, /data-table-evidence-client-state="unavailable"/u);

  const availableMarkup = renderToStaticMarkup(
    <StepEntry
      value={createRuleWizardEntryFormState()}
      onChange={() => undefined}
      draftRevisionId="knowledge-revision-1"
      tableEvidenceClient={{ request: async () => ({ status: 200, body: {} }) }}
    />,
  );
  assert.match(availableMarkup, /data-table-evidence-client-state="available"/u);
  assert.match(availableMarkup, /Word 表格证据/u);
});

test("rule wizard entry keeps DOCX guidance separate from image upload", () => {
  const StepEntry = TemplateGovernanceRuleWizardStepEntry as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const markup = renderToStaticMarkup(
    <StepEntry
      value={createRuleWizardEntryFormState({
        supplementalBlocks: [
          {
            id: "block-1",
            revision_id: "knowledge-revision-1",
            block_type: "image_block",
            order_no: 0,
            status: "active",
            content_payload: {},
          },
        ],
      })}
      onChange={() => undefined}
      draftRevisionId="knowledge-revision-1"
      tableEvidenceClient={{ request: async () => ({ status: 200, body: {} }) }}
    />,
  );

  assert.match(markup, /Word 表格证据/u);
  assert.match(markup, /上传 Word 表格证据/u);
  assert.match(markup, /图片入口只接收图片/u);
  assert.match(markup, /请点击“Word 表格证据”上传 \.docx/u);
});

test("rule wizard shell wires the default table evidence client when entry has a draft revision id", () => {
  const Wizard = TemplateGovernanceRuleWizard as unknown as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
  const unavailableMarkup = renderToStaticMarkup(
    <Wizard state={{ mode: "create", step: "entry", dirty: true }} />,
  );
  const availableMarkup = renderToStaticMarkup(
    <Wizard
      state={{
        mode: "create",
        step: "entry",
        dirty: true,
        draftRevisionId: "knowledge-revision-1",
      }}
    />,
  );

  assert.match(unavailableMarkup, /data-table-evidence-client-state="unavailable"/u);
  assert.match(availableMarkup, /data-table-evidence-client-state="available"/u);
});

test("rule wizard publish request includes locked table evidence revision ids in linkage payload", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  await publishRuleWizardRevision(
    {
      request: async function <TResponse>(input: {
        method: "GET" | "POST";
        url: string;
        body?: unknown;
      }) {
        requests.push(input);
        return {
          status: 200,
          body: {
            asset: {},
            selected_revision: {},
            revisions: [],
          } as TResponse,
        };
      },
    },
    "knowledge-revision-1",
    "ready",
    createRuleWizardEntryFormState({
      supplementalBlocks: [
        createTableEvidenceBlock("block-1", {
          table_evidence_revision_id: "table-revision-1",
          revision_status: "confirmed",
        }),
        createTableEvidenceBlock("block-2", {
          table_evidence_revision_id: "table-revision-2",
          revision_status: "confirmed",
        }),
      ],
    } as never),
  );

  assert.deepEqual(requests[0]?.body, {
    actorRole: "admin",
    reviewNote: "ready",
    linkagePayload: {
      table_evidence_revision_ids: ["table-revision-1", "table-revision-2"],
    },
  });
});

function createTableEvidenceBlock(
  id: string,
  payload: Record<string, unknown>,
) {
  return {
    id,
    revision_id: "knowledge-revision-1",
    block_type: "table_evidence_block" as const,
    order_no: 0,
    status: "active" as const,
    content_payload: {
      table_evidence_asset_id: "table-asset-1",
      ...payload,
    },
  };
}

function findReactElementByType(
  element: React.ReactNode,
  type: unknown,
): React.ReactElement<Record<string, unknown>> {
  if (!React.isValidElement(element)) {
    throw new Error("React element not found");
  }

  if (element.type === type) {
    return element as React.ReactElement<Record<string, unknown>>;
  }

  const children = React.Children.toArray(
    (element.props as { children?: React.ReactNode }).children,
  );

  for (const child of children) {
    if (React.isValidElement(child)) {
      try {
        return findReactElementByType(child, type);
      } catch {
        // Continue searching sibling subtrees.
      }
    }
  }

  throw new Error("React element not found");
}
