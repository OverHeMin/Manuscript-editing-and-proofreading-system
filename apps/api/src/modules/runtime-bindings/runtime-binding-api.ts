import type { RoleKey } from "../../users/roles.ts";
import type { RuntimeBindingRecord } from "./runtime-binding-record.ts";
import type {
  CreateRuntimeBindingInput,
  RuntimeBindingService,
} from "./runtime-binding-service.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateRuntimeBindingApiOptions {
  runtimeBindingService: RuntimeBindingService;
}

export function createRuntimeBindingApi(
  options: CreateRuntimeBindingApiOptions,
) {
  const { runtimeBindingService } = options;

  return {
    async createBinding({
      actorRole,
      input,
    }: {
      actorRole: RoleKey;
      input: CreateRuntimeBindingInput;
    }): Promise<RouteResponse<RuntimeBindingRecord>> {
      return {
        status: 201,
        body: await runtimeBindingService.createBinding(actorRole, input),
      };
    },

    async listBindings(): Promise<RouteResponse<RuntimeBindingRecord[]>> {
      return {
        status: 200,
        body: await runtimeBindingService.listBindings(),
      };
    },

    async listBindingsForScope({
      module,
      manuscriptType,
      templateFamilyId,
      activeOnly,
    }: {
      module: RuntimeBindingRecord["module"];
      manuscriptType: RuntimeBindingRecord["manuscript_type"];
      templateFamilyId: RuntimeBindingRecord["template_family_id"];
      activeOnly?: boolean;
    }): Promise<RouteResponse<RuntimeBindingRecord[]>> {
      return {
        status: 200,
        body: await runtimeBindingService.listBindingsForScope({
          module,
          manuscriptType,
          templateFamilyId,
          activeOnly,
        }),
      };
    },

    async getBinding({
      bindingId,
    }: {
      bindingId: string;
    }): Promise<RouteResponse<RuntimeBindingRecord>> {
      return {
        status: 200,
        body: await runtimeBindingService.getBinding(bindingId),
      };
    },

    async activateBinding({
      actorRole,
      bindingId,
    }: {
      actorRole: RoleKey;
      bindingId: string;
    }): Promise<RouteResponse<RuntimeBindingRecord>> {
      return {
        status: 200,
        body: await runtimeBindingService.activateBinding(bindingId, actorRole),
      };
    },

    async archiveBinding({
      actorRole,
      bindingId,
    }: {
      actorRole: RoleKey;
      bindingId: string;
    }): Promise<RouteResponse<RuntimeBindingRecord>> {
      return {
        status: 200,
        body: await runtimeBindingService.archiveBinding(bindingId, actorRole),
      };
    },
  };
}
