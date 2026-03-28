import type {
  CreateToolGatewayToolInput,
  ToolGatewayScope,
  ToolGatewayToolViewModel,
  UpdateToolGatewayToolInput,
} from "./types.ts";

export interface ToolGatewayHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export function createToolGatewayTool(
  client: ToolGatewayHttpClient,
  input: CreateToolGatewayToolInput,
) {
  return client.request<ToolGatewayToolViewModel>({
    method: "POST",
    url: "/api/v1/tool-gateway",
    body: {
      actorRole: input.actorRole,
      input: {
        name: input.name,
        scope: input.scope,
        accessMode: input.accessMode,
      },
    },
  });
}

export function listToolGatewayTools(client: ToolGatewayHttpClient) {
  return client.request<ToolGatewayToolViewModel[]>({
    method: "GET",
    url: "/api/v1/tool-gateway",
  });
}

export function listToolGatewayToolsByScope(
  client: ToolGatewayHttpClient,
  scope: ToolGatewayScope,
) {
  return client.request<ToolGatewayToolViewModel[]>({
    method: "GET",
    url: `/api/v1/tool-gateway/by-scope/${scope}`,
  });
}

export function getToolGatewayTool(
  client: ToolGatewayHttpClient,
  toolId: string,
) {
  return client.request<ToolGatewayToolViewModel>({
    method: "GET",
    url: `/api/v1/tool-gateway/${toolId}`,
  });
}

export function updateToolGatewayTool(
  client: ToolGatewayHttpClient,
  toolId: string,
  input: UpdateToolGatewayToolInput,
) {
  return client.request<ToolGatewayToolViewModel>({
    method: "POST",
    url: `/api/v1/tool-gateway/${toolId}`,
    body: {
      actorRole: input.actorRole,
      input: {
        scope: input.scope,
        accessMode: input.accessMode,
      },
    },
  });
}
