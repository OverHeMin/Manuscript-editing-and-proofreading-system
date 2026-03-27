import type {
  CreateToolGatewayToolInput,
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
    body: input,
  });
}

export function listToolGatewayTools(client: ToolGatewayHttpClient) {
  return client.request<ToolGatewayToolViewModel[]>({
    method: "GET",
    url: "/api/v1/tool-gateway",
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
    body: input,
  });
}
