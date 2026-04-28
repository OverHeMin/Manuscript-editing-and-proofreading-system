import test from "node:test";
import assert from "node:assert/strict";
import { DocumentAssetService } from "../../src/modules/assets/document-asset-service.ts";
import { InMemoryDocumentAssetRepository } from "../../src/modules/assets/in-memory-document-asset-repository.ts";
import { InMemoryExecutionTrackingRepository } from "../../src/modules/execution-tracking/in-memory-execution-tracking-repository.ts";
import { ExecutionTrackingService } from "../../src/modules/execution-tracking/execution-tracking-service.ts";
import { InMemoryJobRepository } from "../../src/modules/jobs/in-memory-job-repository.ts";
import { createManuscriptApi } from "../../src/modules/manuscripts/manuscript-api.ts";
import { InMemoryManuscriptRepository } from "../../src/modules/manuscripts/in-memory-manuscript-repository.ts";
import { ManuscriptLifecycleService } from "../../src/modules/manuscripts/manuscript-lifecycle-service.ts";
import { InMemoryTemplateFamilyRepository } from "../../src/modules/templates/in-memory-template-family-repository.ts";

test("manuscript harness matrix projects deep proofreading diagnostics from job payload", async () => {
  const manuscriptRepository = new InMemoryManuscriptRepository();
  const assetRepository = new InMemoryDocumentAssetRepository();
  const jobRepository = new InMemoryJobRepository();
  const templateFamilyRepository = new InMemoryTemplateFamilyRepository();
  const executionTrackingRepository = new InMemoryExecutionTrackingRepository();
  const executionTrackingService = new ExecutionTrackingService({
    repository: executionTrackingRepository,
  });
  const manuscriptService = new ManuscriptLifecycleService({
    manuscriptRepository,
    assetRepository,
    jobRepository,
    templateFamilyRepository,
    createId: () => "unused",
    now: () => new Date("2026-04-28T10:00:00.000Z"),
  });
  const assetService = new DocumentAssetService({
    manuscriptRepository,
    assetRepository,
    createId: () => "unused-asset",
    now: () => new Date("2026-04-28T10:00:00.000Z"),
  });
  const api = createManuscriptApi({
    manuscriptService,
    assetService,
    executionTrackingService,
  });

  await manuscriptRepository.save({
    id: "manuscript-1",
    title: "Deep proofreading manuscript",
    manuscript_type: "clinical_study",
    status: "uploaded",
    created_by: "user-1",
    created_at: "2026-04-28T09:00:00.000Z",
    updated_at: "2026-04-28T09:00:00.000Z",
  });
  await jobRepository.save({
    id: "job-proofreading-1",
    manuscript_id: "manuscript-1",
    module: "proofreading",
    job_type: "proofreading_draft_run",
    status: "completed",
    requested_by: "proofreader-1",
    payload: {
      snapshotId: "snapshot-proofreading-1",
      deepProofreading: {
        schema: "deep_proofreading_run.v1",
        factLedgerSummary: {
          factCount: 12,
          conflictCount: 2,
        },
        tableFidelityDiagnostics: {
          tableCount: 3,
          confidenceCounts: { high: 2, medium: 1, low: 0 },
          unsupportedStructureCount: 1,
          lowConfidenceReviewOnly: false,
        },
        selectedRuleDiagnostics: {
          totalSelected: 8,
          byPassKind: { data_statistics_units_and_tables: 5 },
        },
        selectedKnowledgeBudgetDiagnostics: {
          totalSelected: 4,
          totalExcluded: 9,
          estimatedTokens: 800,
          byPassKind: { data_statistics_units_and_tables: 3 },
        },
        passRuns: [
          {
            passKind: "data_statistics_units_and_tables",
            sliceId: "slice-table-1",
            status: "completed",
            issueCount: 2,
          },
        ],
        stageDiagnostics: [
          {
            passKind: "final_regression_preparation",
            status: "completed",
            issueCount: 3,
          },
        ],
      },
    },
    attempt_count: 1,
    created_at: "2026-04-28T10:00:00.000Z",
    updated_at: "2026-04-28T10:05:00.000Z",
  });
  await executionTrackingRepository.saveSnapshot({
    id: "snapshot-proofreading-1",
    manuscript_id: "manuscript-1",
    module: "proofreading",
    job_id: "job-proofreading-1",
    execution_profile_id: "profile-proofreading-1",
    module_template_id: "template-proofreading-1",
    module_template_version_no: 1,
    prompt_template_id: "prompt-proofreading-1",
    prompt_template_version: "1.0.0",
    skill_package_ids: [],
    skill_package_versions: [],
    model_id: "model-1",
    knowledge_item_ids: [],
    created_asset_ids: [],
    created_at: "2026-04-28T10:05:00.000Z",
  });

  const response = await api.getHarnessMatrix({ manuscriptId: "manuscript-1" });
  const proofreadingModule = response.body.modules.find(
    (module) => module.module === "proofreading",
  );
  assert.ok(proofreadingModule);

  const passItem = proofreadingModule.matrix_items.find(
    (item) => item.key === "proofreading_pass.payload.1.data_statistics_units_and_tables",
  );
  assert.equal(passItem?.state, "hit");
  assert.equal(passItem?.evidence?.slice_id, "slice-table-1");

  const factItem = proofreadingModule.matrix_items.find(
    (item) => item.key === "proofreading_deep.fact_ledger",
  );
  assert.equal(factItem?.evidence?.conflict_count, 2);

  const budgetItem = proofreadingModule.matrix_items.find(
    (item) => item.key === "proofreading_deep.knowledge_budget",
  );
  assert.equal(budgetItem?.evidence?.total_selected, 4);
});
