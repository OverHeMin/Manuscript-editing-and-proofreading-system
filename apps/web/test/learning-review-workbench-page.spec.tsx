import assert from "node:assert/strict";
import test from "node:test";
import {
  loadLearningReviewPrefill,
} from "../src/features/learning-review/learning-review-prefill.ts";

test("loadLearningReviewPrefill derives snapshot and candidate defaults from the manuscript asset chain", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];

  const result = await loadLearningReviewPrefill(
    {
      request: async (input: {
        method: "GET" | "POST";
        url: string;
        body?: unknown;
      }): Promise<{ status: number; body: unknown }> => {
        requests.push(input);

        if (input.method === "GET" && input.url === "/api/v1/manuscripts/manuscript-1") {
          return {
            status: 200,
            body: {
              id: "manuscript-1",
              title: "Prefilled learning handoff",
              manuscript_type: "clinical_study",
              status: "completed",
              created_by: "proofreader-1",
              current_proofreading_asset_id: "asset-human-final-1",
              created_at: "2026-03-31T09:00:00.000Z",
              updated_at: "2026-03-31T10:15:00.000Z",
            },
          };
        }

        if (
          input.method === "GET" &&
          input.url === "/api/v1/manuscripts/manuscript-1/assets"
        ) {
          return {
            status: 200,
            body: [
              {
                id: "asset-human-final-1",
                manuscript_id: "manuscript-1",
                asset_type: "human_final_docx",
                status: "active",
                storage_key: "runs/manuscript-1/proofreading/human-final.docx",
                mime_type:
                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                parent_asset_id: "asset-proof-final-1",
                source_module: "manual",
                source_job_id: "job-human-final-1",
                created_by: "proofreader-1",
                version_no: 1,
                is_current: true,
                file_name: "human-final.docx",
                created_at: "2026-03-31T10:15:00.000Z",
                updated_at: "2026-03-31T10:15:00.000Z",
              },
              {
                id: "asset-proof-final-1",
                manuscript_id: "manuscript-1",
                asset_type: "final_proof_annotated_docx",
                status: "superseded",
                storage_key: "runs/manuscript-1/proofreading/final.docx",
                mime_type:
                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                parent_asset_id: "asset-proof-draft-1",
                source_module: "proofreading",
                source_job_id: "job-proof-final-1",
                created_by: "proofreader-1",
                version_no: 4,
                is_current: true,
                file_name: "proofreading-final.docx",
                created_at: "2026-03-31T10:10:00.000Z",
                updated_at: "2026-03-31T10:10:00.000Z",
              },
            ],
          };
        }

        throw new Error(`Unexpected request: ${input.method} ${input.url}`);
      },
    },
    {
      manuscriptId: "manuscript-1",
      actorRole: "knowledge_reviewer",
    },
  );

  assert.equal(result.status, "Prefilled learning review for manuscript manuscript-1");
  assert.equal(result.snapshotForm.manuscriptId, "manuscript-1");
  assert.equal(result.snapshotForm.manuscriptType, "clinical_study");
  assert.equal(result.snapshotForm.humanFinalAssetId, "asset-human-final-1");
  assert.equal(result.snapshotForm.annotatedAssetId, "asset-proof-final-1");
  assert.equal(
    result.snapshotForm.storageKey,
    "learning/manuscript-1/reviewed-case-snapshot.bin",
  );
  assert.equal(result.candidateForm.snapshotId, "");
  assert.equal(
    result.candidateForm.governedSource.sourceAssetId,
    "asset-human-final-1",
  );
  assert.equal(
    result.candidateForm.governedSource.reviewedCaseSnapshotId,
    "",
  );
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "GET /api/v1/manuscripts/manuscript-1",
      "GET /api/v1/manuscripts/manuscript-1/assets",
    ],
  );
});
