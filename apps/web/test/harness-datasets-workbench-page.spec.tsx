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
      {
        id: "version-published-3",
        familyId: "family-3",
        familyName: "Screening gold set",
        familyScope: {
          module: "screening",
          manuscriptTypes: ["clinical_study"],
          measureFocus: "triage",
        },
        versionNo: 3,
        status: "published",
        itemCount: 3,
        createdBy: "persistent.admin",
        createdAt: "2026-04-04T12:00:00.000Z",
        publishedBy: "persistent.admin",
        publishedAt: "2026-04-04T13:00:00.000Z",
        deidentificationGatePassed: true,
        humanReviewGatePassed: true,
        rubricAssignment: {
          status: "missing",
        },
        sourceProvenance: [
          {
            sourceKind: "evaluation_evidence_pack",
            sourceId: "pack-3",
            manuscriptId: "manuscript-4",
            manuscriptType: "clinical_study",
            deidentificationPassed: true,
            humanReviewed: true,
          },
        ],
        publications: [],
      },
      {
        id: "version-published-4",
        familyId: "family-4",
        familyName: "Review gold set",
        familyScope: {
          module: "editing",
          manuscriptTypes: ["review"],
          measureFocus: "deidentification",
        },
        versionNo: 1,
        status: "published",
        itemCount: 2,
        createdBy: "persistent.admin",
        createdAt: "2026-04-04T14:00:00.000Z",
        publishedBy: "persistent.admin",
        publishedAt: "2026-04-04T15:00:00.000Z",
        deidentificationGatePassed: false,
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
            sourceId: "asset-4",
            manuscriptId: "manuscript-5",
            manuscriptType: "review",
            deidentificationPassed: false,
            humanReviewed: true,
          },
        ],
        publications: [],
      },
      {
        id: "version-published-5",
        familyId: "family-5",
        familyName: "Proofreading release candidate gold set",
        familyScope: {
          module: "proofreading",
          manuscriptTypes: ["case_report"],
          measureFocus: "human review",
        },
        versionNo: 5,
        status: "published",
        itemCount: 4,
        createdBy: "persistent.admin",
        createdAt: "2026-04-04T16:00:00.000Z",
        publishedBy: "persistent.admin",
        publishedAt: "2026-04-04T17:00:00.000Z",
        deidentificationGatePassed: true,
        humanReviewGatePassed: false,
        rubricAssignment: {
          status: "published",
          rubricDefinitionId: "rubric-2",
          rubricName: "Editing rubric",
          rubricVersionNo: 2,
        },
        sourceProvenance: [
          {
            sourceKind: "reviewed_case_snapshot",
            sourceId: "snapshot-5",
            manuscriptId: "manuscript-6",
            manuscriptType: "case_report",
            deidentificationPassed: true,
            humanReviewed: false,
          },
        ],
        publications: [],
      },
    ],
    archivedVersions: [],
  };
}

function renderLoadedPage(
  overview = createHarnessDatasetsOverviewFixture(),
) {
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
  assert.match(markup, /管理区/);
  assert.match(markup, /workbench-core-strip is-secondary/);
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

test("harness datasets workbench page reports release-freeze readiness and exact blocking reasons for published gold sets", () => {
  const markup = renderLoadedPage();

  assert.match(markup, /Release-freeze ready/);
  assert.match(markup, /Editing gold set/);
  assert.match(markup, /De-identification: passed/);
  assert.match(markup, /Human review: passed/);
  assert.match(markup, /Release-freeze ready for manifest and export citation\./);

  assert.match(markup, /Screening gold set/);
  assert.match(markup, /Release-freeze not ready: missing published rubric\./);

  assert.match(markup, /Review gold set/);
  assert.match(markup, /Release-freeze not ready: de-identification pending\./);

  assert.match(markup, /Proofreading release candidate gold set/);
  assert.match(markup, /Release-freeze not ready: human review pending\./);
});

test("harness datasets workbench page keeps export behavior local-first after readiness signals are added", () => {
  const markup = renderLoadedPage();

  assert.match(markup, /Export JSON/);
  assert.match(markup, /Export JSONL/);
  assert.match(markup, /\.local-data\/harness-exports\/development\/version-published-2\.json/);
  assert.doesNotMatch(markup, /Activate/);
  assert.doesNotMatch(markup, /Promote/);
  assert.doesNotMatch(markup, /Publish online/);
});
