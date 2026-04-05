import type { RoleKey } from "../../users/roles.ts";
import type { RuntimeBindingReadinessReport } from "./runtime-binding-readiness.ts";
import type { RuntimeBindingRecord } from "./runtime-binding-record.ts";
import type {
  CreateRuntimeBindingInput,
  RuntimeBindingService,
} from "./runtime-binding-service.ts";
import type { RuntimeBindingReadinessService } from "./runtime-binding-readiness-service.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateRuntimeBindingApiOptions {
  runtimeBindingService: RuntimeBindingService;
  runtimeBindingReadinessService: RuntimeBindingReadinessService;
}

export function createRuntimeBindingApi(
  options: CreateRuntimeBindingApiOptions,
) {
  const { runtimeBindingService, runtimeBindingReadinessService } = options;

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

    async getBindingReadiness({
      bindingId,
    }: {
      bindingId: string;
    }): Promise<RouteResponse<RuntimeBindingReadinessReport>> {
      return {
        status: 200,
        body: await runtimeBindingReadinessService.getBindingReadiness(bindingId),
      };
    },

    async getActiveBindingReadinessForScope({
      module,
      manuscriptType,
      templateFamilyId,
    }: {
      module: RuntimeBindingRecord["module"];
      manuscriptType: RuntimeBindingRecord["manuscript_type"];
      templateFamilyId: RuntimeBindingRecord["template_family_id"];
    }): Promise<RouteResponse<RuntimeBindingReadinessReport>> {
      return {
        status: 200,
        body: await runtimeBindingReadinessService.getActiveBindingReadinessForScope({
          module,
          manuscriptType,
          templateFamilyId,
        }),
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
