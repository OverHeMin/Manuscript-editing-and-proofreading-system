import {
  DocumentNormalizationWorkflowService,
  type DocumentNormalizationExecutionResult,
  type DocumentNormalizationWorkflowInput,
} from "./document-normalization-service.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateDocumentPipelineApiOptions {
  workflowService: DocumentNormalizationWorkflowService;
}

export function createDocumentPipelineApi(
  options: CreateDocumentPipelineApiOptions,
) {
  const { workflowService } = options;

  return {
    async normalize(
      input: DocumentNormalizationWorkflowInput,
    ): Promise<RouteResponse<DocumentNormalizationExecutionResult>> {
      const result = await workflowService.normalize(input);

      return {
        status: result.normalized_asset ? 201 : 202,
        body: result,
      };
    },
  };
}
