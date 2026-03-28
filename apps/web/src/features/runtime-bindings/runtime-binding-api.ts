import type {
  ActivateRuntimeBindingInput,
  ArchiveRuntimeBindingInput,
  CreateRuntimeBindingInput,
  ListRuntimeBindingsForScopeInput,
  RuntimeBindingViewModel,
} from "./types.ts";

export interface RuntimeBindingHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export function createRuntimeBinding(
  client: RuntimeBindingHttpClient,
  input: CreateRuntimeBindingInput,
) {
  return client.request<RuntimeBindingViewModel>({
    method: "POST",
    url: "/api/v1/runtime-bindings",
    body: {
      actorRole: input.actorRole,
      input: {
        module: input.module,
        manuscriptType: input.manuscriptType,
        templateFamilyId: input.templateFamilyId,
        runtimeId: input.runtimeId,
        sandboxProfileId: input.sandboxProfileId,
        agentProfileId: input.agentProfileId,
        toolPermissionPolicyId: input.toolPermissionPolicyId,
        promptTemplateId: input.promptTemplateId,
        skillPackageIds: input.skillPackageIds,
        executionProfileId: input.executionProfileId,
      },
    },
  });
}

export function listRuntimeBindings(client: RuntimeBindingHttpClient) {
  return client.request<RuntimeBindingViewModel[]>({
    method: "GET",
    url: "/api/v1/runtime-bindings",
  });
}

export function listRuntimeBindingsForScope(
  client: RuntimeBindingHttpClient,
  input: ListRuntimeBindingsForScopeInput,
) {
  const search = input.activeOnly ? "?activeOnly=true" : "";
  return client.request<RuntimeBindingViewModel[]>({
    method: "GET",
    url:
      `/api/v1/runtime-bindings/by-scope/${input.module}` +
      `/${input.manuscriptType}/${input.templateFamilyId}${search}`,
  });
}

export function getRuntimeBinding(
  client: RuntimeBindingHttpClient,
  bindingId: string,
) {
  return client.request<RuntimeBindingViewModel>({
    method: "GET",
    url: `/api/v1/runtime-bindings/${bindingId}`,
  });
}

export function activateRuntimeBinding(
  client: RuntimeBindingHttpClient,
  bindingId: string,
  input: ActivateRuntimeBindingInput,
) {
  return client.request<RuntimeBindingViewModel>({
    method: "POST",
    url: `/api/v1/runtime-bindings/${bindingId}/activate`,
    body: input,
  });
}

export function archiveRuntimeBinding(
  client: RuntimeBindingHttpClient,
  bindingId: string,
  input: ArchiveRuntimeBindingInput,
) {
  return client.request<RuntimeBindingViewModel>({
    method: "POST",
    url: `/api/v1/runtime-bindings/${bindingId}/archive`,
    body: input,
  });
}
