import type { RoleKey } from "../../users/roles.ts";
import type { AiProviderConnectionRecord } from "./ai-provider-connection-record.ts";
import {
  AiProviderConnectionService,
  type CreateAiProviderConnectionInput,
  type TestAiProviderConnectionInput,
  type UpdateAiProviderConnectionInput,
} from "./ai-provider-connection-service.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateAiProviderConnectionApiOptions {
  aiProviderConnectionService: AiProviderConnectionService;
}

export function createAiProviderConnectionApi(
  options: CreateAiProviderConnectionApiOptions,
) {
  const { aiProviderConnectionService } = options;

  return {
    async listConnections(): Promise<RouteResponse<AiProviderConnectionRecord[]>> {
      return {
        status: 200,
        body: await aiProviderConnectionService.listConnections(),
      };
    },

    async createConnection(input: {
      actorId: string;
      actorRole: RoleKey;
      input: CreateAiProviderConnectionInput;
    }): Promise<RouteResponse<AiProviderConnectionRecord>> {
      return {
        status: 201,
        body: await aiProviderConnectionService.createConnection({
          actorId: input.actorId,
          actorRole: input.actorRole,
          connection: input.input,
        }),
      };
    },

    async updateConnection(input: {
      actorId: string;
      actorRole: RoleKey;
      connectionId: string;
      input: UpdateAiProviderConnectionInput["changes"];
    }): Promise<RouteResponse<AiProviderConnectionRecord>> {
      return {
        status: 200,
        body: await aiProviderConnectionService.updateConnection({
          actorId: input.actorId,
          actorRole: input.actorRole,
          update: {
            connectionId: input.connectionId,
            changes: input.input,
          },
        }),
      };
    },

    async rotateCredential(input: {
      actorId: string;
      actorRole: RoleKey;
      connectionId: string;
      input: {
        credentials?: {
          apiKey?: string;
        };
      };
    }): Promise<RouteResponse<AiProviderConnectionRecord>> {
      return {
        status: 200,
        body: await aiProviderConnectionService.rotateCredential({
          actorId: input.actorId,
          actorRole: input.actorRole,
          rotation: {
            connectionId: input.connectionId,
            apiKey: input.input.credentials?.apiKey ?? "",
          },
        }),
      };
    },

    async testConnection(input: {
      actorId: string;
      actorRole: RoleKey;
      connectionId: string;
      input: {
        connection_metadata?: TestAiProviderConnectionInput["metadata"];
      };
    }): Promise<RouteResponse<AiProviderConnectionRecord>> {
      return {
        status: 200,
        body: await aiProviderConnectionService.testConnection({
          actorId: input.actorId,
          actorRole: input.actorRole,
          test: {
            connectionId: input.connectionId,
            metadata: input.input.connection_metadata,
          },
        }),
      };
    },
  };
}
