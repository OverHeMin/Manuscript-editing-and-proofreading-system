import type { RoleKey } from "../../users/roles.ts";
import { ToolGatewayService } from "./tool-gateway-service.ts";
import type {
  CreateToolGatewayToolInput,
  UpdateToolGatewayToolInput,
} from "./tool-gateway-service.ts";
import type { ToolGatewayToolRecord } from "./tool-gateway-record.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateToolGatewayApiOptions {
  toolGatewayService: ToolGatewayService;
}

export function createToolGatewayApi(options: CreateToolGatewayApiOptions) {
  const { toolGatewayService } = options;

  return {
    async createTool({
      actorRole,
      input,
    }: {
      actorRole: RoleKey;
      input: CreateToolGatewayToolInput;
    }): Promise<RouteResponse<ToolGatewayToolRecord>> {
      return {
        status: 201,
        body: await toolGatewayService.createTool(actorRole, input),
      };
    },

    async listTools(): Promise<RouteResponse<ToolGatewayToolRecord[]>> {
      return {
        status: 200,
        body: await toolGatewayService.listTools(),
      };
    },

    async getTool({
      toolId,
    }: {
      toolId: string;
    }): Promise<RouteResponse<ToolGatewayToolRecord>> {
      return {
        status: 200,
        body: await toolGatewayService.getTool(toolId),
      };
    },

    async updateTool({
      actorRole,
      toolId,
      input,
    }: {
      actorRole: RoleKey;
      toolId: string;
      input: UpdateToolGatewayToolInput;
    }): Promise<RouteResponse<ToolGatewayToolRecord>> {
      return {
        status: 200,
        body: await toolGatewayService.updateTool(toolId, actorRole, input),
      };
    },
  };
}
