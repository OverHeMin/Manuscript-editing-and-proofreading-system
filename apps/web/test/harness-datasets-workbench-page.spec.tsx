import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  HarnessDatasetsWorkbenchPage,
} from "../src/features/harness-datasets/harness-datasets-workbench-page.tsx";

function createHarnessDatasetsOverviewFixture() {
  return {
    exportRootDir: ".local-data/harness-exports/development",
    rubrics: [
      {
        id: "rubric-2",
        name: "Editing rubric",
        versionNo: 2,
        status: "published",
      },
    ],
    draftVersions: [
      {
        id: "version-draft-1",
        familyId: "family-1",
        familyName: "Proofreading gold set",
        familyScope: {
          module: "proofreading",
          manuscriptTypes: ["clinical_study"],
          measureFocus: "issue detection",
        },
        versionNo: 1,
        status: "draft",
        itemCount: 1,
        createdBy: "persistent.admin",
        createdAt: "2026-04-04T09:00:00.000Z",
        deidentificationGatePassed: true,
        humanReviewGatePassed: true,
        rubricAssignment: {
          status: "missing",
        },
        sourceProvenance: [
          {
            sourceKind: "reviewed_case_snapshot",
            sourceId: "snapshot-1",
            manuscriptId: "manuscript-1",
            manuscriptType: "clinical_study",
            deidentificationPassed: true,
            humanReviewed: true,
          },
        ],
        publications: [],
      },
    ],
    publishedVersions: [
      {
        id: "version-published-2",
        familyId: "family-2",
        familyName: "Editing gold set",
        familyScope: {
          module: "editing",
          manuscriptTypes: ["review"],
          measureFocus: "conformance",
        },
        versionNo: 2,
        status: "published",
        itemCount: 2,
        createdBy: "persistent.admin",
        createdAt: "2026-04-04T10:00:00.000Z",
        publishedBy: "persistent.admin",
        publishedAt: "2026-04-04T11:00:00.000Z",
        deidentificationGatePassed: true,
        humanReviewGatePassed: true,
        rubricAssignment: {
          status: "published",
          rubricDefinitionId: "rubric-2",
          rubricName: "Editing rubric",
          rubricVersionNo: 2,
        },
        sourceProvenance: [
          {
            sourceKind: "human_final_asset",
            sourceId: "asset-2",
            manuscriptId: "manuscript-2",
            manuscriptType: "review",
            deidentificationPassed: true,
            humanReviewed: true,
            riskTags: ["terminology"],
          },
          {
            sourceKind: "evaluation_evidence_pack",
            sourceId: "pack-2",
            manuscriptId: "manuscript-3",
            manuscriptType: "review",
            deidentificationPassed: true,
            humanReviewed: true,
          },
        ],
        publications: [
          {
            id: "publication-1",
            goldSetVersionId: "version-published-2",
            exportFormat: "json",
            status: "succeeded",
            outputUri:
              ".local-data/harness-exports/development/version-published-2.json",
            deidentificationGatePassed: true,
            createdAt: "2026-04-04T11:02:00.000Z",
          },
        ],
      },
    ],
    archivedVersions: [],
  };
}

function renderLoadedPage() {
  const overview = createHarnessDatasetsOverviewFixture();
  const controller = {
    loadOverview: async () => overview,
  } as React.ComponentProps<typeof HarnessDatasetsWorkbenchPage>["controller"];

  return renderToStaticMarkup(
    <HarnessDatasetsWorkbenchPage controller={controller} initialOverview={overview} />,
  );
}

test("harness datasets workbench page renders a loading state for server-side shell output", () => {
  const markup = renderToStaticMarkup(
    <HarnessDatasetsWorkbenchPage
      controller={{
        loadOverview: async () => {
          throw new Error("not used");
        },
      }}
    />,
  );

  assert.match(markup, /Harness Dataset Workbench/);
  assert.match(markup, /Loading gold-set drafts, published versions, and rubric links\.\.\./);
});

test("harness datasets workbench page renders curation queue, published exports, and provenance detail", () => {
  const markup = renderLoadedPage();

  assert.match(markup, /Operations Management Zone/);
  assert.match(markup, /Harness Dataset Workbench/);
  assert.match(markup, /Bounded admin-only workbench for governed gold-set curation and local export\./);
  assert.match(markup, /Draft Queue/);
  assert.match(markup, /Published Versions/);
  assert.match(markup, /Proofreading gold set/);
  assert.match(markup, /Editing gold set/);
  assert.match(markup, /Rubric: Manual assignment required/);
  assert.match(markup, /Rubric: Editing rubric v2 \(published\)/);
  assert.match(markup, /reviewed_case_snapshot: snapshot-1/);
  assert.match(markup, /human_final_asset: asset-2/);
  assert.match(markup, /evaluation_evidence_pack: pack-2/);
  assert.match(markup, /Local export root: \.local-data\/harness-exports\/development/);
  assert.match(markup, /Export JSON/);
  assert.match(markup, /Export JSONL/);
  assert.doesNotMatch(markup, /Export JSON<\/button><button[^>]*>Export JSONL<\/button><\/div><\/article><article[^>]*><header[^>]*><div><h4>Proofreading gold set/);
});
