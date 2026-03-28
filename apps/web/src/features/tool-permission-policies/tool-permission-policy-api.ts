import type {
  ActivateToolPermissionPolicyInput,
  ArchiveToolPermissionPolicyInput,
  CreateToolPermissionPolicyInput,
  ToolPermissionPolicyViewModel,
} from "./types.ts";

export interface ToolPermissionPolicyHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export function createToolPermissionPolicy(
  client: ToolPermissionPolicyHttpClient,
  input: CreateToolPermissionPolicyInput,
) {
  return client.request<ToolPermissionPolicyViewModel>({
    method: "POST",
    url: "/api/v1/tool-permission-policies",
    body: {
      actorRole: input.actorRole,
      input: {
        name: input.name,
        defaultMode: input.defaultMode,
        allowedToolIds: input.allowedToolIds,
        highRiskToolIds: input.highRiskToolIds,
        writeRequiresConfirmation: input.writeRequiresConfirmation,
      },
    },
  });
}

export function listToolPermissionPolicies(
  client: ToolPermissionPolicyHttpClient,
) {
  return client.request<ToolPermissionPolicyViewModel[]>({
    method: "GET",
    url: "/api/v1/tool-permission-policies",
  });
}

export function getToolPermissionPolicy(
  client: ToolPermissionPolicyHttpClient,
  policyId: string,
) {
  return client.request<ToolPermissionPolicyViewModel>({
    method: "GET",
    url: `/api/v1/tool-permission-policies/${policyId}`,
  });
}

export function activateToolPermissionPolicy(
  client: ToolPermissionPolicyHttpClient,
  policyId: string,
  input: ActivateToolPermissionPolicyInput,
) {
  return client.request<ToolPermissionPolicyViewModel>({
    method: "POST",
    url: `/api/v1/tool-permission-policies/${policyId}/activate`,
    body: input,
  });
}

export function archiveToolPermissionPolicy(
  client: ToolPermissionPolicyHttpClient,
  policyId: string,
  input: ArchiveToolPermissionPolicyInput,
) {
  return client.request<ToolPermissionPolicyViewModel>({
    method: "POST",
    url: `/api/v1/tool-permission-policies/${policyId}/archive`,
    body: input,
  });
}
