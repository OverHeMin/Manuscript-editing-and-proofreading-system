import {
  DocumentNormalizationWorkflowService,
  type DocumentNormalizationExecutionResult,
  type DocumentNormalizationWorkflowInput,
} from "./document-normalization-service.ts";
import {
  DocumentIntakeService,
  type DocumentIntakeResult,
} from "./document-intake-service.ts";
import {
  DocumentPreviewService,
  type CreateDocumentPreviewSessionInput,
} from "./document-preview-service.ts";
import {
  DocumentExportService,
  type DocumentExportResult,
  type ExportCurrentDocumentAssetInput,
} from "./document-export-service.ts";
import type { OnlyOfficeViewSession } from "./onlyoffice-session-service.ts";
import {
  DocumentStructureService,
  type DocumentStructureSnapshot,
  type ExtractDocumentStructureInput,
} from "./document-structure-service.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateDocumentPipelineApiOptions {
  workflowService: DocumentNormalizationWorkflowService;
  intakeService?: DocumentIntakeService;
  previewService?: DocumentPreviewService;
  exportService?: DocumentExportService;
  structureService?: DocumentStructureService;
}

export function createDocumentPipelineApi(
  options: CreateDocumentPipelineApiOptions,
) {
  const { workflowService } = options;
  const intakeService =
    options.intakeService ?? new DocumentIntakeService({ workflowService });
  const previewService = options.previewService;
  const exportService = options.exportService;
  const structureService = options.structureService;

  return {
    async intakeUploadedManuscript(
      input: DocumentNormalizationWorkflowInput,
    ): Promise<RouteResponse<DocumentIntakeResult>> {
      const result = await intakeService.intakeUploadedManuscript(input);

      return {
        status: result.normalization.normalized_asset ? 201 : 202,
        body: result,
      };
    },

    async normalize(
      input: DocumentNormalizationWorkflowInput,
    ): Promise<RouteResponse<DocumentNormalizationExecutionResult>> {
      const result = await workflowService.normalize(input);

      return {
        status: result.normalized_asset ? 201 : 202,
        body: result,
      };
    },

    async createPreviewSession(
      input: CreateDocumentPreviewSessionInput,
    ): Promise<RouteResponse<OnlyOfficeViewSession>> {
      if (!previewService) {
        throw new Error("Document preview service is not configured.");
      }

      return {
        status: 200,
        body: await previewService.createPreviewSession(input),
      };
    },

    async exportCurrentAsset(
      input: ExportCurrentDocumentAssetInput,
    ): Promise<RouteResponse<DocumentExportResult>> {
      if (!exportService) {
        throw new Error("Document export service is not configured.");
      }

      return {
        status: 200,
        body: await exportService.exportCurrentAsset(input),
      };
    },

    async extractStructure(
      input: ExtractDocumentStructureInput,
    ): Promise<RouteResponse<DocumentStructureSnapshot>> {
      if (!structureService) {
        throw new Error("Document structure service is not configured.");
      }

      return {
        status: 200,
        body: await structureService.extract(input),
      };
    },
  };
}
