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

  assert.match(markup, /Harness 控制 \/ 数据与样本/);
  assert.match(markup, /正在载入金标准草稿、已发布版本与评分规则关联/u);
});

test("harness datasets workbench page can render in an embedded harness-owned mode", () => {
  const markup = renderToStaticMarkup(
    <HarnessDatasetsWorkbenchPage
      embedded
      controller={{
        loadOverview: async () => {
          throw new Error("not used");
        },
      }}
      initialOverview={createHarnessDatasetsOverviewFixture() as never}
    />,
  );

  assert.doesNotMatch(markup, /harness-datasets-hero/u);
  assert.doesNotMatch(markup, /workbench-core-strip is-secondary/u);
  assert.match(markup, /待整理队列/u);
  assert.match(markup, /已发布版本/u);
});

test("harness datasets workbench page renders curation queue, published exports, and provenance detail", () => {
  const markup = renderLoadedPage();

  assert.match(markup, /Harness 控制/);
  assert.match(markup, /管理区/);
  assert.match(markup, /workbench-core-strip is-secondary/);
  assert.match(markup, /Harness 控制 \/ 数据与样本/);
  assert.match(markup, /统一整理高质量样本、评分规则与本地导出/u);
  assert.match(markup, /待整理队列/);
  assert.match(markup, /已发布版本/);
  assert.match(markup, /Proofreading gold set/);
  assert.match(markup, /Editing gold set/);
  assert.match(markup, /评分规则：需要人工指定/);
  assert.match(markup, /评分规则：Editing rubric v2（已发布）/u);
  assert.match(markup, /关注重点：问题识别 · 稿件类型：临床研究/u);
  assert.match(markup, /关注重点：规范一致性 · 稿件类型：综述/u);
  assert.match(markup, /已复核案例快照: snapshot-1/);
  assert.match(markup, /人工终稿资产: asset-2/);
  assert.match(markup, /评测证据包: pack-2/);
  assert.match(markup, /本地导出目录：\.local-data\/harness-exports\/development/);
  assert.match(markup, /导出 JSON/);
  assert.match(markup, /导出 JSONL/);
  assert.doesNotMatch(markup, /导出 JSON<\/button><button[^>]*>导出 JSONL<\/button><\/div><\/article><article[^>]*><header[^>]*><div><h4>Proofreading gold set/);
});

test("harness datasets workbench page reports release-freeze readiness and exact blocking reasons for published gold sets", () => {
  const markup = renderLoadedPage();

  assert.match(markup, /发布冻结已就绪/);
  assert.match(markup, /Editing gold set/);
  assert.match(markup, /脱敏校验：已通过/);
  assert.match(markup, /人工复核：已通过/);
  assert.match(markup, /发布冻结已就绪，可用于清单记录与导出引用。/u);

  assert.match(markup, /Screening gold set/);
  assert.match(markup, /发布冻结未就绪：缺少已发布的评分规则。/u);

  assert.match(markup, /Review gold set/);
  assert.match(markup, /发布冻结未就绪：脱敏校验尚未完成。/u);

  assert.match(markup, /Proofreading release candidate gold set/);
  assert.match(markup, /发布冻结未就绪：人工复核尚未完成。/u);
});

test("harness datasets workbench page keeps export behavior local-first after readiness signals are added", () => {
  const markup = renderLoadedPage();

  assert.match(markup, /导出 JSON/);
  assert.match(markup, /导出 JSONL/);
  assert.match(markup, /\.local-data\/harness-exports\/development\/version-published-2\.json/);
  assert.doesNotMatch(markup, /Activate/);
  assert.doesNotMatch(markup, /Promote/);
  assert.doesNotMatch(markup, /Publish online/);
});
