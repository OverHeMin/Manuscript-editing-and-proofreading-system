import test from "node:test";
import assert from "node:assert/strict";
import { DocumentAssetService } from "../../src/modules/assets/document-asset-service.ts";
import { InMemoryDocumentAssetRepository } from "../../src/modules/assets/in-memory-document-asset-repository.ts";
import { InMemoryManuscriptRepository } from "../../src/modules/manuscripts/in-memory-manuscript-repository.ts";
import { createPdfConsistencyApi } from "../../src/modules/pdf-consistency/pdf-consistency-api.ts";
import { InMemoryPdfConsistencyIssueRepository } from "../../src/modules/pdf-consistency/in-memory-pdf-consistency-repository.ts";
import type { PdfConsistencyIssueRecord } from "../../src/modules/pdf-consistency/pdf-consistency-record.ts";
import { PdfConsistencyService } from "../../src/modules/pdf-consistency/pdf-consistency-service.ts";

class FailingPdfConsistencyIssueRepository extends InMemoryPdfConsistencyIssueRepository {
  constructor(
    private readonly shouldFail: (records: PdfConsistencyIssueRecord[]) => boolean,
  ) {
    super();
  }

  override async saveMany(records: PdfConsistencyIssueRecord[]): Promise<void> {
    if (this.shouldFail(records)) {
      throw new Error("Injected pdf consistency issue persistence failure.");
    }

    await super.saveMany(records);
  }
}

function createPdfConsistencyHarness(
  issueRepository: InMemoryPdfConsistencyIssueRepository = new InMemoryPdfConsistencyIssueRepository(),
) {
  const manuscriptRepository = new InMemoryManuscriptRepository();
  const assetRepository = new InMemoryDocumentAssetRepository();
  const assetIds = ["asset-1", "asset-2", "asset-3", "asset-4"];
  const issueIds = ["issue-1", "issue-2", "issue-3", "issue-4"];
  const nextValue = (bucket: string[], label: string) => {
    const value = bucket.shift();
    assert.ok(value, `Expected a ${label} id to be available.`);
    return value;
  };

  const documentAssetService = new DocumentAssetService({
    manuscriptRepository,
    assetRepository,
    createId: () => nextValue(assetIds, "asset"),
    now: () => new Date("2026-03-27T11:00:00.000Z"),
  });
  const pdfConsistencyService = new PdfConsistencyService({
    manuscriptRepository,
    assetRepository,
    issueRepository,
    documentAssetService,
    createId: () => nextValue(issueIds, "issue"),
    now: () => new Date("2026-03-27T11:00:00.000Z"),
  });

  return {
    manuscriptRepository,
    assetRepository,
    issueRepository,
    documentAssetService,
    api: createPdfConsistencyApi({
      pdfConsistencyService,
    }),
  };
}

async function seedPdfConsistencyContext(
  issueRepository?: InMemoryPdfConsistencyIssueRepository,
) {
  const harness = createPdfConsistencyHarness(issueRepository);

  await harness.manuscriptRepository.save({
    id: "manuscript-1",
    title: "PDF Consistency Fixture",
    manuscript_type: "clinical_study",
    status: "uploaded",
    created_by: "user-1",
    current_screening_asset_id: undefined,
    current_editing_asset_id: undefined,
    current_proofreading_asset_id: undefined,
    current_template_family_id: "family-1",
    created_at: "2026-03-27T10:55:00.000Z",
    updated_at: "2026-03-27T10:55:00.000Z",
  });

  const originalAsset = await harness.documentAssetService.createAsset({
    manuscriptId: "manuscript-1",
    assetType: "original",
    storageKey: "uploads/manuscript-1/original.pdf",
    mimeType: "application/pdf",
    createdBy: "user-1",
    fileName: "original.pdf",
    sourceModule: "upload",
  });

  return {
    ...harness,
    originalAsset,
  };
}

test("pdf consistency reports persist issue lists under the current report asset", async () => {
  const { api, originalAsset } = await seedPdfConsistencyContext();

  const created = await api.createReport({
    manuscriptId: "manuscript-1",
    parentAssetId: originalAsset.id,
    requestedBy: "proofreader-1",
    storageKey: "runs/manuscript-1/pdf-consistency/report-1.json",
    issues: [
      {
        issue_type: "toc_numbering_mismatch",
        toc_heading: { number: "2", title: "Methods" },
        body_heading: { number: "3", title: "Methods" },
      },
      {
        issue_type: "body_missing_in_toc",
        body_heading: { number: "4", title: "Discussion" },
      },
    ],
  });

  assert.equal(created.status, 201);
  assert.equal(created.body.asset.asset_type, "pdf_consistency_report");
  assert.equal(created.body.asset.parent_asset_id, originalAsset.id);
  assert.equal(created.body.issues.length, 2);

  const listed = await api.listIssues({
    manuscriptId: "manuscript-1",
  });

  assert.equal(listed.status, 200);
  assert.deepEqual(listed.body, [
    {
      issue_type: "toc_numbering_mismatch",
      toc_heading: { number: "2", title: "Methods" },
      body_heading: { number: "3", title: "Methods" },
    },
    {
      issue_type: "body_missing_in_toc",
      body_heading: { number: "4", title: "Discussion" },
    },
  ]);
});

test("listing pdf consistency issues only returns the latest current report", async () => {
  const { api, assetRepository, originalAsset } = await seedPdfConsistencyContext();

  const first = await api.createReport({
    manuscriptId: "manuscript-1",
    parentAssetId: originalAsset.id,
    requestedBy: "proofreader-1",
    storageKey: "runs/manuscript-1/pdf-consistency/report-1.json",
    issues: [
      {
        issue_type: "toc_missing_in_body",
        toc_heading: { number: "3", title: "Results" },
      },
    ],
  });

  const second = await api.createReport({
    manuscriptId: "manuscript-1",
    parentAssetId: originalAsset.id,
    requestedBy: "proofreader-1",
    storageKey: "runs/manuscript-1/pdf-consistency/report-2.json",
    issues: [
      {
        issue_type: "needs_manual_review",
        toc_heading: { number: "4", title: "Discussion" },
        body_heading: { number: "4", title: "Conclusions" },
      },
    ],
  });

  const listed = await api.listIssues({
    manuscriptId: "manuscript-1",
  });
  const reportAssets = await assetRepository.listByManuscriptIdAndType(
    "manuscript-1",
    "pdf_consistency_report",
  );

  assert.equal(first.body.asset.is_current, true);
  assert.equal(second.body.asset.is_current, true);
  assert.deepEqual(listed.body, [
    {
      issue_type: "needs_manual_review",
      toc_heading: { number: "4", title: "Discussion" },
      body_heading: { number: "4", title: "Conclusions" },
    },
  ]);
  assert.equal(reportAssets.length, 2);
  assert.equal(reportAssets.filter((asset) => asset.is_current).length, 1);
  assert.equal(
    reportAssets.find((asset) => asset.is_current)?.storage_key,
    "runs/manuscript-1/pdf-consistency/report-2.json",
  );
});

test("pdf consistency report creation rolls back the report asset if issue persistence fails", async () => {
  const issueRepository = new FailingPdfConsistencyIssueRepository(() => true);
  const { api, assetRepository, originalAsset } =
    await seedPdfConsistencyContext(issueRepository);

  await assert.rejects(
    () =>
      api.createReport({
        manuscriptId: "manuscript-1",
        parentAssetId: originalAsset.id,
        requestedBy: "proofreader-1",
        storageKey: "runs/manuscript-1/pdf-consistency/report-fail.json",
        issues: [
          {
            issue_type: "toc_missing_in_body",
            toc_heading: { number: "5", title: "Appendix" },
          },
        ],
      }),
    /issue persistence failure/i,
  );

  const reportAssets = await assetRepository.listByManuscriptIdAndType(
    "manuscript-1",
    "pdf_consistency_report",
  );

  assert.deepEqual(reportAssets, []);
});
