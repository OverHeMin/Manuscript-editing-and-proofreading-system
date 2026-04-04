import type {
  CreateModelRoutingPolicyDraftVersionInput,
  CreateModelRoutingPolicyInput,
  ModelRoutingPolicyDecisionInput,
  ModelRoutingPolicyVersionEnvelopeViewModel,
  ModelRoutingPolicyViewModel,
  RollbackModelRoutingPolicyInput,
  SaveModelRoutingPolicyDraftInput,
} from "./types.ts";

export interface ModelRoutingGovernanceHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export function listModelRoutingPolicies(client: ModelRoutingGovernanceHttpClient) {
  return client.request<ModelRoutingPolicyViewModel[]>({
    method: "GET",
    url: "/api/v1/model-routing-governance/policies",
  });
}

export function createModelRoutingPolicy(
  client: ModelRoutingGovernanceHttpClient,
  input: CreateModelRoutingPolicyInput,
) {
  return client.request<ModelRoutingPolicyVersionEnvelopeViewModel>({
    method: "POST",
    url: "/api/v1/model-routing-governance/policies",
    body: {
      actorRole: input.actorRole,
      input: {
        scopeKind: input.scopeKind,
        scopeValue: input.scopeValue,
        primaryModelId: input.primaryModelId,
        fallbackModelIds: input.fallbackModelIds,
        evidenceLinks: input.evidenceLinks,
        notes: input.notes,
      },
    },
  });
}

export function createModelRoutingPolicyDraftVersion(
  client: ModelRoutingGovernanceHttpClient,
  input: CreateModelRoutingPolicyDraftVersionInput,
) {
  return client.request<ModelRoutingPolicyVersionEnvelopeViewModel>({
    method: "POST",
    url: `/api/v1/model-routing-governance/policies/${input.policyId}/versions`,
    body: {
      actorRole: input.actorRole,
      input: input.input,
    },
  });
}

export function saveModelRoutingPolicyDraft(
  client: ModelRoutingGovernanceHttpClient,
  input: SaveModelRoutingPolicyDraftInput,
) {
  return client.request<ModelRoutingPolicyVersionEnvelopeViewModel>({
    method: "POST",
    url: `/api/v1/model-routing-governance/versions/${input.versionId}/draft`,
    body: {
      actorRole: input.actorRole,
      input: input.input,
    },
  });
}

export function submitModelRoutingPolicyVersion(
  client: ModelRoutingGovernanceHttpClient,
  input: ModelRoutingPolicyDecisionInput & { versionId: string },
) {
  return client.request<ModelRoutingPolicyVersionEnvelopeViewModel>({
    method: "POST",
    url: `/api/v1/model-routing-governance/versions/${input.versionId}/submit`,
    body: {
      actorRole: input.actorRole,
      actorId: input.actorId,
      reason: input.reason,
    },
  });
}

export function approveModelRoutingPolicyVersion(
  client: ModelRoutingGovernanceHttpClient,
  input: ModelRoutingPolicyDecisionInput & { versionId: string },
) {
  return client.request<ModelRoutingPolicyVersionEnvelopeViewModel>({
    method: "POST",
    url: `/api/v1/model-routing-governance/versions/${input.versionId}/approve`,
    body: {
      actorRole: input.actorRole,
      actorId: input.actorId,
      reason: input.reason,
    },
  });
}

export function activateModelRoutingPolicyVersion(
  client: ModelRoutingGovernanceHttpClient,
  input: ModelRoutingPolicyDecisionInput & { versionId: string },
) {
  return client.request<ModelRoutingPolicyVersionEnvelopeViewModel>({
    method: "POST",
    url: `/api/v1/model-routing-governance/versions/${input.versionId}/activate`,
    body: {
      actorRole: input.actorRole,
      actorId: input.actorId,
      reason: input.reason,
    },
  });
}

export function rollbackModelRoutingPolicy(
  client: ModelRoutingGovernanceHttpClient,
  input: RollbackModelRoutingPolicyInput,
) {
  return client.request<ModelRoutingPolicyVersionEnvelopeViewModel>({
    method: "POST",
    url: `/api/v1/model-routing-governance/policies/${input.policyId}/rollback`,
    body: {
      actorRole: input.actorRole,
      actorId: input.actorId,
      reason: input.reason,
    },
  });
}

