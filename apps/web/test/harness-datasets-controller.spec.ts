import assert from "node:assert/strict";
import test from "node:test";
import {
  createHarnessDatasetsWorkbenchController,
} from "../src/features/harness-datasets/harness-datasets-controller.ts";

test("harness datasets controller loads draft and published gold-set versions with rubric and provenance context", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createHarnessDatasetsWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.url === "/api/v1/harness-datasets/workbench") {
        return {
          status: 200,
          body: {
            export_root_dir: ".local-data/harness-exports/development",
            versions: [
              {
                id: "version-draft-1",
                family_id: "family-1",
                family_name: "Proofreading gold set",
                family_scope: {
                  module: "proofreading",
                  manuscript_types: ["clinical_study"],
                  measure_focus: "issue detection",
                },
                version_no: 1,
                status: "draft",
                item_count: 1,
                deidentification_gate_passed: true,
                human_review_gate_passed: true,
                items: [
                  {
                    source_kind: "reviewed_case_snapshot",
                    source_id: "snapshot-1",
                    manuscript_id: "manuscript-1",
                    manuscript_type: "clinical_study",
                    deidentification_passed: true,
                    human_reviewed: true,
                  },
                ],
                created_by: "persistent.admin",
                created_at: "2026-04-04T09:00:00.000Z",
                rubric_assignment: {
                  status: "missing",
                },
                publications: [],
              },
              {
                id: "version-published-2",
                family_id: "family-2",
                family_name: "Editing gold set",
                family_scope: {
                  module: "editing",
                  manuscript_types: ["review"],
                  measure_focus: "conformance",
                },
                version_no: 2,
                status: "published",
                item_count: 2,
                deidentification_gate_passed: true,
                human_review_gate_passed: true,
                items: [
                  {
                    source_kind: "human_final_asset",
                    source_id: "asset-2",
                    manuscript_id: "manuscript-2",
                    manuscript_type: "review",
                    deidentification_passed: true,
                    human_reviewed: true,
                    risk_tags: ["terminology"],
                  },
                  {
                    source_kind: "evaluation_evidence_pack",
                    source_id: "pack-2",
                    manuscript_id: "manuscript-3",
                    manuscript_type: "review",
                    deidentification_passed: true,
                    human_reviewed: true,
                  },
                ],
                created_by: "persistent.admin",
                created_at: "2026-04-04T10:00:00.000Z",
                published_by: "persistent.admin",
                published_at: "2026-04-04T11:00:00.000Z",
                rubric_assignment: {
                  status: "published",
                  rubric_definition_id: "rubric-2",
                  rubric_name: "Editing rubric",
                  rubric_version_no: 2,
                },
                publications: [
                  {
                    id: "publication-1",
                    gold_set_version_id: "version-published-2",
                    export_format: "json",
                    status: "succeeded",
                    output_uri:
                      ".local-data/harness-exports/development/version-published-2.json",
                    deidentification_gate_passed: true,
                    created_at: "2026-04-04T11:02:00.000Z",
                  },
                ],
              },
            ],
            rubrics: [
              {
                id: "rubric-2",
                name: "Editing rubric",
                version_no: 2,
                status: "published",
                scope: {
                  module: "editing",
                  manuscript_types: ["review"],
                },
                scoring_dimensions: [
                  {
                    key: "conformance",
                    label: "Conformance",
                    weight: 1,
                  },
                ],
                created_by: "persistent.admin",
                created_at: "2026-04-04T09:30:00.000Z",
                published_by: "persistent.admin",
                published_at: "2026-04-04T10:30:00.000Z",
              },
            ],
          } as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const overview = await controller.loadOverview();

  assert.equal(overview.exportRootDir, ".local-data/harness-exports/development");
  assert.equal(overview.draftVersions.length, 1);
  assert.equal(overview.publishedVersions.length, 1);
  assert.equal(overview.draftVersions[0]?.rubricAssignment.status, "missing");
  assert.equal(overview.publishedVersions[0]?.rubricAssignment.status, "published");
  assert.equal(overview.publishedVersions[0]?.rubricAssignment.rubricName, "Editing rubric");
  assert.equal(overview.publishedVersions[0]?.sourceProvenance[0]?.sourceKind, "human_final_asset");
  assert.equal(
    overview.publishedVersions[0]?.sourceProvenance[1]?.sourceKind,
    "evaluation_evidence_pack",
  );
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    ["GET /api/v1/harness-datasets/workbench"],
  );
});

test("harness datasets controller exports only published gold-set versions and reloads the overview", async () => {
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];
  const controller = createHarnessDatasetsWorkbenchController({
    request: async <TResponse>(input: {
      method: "GET" | "POST";
      url: string;
      body?: unknown;
    }) => {
      requests.push(input);

      if (input.url === "/api/v1/harness-datasets/workbench") {
        return {
          status: 200,
          body: {
            export_root_dir: ".local-data/harness-exports/development",
            versions: [
              {
                id: "version-published-2",
                family_id: "family-2",
                family_name: "Editing gold set",
                family_scope: {
                  module: "editing",
                  manuscript_types: ["review"],
                  measure_focus: "conformance",
                },
                version_no: 2,
                status: "published",
                item_count: 2,
                deidentification_gate_passed: true,
                human_review_gate_passed: true,
                items: [
                  {
                    source_kind: "human_final_asset",
                    source_id: "asset-2",
                    manuscript_id: "manuscript-2",
                    manuscript_type: "review",
                    deidentification_passed: true,
                    human_reviewed: true,
                  },
                ],
                created_by: "persistent.admin",
                created_at: "2026-04-04T10:00:00.000Z",
                published_by: "persistent.admin",
                published_at: "2026-04-04T11:00:00.000Z",
                rubric_assignment: {
                  status: "published",
                  rubric_definition_id: "rubric-2",
                  rubric_name: "Editing rubric",
                  rubric_version_no: 2,
                },
                publications: [
                  {
                    id: "publication-1",
                    gold_set_version_id: "version-published-2",
                    export_format: "json",
                    status: "succeeded",
                    output_uri:
                      ".local-data/harness-exports/development/version-published-2.json",
                    deidentification_gate_passed: true,
                    created_at: "2026-04-04T11:02:00.000Z",
                  },
                ],
              },
            ],
            rubrics: [],
          } as TResponse,
        };
      }

      if (input.url === "/api/v1/harness-datasets/gold-set-versions/version-published-2/export") {
        return {
          status: 201,
          body: {
            publication: {
              id: "publication-2",
              gold_set_version_id: "version-published-2",
              export_format: "jsonl",
              status: "succeeded",
              output_uri:
                ".local-data/harness-exports/development/version-published-2.jsonl",
              deidentification_gate_passed: true,
              created_at: "2026-04-04T11:05:00.000Z",
            },
            output_path:
              ".local-data/harness-exports/development/version-published-2.jsonl",
          } as TResponse,
        };
      }

      throw new Error(`Unexpected request: ${input.method} ${input.url}`);
    },
  });

  const result = await controller.exportGoldSetVersionAndReload({
    goldSetVersionId: "version-published-2",
    format: "jsonl",
  });

  assert.equal(result.exportResult.publication.exportFormat, "jsonl");
  assert.equal(
    result.exportResult.outputPath,
    ".local-data/harness-exports/development/version-published-2.jsonl",
  );
  assert.equal(result.overview.publishedVersions.length, 1);
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    [
      "POST /api/v1/harness-datasets/gold-set-versions/version-published-2/export",
      "GET /api/v1/harness-datasets/workbench",
    ],
  );
  assert.deepEqual(requests[0]?.body, {
    format: "jsonl",
  });
});
