import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

register(new URL("./helpers/ignore-css-loader.mjs", import.meta.url), import.meta.url);

const {
  KnowledgeLibraryWorkbenchPage,
} = await import("../src/features/knowledge-library/knowledge-library-workbench-page.tsx");

test("knowledge library workbench page renders the standalone authoring shell", () => {
  const markup = renderToStaticMarkup(
    <KnowledgeLibraryWorkbenchPage
      initialViewModel={{
        library: [
          {
            id: "knowledge-1",
            title: "Primary endpoint rule",
            canonical_text: "Clinical studies must define the primary endpoint.",
            summary: "Screening knowledge.",
            knowledge_kind: "rule",
            status: "draft",
            routing: {
              module_scope: "screening",
              manuscript_types: ["clinical_study"],
            },
            template_bindings: ["template-screening-1"],
          },
        ],
        visibleLibrary: [
          {
            id: "knowledge-1",
            title: "Primary endpoint rule",
            canonical_text: "Clinical studies must define the primary endpoint.",
            summary: "Screening knowledge.",
            knowledge_kind: "rule",
            status: "draft",
            routing: {
              module_scope: "screening",
              manuscript_types: ["clinical_study"],
            },
            template_bindings: ["template-screening-1"],
          },
        ],
        filters: {
          searchText: "",
          status: "all",
          knowledgeKind: "all",
        },
        selectedAssetId: "knowledge-1",
        selectedRevisionId: "knowledge-1-revision-2",
        selectedSummary: {
          id: "knowledge-1",
          title: "Primary endpoint rule",
          canonical_text: "Clinical studies must define the primary endpoint.",
          summary: "Screening knowledge.",
          knowledge_kind: "rule",
          status: "draft",
          routing: {
            module_scope: "screening",
            manuscript_types: ["clinical_study"],
          },
          template_bindings: ["template-screening-1"],
        },
        detail: {
          asset: {
            id: "knowledge-1",
            status: "active",
            current_revision_id: "knowledge-1-revision-2",
            current_approved_revision_id: "knowledge-1-revision-1",
            created_at: "2026-04-08T08:00:00.000Z",
            updated_at: "2026-04-08T08:30:00.000Z",
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
          },
          current_approved_revision: {
            id: "knowledge-1-revision-1",
            asset_id: "knowledge-1",
            revision_no: 1,
            status: "approved",
            title: "Primary endpoint rule",
            canonical_text: "Clinical studies must define the primary endpoint.",
            knowledge_kind: "rule",
            routing: {
              module_scope: "screening",
              manuscript_types: ["clinical_study"],
            },
            bindings: [],
            created_at: "2026-04-08T08:00:00.000Z",
            updated_at: "2026-04-08T08:10:00.000Z",
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
              routing: {
                module_scope: "screening",
                manuscript_types: ["clinical_study"],
              },
              bindings: [],
              created_at: "2026-04-08T08:30:00.000Z",
              updated_at: "2026-04-08T08:30:00.000Z",
            },
            {
              id: "knowledge-1-revision-1",
              asset_id: "knowledge-1",
              revision_no: 1,
              status: "approved",
              title: "Primary endpoint rule",
              canonical_text: "Clinical studies must define the primary endpoint.",
              knowledge_kind: "rule",
              routing: {
                module_scope: "screening",
                manuscript_types: ["clinical_study"],
              },
              bindings: [],
              created_at: "2026-04-08T08:00:00.000Z",
              updated_at: "2026-04-08T08:10:00.000Z",
            },
          ],
        },
      }}
    />,
  );

  assert.match(markup, /Knowledge Library/);
  assert.match(markup, /Authoring Pipeline/);
  assert.match(markup, /Library Queue/);
  assert.match(markup, /Draft Editor/);
  assert.match(markup, /Structured Bindings/);
  assert.match(markup, /Revision Timeline/);
  assert.match(markup, /Primary endpoint rule draft/);
  assert.match(markup, /knowledge-1-revision-2/);
  assert.match(markup, /Screening Template/);
});
