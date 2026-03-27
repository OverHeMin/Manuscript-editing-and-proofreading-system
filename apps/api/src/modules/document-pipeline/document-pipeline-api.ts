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
import type { OnlyOfficeViewSession } from "./onlyoffice-session-service.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateDocumentPipelineApiOptions {
  workflowService: DocumentNormalizationWorkflowService;
  intakeService?: DocumentIntakeService;
  previewService?: DocumentPreviewService;
}

export function createDocumentPipelineApi(
  options: CreateDocumentPipelineApiOptions,
) {
  const { workflowService } = options;
  const intakeService =
    options.intakeService ?? new DocumentIntakeService({ workflowService });
  const previewService = options.previewService;

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
  };
}
