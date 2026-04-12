import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

register(new URL("./helpers/ignore-css-loader.mjs", import.meta.url), import.meta.url);

const {
  buildDuplicateCheckTriggerSignature,
  getStrongDuplicateMatches,
  isImmediateDuplicateCheckResultStale,
  KnowledgeLibraryDuplicateSubmitConfirmation,
  KnowledgeLibraryDuplicateStatusRow,
  resolveDuplicateAcknowledgementSubmitDecision,
  KnowledgeLibraryWorkbenchPage,
  resolveDuplicateSubmitDecision,
  shouldInvalidateDuplicateSubmitConfirmation,
} = await import("../src/features/knowledge-library/knowledge-library-workbench-page.tsx");

test("knowledge library workbench page renders the ledger grid shell and record drawer", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeLibraryWorkbenchPage
      initialViewModel={{
        library: [
          {
            id: "knowledge-1",
            title: "Primary endpoint rule",
            summary: "Screening knowledge.",
            knowledge_kind: "rule",
            status: "draft",
            module_scope: "screening",
            manuscript_types: ["clinical_study"],
            selected_revision_id: "knowledge-1-revision-2",
            semantic_status: "confirmed",
            content_block_count: 3,
            updated_at: "2026-04-08T08:30:00.000Z",
            contributor_label: "editor.zh",
          },
        ],
        visibleLibrary: [
          {
            id: "knowledge-1",
            title: "Primary endpoint rule",
            summary: "Screening knowledge.",
            knowledge_kind: "rule",
            status: "draft",
            module_scope: "screening",
            manuscript_types: ["clinical_study"],
            selected_revision_id: "knowledge-1-revision-2",
            semantic_status: "confirmed",
            content_block_count: 3,
            updated_at: "2026-04-08T08:30:00.000Z",
            contributor_label: "editor.zh",
          },
        ],
        filters: {
          searchText: "endpoint",
          queryMode: "semantic",
        },
        selectedAssetId: "knowledge-1",
        selectedRevisionId: "knowledge-1-revision-2",
        selectedSummary: {
          id: "knowledge-1",
          title: "Primary endpoint rule",
          summary: "Screening knowledge.",
          knowledge_kind: "rule",
          status: "draft",
          module_scope: "screening",
          manuscript_types: ["clinical_study"],
          selected_revision_id: "knowledge-1-revision-2",
          semantic_status: "confirmed",
          content_block_count: 3,
          updated_at: "2026-04-08T08:30:00.000Z",
          contributor_label: "editor.zh",
        },
        detail: {
          asset: {
            id: "knowledge-1",
            status: "active",
            current_revision_id: "knowledge-1-revision-2",
            current_approved_revision_id: "knowledge-1-revision-1",
            created_at: "2026-04-08T08:00:00.000Z",
            updated_at: "2026-04-08T08:30:00.000Z",
            contributor_label: "editor.zh",
          },
          selected_revision: {
            id: "knowledge-1-revision-2",
            asset_id: "knowledge-1",
            revision_no: 2,
            status: "draft",
            title: "Primary endpoint rule draft",
            canonical_text:
              "Clinical studies must define the primary endpoint before screening sign-off.",
            summary: "Screening knowledge.",
            knowledge_kind: "rule",
            routing: {
              module_scope: "screening",
              manuscript_types: ["clinical_study"],
              sections: ["methods"],
            },
            evidence_level: "high",
            source_type: "guideline",
            source_link: "https://example.test/guideline",
            aliases: ["endpoint"],
            effective_at: "2026-04-08T00:00:00.000Z",
            content_blocks: [
              {
                id: "knowledge-1-revision-2-block-1",
                revision_id: "knowledge-1-revision-2",
                block_type: "text_block",
                order_no: 0,
                status: "active",
                content_payload: {
                  text: "Rich-space canonical explanation.",
                },
              },
            ],
            semantic_layer: {
              revision_id: "knowledge-1-revision-2",
              status: "confirmed",
              page_summary: "Operator-confirmed summary.",
              retrieval_terms: ["endpoint"],
              retrieval_snippets: ["screening rule"],
            },
            bindings: [
              {
                id: "knowledge-1-revision-2-binding-1",
                revision_id: "knowledge-1-revision-2",
                binding_kind: "module_template",
                binding_target_id: "template-screening-1",
                binding_target_label: "Screening Template",
                created_at: "2026-04-08T08:30:00.000Z",
              },
            ],
            created_at: "2026-04-08T08:30:00.000Z",
            updated_at: "2026-04-08T08:30:00.000Z",
            contributor_label: "editor.zh",
          },
          current_approved_revision: {
            id: "knowledge-1-revision-1",
            asset_id: "knowledge-1",
            revision_no: 1,
            status: "approved",
            title: "Primary endpoint rule",
            canonical_text: "Clinical studies must define the primary endpoint.",
            knowledge_kind: "rule",
            content_blocks: [],
            routing: {
              module_scope: "screening",
              manuscript_types: ["clinical_study"],
            },
            bindings: [],
            created_at: "2026-04-08T08:00:00.000Z",
            updated_at: "2026-04-08T08:10:00.000Z",
            contributor_label: "reviewer.zh",
          },
          revisions: [
            {
              id: "knowledge-1-revision-2",
              asset_id: "knowledge-1",
              revision_no: 2,
              status: "draft",
              title: "Primary endpoint rule draft",
              canonical_text:
                "Clinical studies must define the primary endpoint before screening sign-off.",
              knowledge_kind: "rule",
              content_blocks: [],
              routing: {
                module_scope: "screening",
                manuscript_types: ["clinical_study"],
              },
              bindings: [],
              created_at: "2026-04-08T08:30:00.000Z",
              updated_at: "2026-04-08T08:30:00.000Z",
              contributor_label: "editor.zh",
            },
            {
              id: "knowledge-1-revision-1",
              asset_id: "knowledge-1",
              revision_no: 1,
              status: "approved",
              title: "Primary endpoint rule",
              canonical_text: "Clinical studies must define the primary endpoint.",
              knowledge_kind: "rule",
              content_blocks: [],
              routing: {
                module_scope: "screening",
                manuscript_types: ["clinical_study"],
              },
              bindings: [],
              created_at: "2026-04-08T08:00:00.000Z",
              updated_at: "2026-04-08T08:10:00.000Z",
              contributor_label: "reviewer.zh",
            },
          ],
        },
      }}
    />,
  );

  assert.match(markup, /知识库/);
  assert.match(markup, /知识搜索/);
  assert.match(markup, /多维知识台账/);
  assert.match(markup, /关键词检索/);
  assert.match(markup, /语义检索/);
  assert.match(markup, /贡献账号/);
  assert.match(markup, /语义层/);
  assert.match(markup, /knowledge-library-grid-table/);
  assert.match(markup, /knowledge-library-record-drawer/);
  assert.match(markup, /editor\.zh/);
  assert.match(markup, /Primary endpoint rule draft/);
  assert.match(markup, /knowledge-1-revision-2/);
  assert.match(markup, /Screening Template/);
  assert.doesNotMatch(markup, /Draft Editor/);
});

test("knowledge library duplicate status row renders all inline states", () => {
  const notCheckedMarkup = renderToStaticMarkup(
    <KnowledgeLibraryDuplicateStatusRow
      checkState="not_checked"
      strongMatchCount={0}
      isStale={false}
    />,
  );
  const checkingMarkup = renderToStaticMarkup(
    <KnowledgeLibraryDuplicateStatusRow
      checkState="checking"
      strongMatchCount={0}
      isStale={false}
    />,
  );
  const noStrongMarkup = renderToStaticMarkup(
    <KnowledgeLibraryDuplicateStatusRow
      checkState="checked"
      strongMatchCount={0}
      isStale={false}
    />,
  );
  const strongMarkup = renderToStaticMarkup(
    <KnowledgeLibraryDuplicateStatusRow
      checkState="checked"
      strongMatchCount={2}
      isStale={false}
    />,
  );
  const errorMarkup = renderToStaticMarkup(
    <KnowledgeLibraryDuplicateStatusRow
      checkState="error"
      strongMatchCount={0}
      isStale={false}
      checkErrorMessage="Duplicate check failed: timeout"
    />,
  );

  assert.match(notCheckedMarkup, /Not checked/);
  assert.match(checkingMarkup, /Checking duplicates\.\.\./);
  assert.match(noStrongMarkup, /No strong duplicate signals/);
  assert.match(strongMarkup, /2 strong duplicate matches found/);
  assert.match(errorMarkup, /Duplicate check failed: timeout/);
});

test("duplicate submit decision requires refresh while duplicate checks are pending or stale", () => {
  const checkInput = {
    title: "Primary endpoint draft",
    canonicalText: "Clinical studies must define the primary endpoint.",
    knowledgeKind: "rule",
    moduleScope: "screening",
    manuscriptTypes: ["clinical_study"],
    bindings: [],
    currentAssetId: "knowledge-1",
    currentRevisionId: "knowledge-1-revision-1",
  };
  const matches = [
    {
      severity: "possible" as const,
      score: 0.42,
      matched_asset_id: "knowledge-2",
      matched_revision_id: "knowledge-2-revision-1",
      matched_title: "Terminology overlap",
      matched_status: "approved" as const,
      matched_summary: "Possible overlap only.",
      reasons: ["alias_overlap" as const],
    },
  ];

  assert.equal(
    resolveDuplicateSubmitDecision({
      duplicateCheckInput: checkInput,
      duplicateCheckState: "not_checked",
      duplicateCheckSignature: "signature-a",
      lastCheckedDuplicateSignature: null,
      matches,
    }),
    "refresh_check",
  );
  assert.equal(
    resolveDuplicateSubmitDecision({
      duplicateCheckInput: checkInput,
      duplicateCheckState: "checking",
      duplicateCheckSignature: "signature-a",
      lastCheckedDuplicateSignature: null,
      matches,
    }),
    "refresh_check",
  );
  assert.equal(
    resolveDuplicateSubmitDecision({
      duplicateCheckInput: checkInput,
      duplicateCheckState: "error",
      duplicateCheckSignature: "signature-a",
      lastCheckedDuplicateSignature: null,
      matches,
    }),
    "refresh_check",
  );
  assert.equal(
    resolveDuplicateSubmitDecision({
      duplicateCheckInput: checkInput,
      duplicateCheckState: "checked",
      duplicateCheckSignature: "signature-b",
      lastCheckedDuplicateSignature: "signature-a",
      matches,
    }),
    "refresh_check",
  );
});

test("duplicate submit decision keeps exact and high matches behind confirmation", () => {
  const checkInput = {
    title: "Primary endpoint draft",
    canonicalText: "Clinical studies must define the primary endpoint.",
    knowledgeKind: "rule",
    moduleScope: "screening",
    manuscriptTypes: ["clinical_study"],
    bindings: [],
    currentAssetId: "knowledge-1",
    currentRevisionId: "knowledge-1-revision-1",
  };

  const strongMatches = [
    {
      severity: "exact" as const,
      score: 0.99,
      matched_asset_id: "knowledge-2",
      matched_revision_id: "knowledge-2-revision-1",
      matched_title: "Endpoint requirement",
      matched_status: "approved" as const,
      matched_summary: "Exact overlap.",
      reasons: ["canonical_text_exact_match" as const],
    },
  ];
  const possibleOnly = [
    {
      severity: "possible" as const,
      score: 0.42,
      matched_asset_id: "knowledge-3",
      matched_revision_id: "knowledge-3-revision-1",
      matched_title: "Terminology overlap",
      matched_status: "draft" as const,
      matched_summary: "Possible overlap only.",
      reasons: ["alias_overlap" as const],
    },
  ];

  assert.deepEqual(getStrongDuplicateMatches(strongMatches), strongMatches);
  assert.deepEqual(getStrongDuplicateMatches(possibleOnly), []);
  assert.equal(
    resolveDuplicateSubmitDecision({
      duplicateCheckInput: checkInput,
      duplicateCheckState: "checked",
      duplicateCheckSignature: "signature-a",
      lastCheckedDuplicateSignature: "signature-a",
      matches: strongMatches,
    }),
    "confirm",
  );
  assert.equal(
    resolveDuplicateSubmitDecision({
      duplicateCheckInput: checkInput,
      duplicateCheckState: "checked",
      duplicateCheckSignature: "signature-a",
      lastCheckedDuplicateSignature: "signature-a",
      matches: possibleOnly,
    }),
    "submit",
  );
  assert.equal(
    resolveDuplicateSubmitDecision({
      duplicateCheckInput: null,
      duplicateCheckState: "checked",
      duplicateCheckSignature: null,
      lastCheckedDuplicateSignature: "signature-a",
      matches: strongMatches,
    }),
    "submit",
  );
});

test("duplicate submit confirmation renders required shell actions", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeLibraryDuplicateSubmitConfirmation
      match={{
        severity: "exact",
        score: 0.99,
        matched_asset_id: "knowledge-2",
        matched_revision_id: "knowledge-2-revision-1",
        matched_title: "Endpoint requirement",
        matched_status: "approved",
        matched_summary: "Exact overlap.",
        reasons: ["canonical_text_exact_match"],
      }}
      isBusy={false}
      onOpenAsset={() => undefined}
      onContinueAnyway={() => undefined}
    />,
  );

  assert.match(markup, /Strong duplicate matches detected/);
  assert.match(markup, /Open Existing Asset/);
  assert.match(markup, /Continue Anyway/);
});

test("duplicate submit confirmation invalidates when draft changes after opening", () => {
  assert.equal(
    shouldInvalidateDuplicateSubmitConfirmation({
      isConfirmationOpen: true,
      confirmationDraftSignature: '{"title":"before"}',
      currentDraftSignature: '{"title":"after"}',
    }),
    true,
  );
  assert.equal(
    shouldInvalidateDuplicateSubmitConfirmation({
      isConfirmationOpen: true,
      confirmationDraftSignature: '{"title":"same"}',
      currentDraftSignature: '{"title":"same"}',
    }),
    false,
  );
  assert.equal(
    shouldInvalidateDuplicateSubmitConfirmation({
      isConfirmationOpen: false,
      confirmationDraftSignature: '{"title":"before"}',
      currentDraftSignature: '{"title":"after"}',
    }),
    false,
  );
});

test("duplicate acknowledgement submit decision blocks stale or unavailable continue actions", () => {
  assert.equal(
    resolveDuplicateAcknowledgementSubmitDecision({
      revisionId: "knowledge-1-revision-2",
      hasViewModel: true,
      pendingStrongMatchCount: 1,
      isBusy: false,
      isImmediateDuplicateCheckPending: false,
      isConfirmationOpen: true,
      confirmationDraftSignature: '{"title":"before"}',
      currentDraftSignature: '{"title":"after"}',
    }),
    "stale",
  );
  assert.equal(
    resolveDuplicateAcknowledgementSubmitDecision({
      revisionId: "knowledge-1-revision-2",
      hasViewModel: true,
      pendingStrongMatchCount: 1,
      isBusy: false,
      isImmediateDuplicateCheckPending: false,
      isConfirmationOpen: true,
      confirmationDraftSignature: '{"title":"same"}',
      currentDraftSignature: '{"title":"same"}',
    }),
    "submit",
  );
  assert.equal(
    resolveDuplicateAcknowledgementSubmitDecision({
      revisionId: "knowledge-1-revision-2",
      hasViewModel: true,
      pendingStrongMatchCount: 0,
      isBusy: false,
      isImmediateDuplicateCheckPending: false,
      isConfirmationOpen: true,
      confirmationDraftSignature: '{"title":"same"}',
      currentDraftSignature: '{"title":"same"}',
    }),
    "blocked",
  );
});

test("immediate duplicate-check stale guard rejects outdated request ids and draft contexts", () => {
  assert.equal(
    isImmediateDuplicateCheckResultStale({
      requestId: 2,
      latestRequestId: 3,
      expectedContext: {
        selectedRevisionId: "knowledge-1-revision-2",
        duplicateCheckSignature: "signature-a",
      },
      currentContext: {
        selectedRevisionId: "knowledge-1-revision-2",
        duplicateCheckSignature: "signature-a",
      },
    }),
    true,
  );
  assert.equal(
    isImmediateDuplicateCheckResultStale({
      requestId: 3,
      latestRequestId: 3,
      expectedContext: {
        selectedRevisionId: "knowledge-1-revision-2",
        duplicateCheckSignature: "signature-a",
      },
      currentContext: {
        selectedRevisionId: "knowledge-1-revision-2",
        duplicateCheckSignature: "signature-b",
      },
    }),
    true,
  );
  assert.equal(
    isImmediateDuplicateCheckResultStale({
      requestId: 3,
      latestRequestId: 3,
      expectedContext: {
        selectedRevisionId: "knowledge-1-revision-2",
        duplicateCheckSignature: "signature-b",
      },
      currentContext: {
        selectedRevisionId: "knowledge-1-revision-2",
        duplicateCheckSignature: "signature-b",
      },
    }),
    false,
  );
});

test("duplicate check trigger signature uses normalized request fields only", () => {
  const baselineSignature = buildDuplicateCheckTriggerSignature({
    title: " Primary endpoint draft ",
    canonicalText: " Clinical studies must define the primary endpoint. ",
    summary: " Key summary ",
    knowledgeKind: "rule",
    moduleScope: "screening",
    manuscriptTypes: ["clinical_study"],
    sections: [" methods "],
    riskTags: [" statistics "],
    disciplineTags: [" oncology "],
    aliases: [" endpoint "],
    bindings: [
      {
        bindingKind: "module_template",
        bindingTargetId: " template-screening-1 ",
        bindingTargetLabel: " Screening Template ",
      },
    ],
    currentAssetId: " knowledge-1 ",
    currentRevisionId: " knowledge-1-revision-2 ",
  });
  const noisySignature = buildDuplicateCheckTriggerSignature({
    title: "Primary endpoint draft",
    canonicalText: "Clinical studies must define the primary endpoint.",
    summary: "Key summary",
    knowledgeKind: "rule",
    moduleScope: "screening",
    manuscriptTypes: ["clinical_study"],
    sections: ["methods"],
    riskTags: ["statistics"],
    disciplineTags: ["oncology"],
    aliases: ["endpoint"],
    bindings: [
      {
        bindingKind: "module_template",
        bindingTargetId: "template-screening-1",
        bindingTargetLabel: "Screening Template",
      },
    ],
    currentAssetId: "knowledge-1",
    currentRevisionId: "knowledge-1-revision-2",
    // This reflects non-request form noise and should not affect the signature.
    ignoredNoise: "source_link changed",
  } as unknown as Parameters<typeof buildDuplicateCheckTriggerSignature>[0]);
  const changedCanonicalTextSignature = buildDuplicateCheckTriggerSignature({
    title: "Primary endpoint draft",
    canonicalText: "Clinical studies must define the endpoint before sign-off.",
    summary: "Key summary",
    knowledgeKind: "rule",
    moduleScope: "screening",
    manuscriptTypes: ["clinical_study"],
    bindings: [],
  });

  assert.equal(baselineSignature, noisySignature);
  assert.notEqual(baselineSignature, changedCanonicalTextSignature);
});
