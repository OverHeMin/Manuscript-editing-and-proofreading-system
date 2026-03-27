import type { RoleKey } from "../../users/roles.ts";
import { ModelRegistryService } from "./model-registry-service.ts";
import type {
  CreateModelRegistryEntryInput,
  UpdateModelRegistryEntryInput,
  UpdateModelRoutingPolicyInput,
} from "./model-registry-service.ts";
import type {
  ModelRegistryRecord,
  ModelRoutingPolicyRecord,
} from "./model-record.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateModelRegistryApiOptions {
  modelRegistryService: ModelRegistryService;
}

export function createModelRegistryApi(options: CreateModelRegistryApiOptions) {
  const { modelRegistryService } = options;

  return {
    async createModelEntry({
      actorRole,
      input,
    }: {
      actorRole: RoleKey;
      input: CreateModelRegistryEntryInput;
    }): Promise<RouteResponse<ModelRegistryRecord>> {
      return {
        status: 201,
        body: await modelRegistryService.createModelEntry(actorRole, input),
      };
    },

    async updateModelEntry({
      actorRole,
      modelId,
      input,
    }: {
      actorRole: RoleKey;
      modelId: string;
      input: UpdateModelRegistryEntryInput;
    }): Promise<RouteResponse<ModelRegistryRecord>> {
      return {
        status: 200,
        body: await modelRegistryService.updateModelEntry(modelId, actorRole, input),
      };
    },

    async listModelEntries(): Promise<RouteResponse<ModelRegistryRecord[]>> {
      return {
        status: 200,
        body: await modelRegistryService.listModelEntries(),
      };
    },

    async getRoutingPolicy(): Promise<RouteResponse<ModelRoutingPolicyRecord>> {
      return {
        status: 200,
        body: await modelRegistryService.getRoutingPolicy(),
      };
    },

    async updateRoutingPolicy({
      actorRole,
      input,
    }: {
      actorRole: RoleKey;
      input: UpdateModelRoutingPolicyInput;
    }): Promise<RouteResponse<ModelRoutingPolicyRecord>> {
      return {
        status: 200,
        body: await modelRegistryService.updateRoutingPolicy(actorRole, input),
      };
    },
  };
}
