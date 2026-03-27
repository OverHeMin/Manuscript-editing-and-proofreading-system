import type {
  CreateModelRegistryEntryInput,
  ModelRegistryEntryViewModel,
  ModelRoutingPolicyViewModel,
  UpdateModelRegistryEntryInput,
  UpdateModelRoutingPolicyInput,
} from "./types.ts";

export interface ModelRegistryHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export function createModelRegistryEntry(
  client: ModelRegistryHttpClient,
  input: CreateModelRegistryEntryInput,
) {
  return client.request<ModelRegistryEntryViewModel>({
    method: "POST",
    url: "/api/v1/model-registry",
    body: input,
  });
}

export function updateModelRegistryEntry(
  client: ModelRegistryHttpClient,
  modelId: string,
  input: UpdateModelRegistryEntryInput,
) {
  return client.request<ModelRegistryEntryViewModel>({
    method: "POST",
    url: `/api/v1/model-registry/${modelId}`,
    body: input,
  });
}

export function listModelRegistryEntries(client: ModelRegistryHttpClient) {
  return client.request<ModelRegistryEntryViewModel[]>({
    method: "GET",
    url: "/api/v1/model-registry",
  });
}

export function getModelRoutingPolicy(client: ModelRegistryHttpClient) {
  return client.request<ModelRoutingPolicyViewModel>({
    method: "GET",
    url: "/api/v1/model-registry/routing-policy",
  });
}

export function updateModelRoutingPolicy(
  client: ModelRegistryHttpClient,
  input: UpdateModelRoutingPolicyInput,
) {
  return client.request<ModelRoutingPolicyViewModel>({
    method: "POST",
    url: "/api/v1/model-registry/routing-policy",
    body: input,
  });
}
