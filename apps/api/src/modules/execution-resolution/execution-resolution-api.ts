import type { ResolvedExecutionBundleRecord } from "./execution-resolution-record.ts";
import type {
  ExecutionResolutionService,
  ResolveExecutionBundleInput,
} from "./execution-resolution-service.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateExecutionResolutionApiOptions {
  executionResolutionService: ExecutionResolutionService;
}

export function createExecutionResolutionApi(
  options: CreateExecutionResolutionApiOptions,
) {
  const { executionResolutionService } = options;

  return {
    async resolveBundle({
      input,
    }: {
      input: ResolveExecutionBundleInput;
    }): Promise<RouteResponse<ResolvedExecutionBundleRecord>> {
      return {
        status: 200,
        body: await executionResolutionService.resolveExecutionBundle(input),
      };
    },
  };
}
