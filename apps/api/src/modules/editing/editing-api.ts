import { EditingService } from "./editing-service.ts";
import type { EditingRunResult, RunEditingInput } from "./editing-service.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateEditingApiOptions {
  editingService: EditingService;
}

export function createEditingApi(options: CreateEditingApiOptions) {
  const { editingService } = options;

  return {
    async runEditing(
      input: RunEditingInput,
    ): Promise<RouteResponse<EditingRunResult>> {
      return {
        status: 201,
        body: await editingService.run(input),
      };
    },
  };
}
