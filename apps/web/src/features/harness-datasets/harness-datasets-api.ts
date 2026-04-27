import type {
  HarnessDatasetExportApiResult,
  HarnessDatasetExportFormat,
  HarnessDatasetWorkbenchApiOverview,
  QuickProofreadingGoldSetInput,
} from "./types.ts";

export interface HarnessDatasetsHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export function getHarnessDatasetsWorkbenchOverview(
  client: HarnessDatasetsHttpClient,
) {
  return client.request<HarnessDatasetWorkbenchApiOverview>({
    method: "GET",
    url: "/api/v1/harness-datasets/workbench",
  });
}

export function exportHarnessGoldSetVersion(
  client: HarnessDatasetsHttpClient,
  goldSetVersionId: string,
  format: HarnessDatasetExportFormat,
) {
  return client.request<HarnessDatasetExportApiResult>({
    method: "POST",
    url: `/api/v1/harness-datasets/gold-set-versions/${goldSetVersionId}/export`,
    body: {
      format,
    },
  });
}

export async function createAndPublishProofreadingGoldSet(
  client: HarnessDatasetsHttpClient,
  input: QuickProofreadingGoldSetInput,
) {
  const family = await client.request<{ id: string }>({
    method: "POST",
    url: "/api/v1/harness-datasets/gold-set-families",
    body: {
      name: input.name,
      scope: {
        module: "proofreading",
        manuscriptTypes: [input.manuscriptType],
        measureFocus: "issue_detection",
      },
    },
  });
  const rubricDraft = await client.request<{ id: string }>({
    method: "POST",
    url: "/api/v1/harness-datasets/rubrics",
    body: {
      name: `${input.name} rubric`,
      scope: {
        module: "proofreading",
        manuscriptTypes: [input.manuscriptType],
      },
      scoringDimensions: [
        {
          key: "critical_recall",
          label: "Critical recall",
        },
        {
          key: "false_positive_review",
          label: "False positive review",
        },
      ],
      createdBy: "current-user",
    },
  });
  const rubric = await client.request<{ id: string }>({
    method: "POST",
    url: `/api/v1/harness-datasets/rubrics/${rubricDraft.body.id}/publish`,
  });
  const version = await client.request<{ id: string }>({
    method: "POST",
    url: "/api/v1/harness-datasets/gold-set-versions",
    body: {
      familyId: family.body.id,
      rubricDefinitionId: rubric.body.id,
      createdBy: "current-user",
      items: [
        {
          sourceKind: input.sourceKind,
          sourceId: input.sourceId,
          manuscriptId: input.manuscriptId,
          manuscriptType: input.manuscriptType,
          deidentificationPassed: true,
          humanReviewed: true,
          expectedStructuredOutput: input.expectedStructuredOutput,
        },
      ],
      publicationNotes: input.publicationNotes,
    },
  });
  await client.request({
    method: "POST",
    url: `/api/v1/harness-datasets/gold-set-versions/${version.body.id}/publish`,
  });
}
