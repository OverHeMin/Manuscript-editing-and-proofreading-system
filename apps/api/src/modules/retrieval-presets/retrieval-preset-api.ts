import type { RoleKey } from "../../users/roles.ts";
import type { RetrievalPresetRecord } from "./retrieval-preset-record.ts";
import type {
  CreateRetrievalPresetInput,
  RetrievalPresetService,
} from "./retrieval-preset-service.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateRetrievalPresetApiOptions {
  retrievalPresetService: RetrievalPresetService;
}

export function createRetrievalPresetApi(
  options: CreateRetrievalPresetApiOptions,
) {
  const { retrievalPresetService } = options;

  return {
    async createPreset({
      actorRole,
      input,
    }: {
      actorRole: RoleKey;
      input: CreateRetrievalPresetInput;
    }): Promise<RouteResponse<RetrievalPresetRecord>> {
      return {
        status: 201,
        body: await retrievalPresetService.createPreset(actorRole, input),
      };
    },

    async listPresetsForScope({
      module,
      manuscriptType,
      templateFamilyId,
      activeOnly,
    }: {
      module: RetrievalPresetRecord["module"];
      manuscriptType: RetrievalPresetRecord["manuscript_type"];
      templateFamilyId: RetrievalPresetRecord["template_family_id"];
      activeOnly?: boolean;
    }): Promise<RouteResponse<RetrievalPresetRecord[]>> {
      return {
        status: 200,
        body: await retrievalPresetService.listPresetsForScope({
          module,
          manuscriptType,
          templateFamilyId,
          activeOnly,
        }),
      };
    },

    async getPreset({
      presetId,
    }: {
      presetId: string;
    }): Promise<RouteResponse<RetrievalPresetRecord>> {
      return {
        status: 200,
        body: await retrievalPresetService.getPreset(presetId),
      };
    },

    async activatePreset({
      actorRole,
      presetId,
    }: {
      actorRole: RoleKey;
      presetId: string;
    }): Promise<RouteResponse<RetrievalPresetRecord>> {
      return {
        status: 200,
        body: await retrievalPresetService.activatePreset(presetId, actorRole),
      };
    },

    async archivePreset({
      actorRole,
      presetId,
    }: {
      actorRole: RoleKey;
      presetId: string;
    }): Promise<RouteResponse<RetrievalPresetRecord>> {
      return {
        status: 200,
        body: await retrievalPresetService.archivePreset(presetId, actorRole),
      };
    },
  };
}
