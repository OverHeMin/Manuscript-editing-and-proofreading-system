import {
  exportHarnessGoldSetVersion,
  getHarnessDatasetsWorkbenchOverview,
  type HarnessDatasetsHttpClient,
} from "./harness-datasets-api.ts";
import type {
  HarnessDatasetExportApiResult,
  HarnessDatasetExportResultViewModel,
  HarnessDatasetExportFormat,
  HarnessDatasetPublicationViewModel,
  HarnessDatasetVersionViewModel,
  HarnessDatasetsWorkbenchOverview,
  HarnessDatasetWorkbenchApiOverview,
  HarnessDatasetRubricSummaryViewModel,
} from "./types.ts";

export interface HarnessDatasetsWorkbenchController {
  loadOverview(): Promise<HarnessDatasetsWorkbenchOverview>;
  exportGoldSetVersionAndReload(input: {
    goldSetVersionId: string;
    format: HarnessDatasetExportFormat;
  }): Promise<{
    overview: HarnessDatasetsWorkbenchOverview;
    exportResult: HarnessDatasetExportResultViewModel;
  }>;
}

export function createHarnessDatasetsWorkbenchController(
  client: HarnessDatasetsHttpClient,
): HarnessDatasetsWorkbenchController {
  return {
    loadOverview() {
      return loadHarnessDatasetsWorkbenchOverview(client);
    },
    async exportGoldSetVersionAndReload(input) {
      const exportResult = mapExportResult(
        (
          await exportHarnessGoldSetVersion(
            client,
            input.goldSetVersionId,
            input.format,
          )
        ).body,
      );

      return {
        exportResult,
        overview: await loadHarnessDatasetsWorkbenchOverview(client),
      };
    },
  };
}

async function loadHarnessDatasetsWorkbenchOverview(
  client: HarnessDatasetsHttpClient,
): Promise<HarnessDatasetsWorkbenchOverview> {
  const response = await getHarnessDatasetsWorkbenchOverview(client);
  return mapOverview(response.body);
}

function mapOverview(
  overview: HarnessDatasetWorkbenchApiOverview,
): HarnessDatasetsWorkbenchOverview {
  const versions = overview.versions
    .map(mapVersion)
    .sort(compareVersionRecencyDesc);

  return {
    exportRootDir: overview.export_root_dir,
    rubrics: overview.rubrics
      .map(
        (rubric): HarnessDatasetRubricSummaryViewModel => ({
          id: rubric.id,
          name: rubric.name,
          versionNo: rubric.version_no,
          status: rubric.status,
        }),
      )
      .sort((left, right) => left.name.localeCompare(right.name) || left.versionNo - right.versionNo),
    draftVersions: versions.filter((version) => version.status === "draft"),
    publishedVersions: versions.filter((version) => version.status === "published"),
    archivedVersions: versions.filter((version) => version.status === "archived"),
  };
}

function mapVersion(
  version: HarnessDatasetWorkbenchApiOverview["versions"][number],
): HarnessDatasetVersionViewModel {
  return {
    id: version.id,
    familyId: version.family_id,
    familyName: version.family_name,
    familyScope: {
      module: version.family_scope.module,
      manuscriptTypes: [...version.family_scope.manuscript_types],
      measureFocus: version.family_scope.measure_focus,
      templateFamilyId: version.family_scope.template_family_id,
    },
    versionNo: version.version_no,
    status: version.status,
    itemCount: version.item_count,
    createdBy: version.created_by,
    createdAt: version.created_at,
    publishedBy: version.published_by,
    publishedAt: version.published_at,
    deidentificationGatePassed: version.deidentification_gate_passed,
    humanReviewGatePassed: version.human_review_gate_passed,
    rubricAssignment: {
      status: version.rubric_assignment.status,
      rubricDefinitionId: version.rubric_assignment.rubric_definition_id,
      rubricName: version.rubric_assignment.rubric_name,
      rubricVersionNo: version.rubric_assignment.rubric_version_no,
    },
    sourceProvenance: version.items.map((item) => ({
      sourceKind: item.source_kind,
      sourceId: item.source_id,
      manuscriptId: item.manuscript_id,
      manuscriptType: item.manuscript_type,
      deidentificationPassed: item.deidentification_passed,
      humanReviewed: item.human_reviewed,
      riskTags: item.risk_tags ? [...item.risk_tags] : undefined,
    })),
    publications: version.publications.map(mapPublication),
  };
}

function mapPublication(
  publication:
    | HarnessDatasetWorkbenchApiOverview["versions"][number]["publications"][number]
    | HarnessDatasetExportApiResult["publication"],
): HarnessDatasetPublicationViewModel {
  return {
    id: publication.id,
    goldSetVersionId: publication.gold_set_version_id,
    exportFormat: publication.export_format,
    status: publication.status,
    outputUri: publication.output_uri,
    deidentificationGatePassed: publication.deidentification_gate_passed,
    createdAt: publication.created_at,
  };
}

function mapExportResult(
  result: HarnessDatasetExportApiResult,
): HarnessDatasetExportResultViewModel {
  return {
    publication: mapPublication(result.publication),
    outputPath: result.output_path,
  };
}

function compareVersionRecencyDesc(
  left: HarnessDatasetVersionViewModel,
  right: HarnessDatasetVersionViewModel,
) {
  const leftTimestamp = left.publishedAt ?? left.createdAt;
  const rightTimestamp = right.publishedAt ?? right.createdAt;
  return rightTimestamp.localeCompare(leftTimestamp) || left.id.localeCompare(right.id);
}
