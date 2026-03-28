import type {
  ActivateKnowledgeBindingRuleInput,
  ArchiveExecutionProfileInput,
  CreateExecutionProfileInput,
  CreateKnowledgeBindingRuleInput,
  KnowledgeBindingRuleViewModel,
  ModuleExecutionProfileViewModel,
  PublishExecutionProfileInput,
} from "./types.ts";

export interface ExecutionGovernanceHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export function createExecutionProfile(
  client: ExecutionGovernanceHttpClient,
  input: CreateExecutionProfileInput,
) {
  return client.request<ModuleExecutionProfileViewModel>({
    method: "POST",
    url: "/api/v1/execution-governance/profiles",
    body: {
      actorRole: input.actorRole,
      input: {
        module: input.module,
        manuscriptType: input.manuscriptType,
        templateFamilyId: input.templateFamilyId,
        moduleTemplateId: input.moduleTemplateId,
        promptTemplateId: input.promptTemplateId,
        skillPackageIds: input.skillPackageIds,
        knowledgeBindingMode: input.knowledgeBindingMode,
        notes: input.notes,
      },
    },
  });
}

export function publishExecutionProfile(
  client: ExecutionGovernanceHttpClient,
  input: PublishExecutionProfileInput,
) {
  return client.request<ModuleExecutionProfileViewModel>({
    method: "POST",
    url: `/api/v1/execution-governance/profiles/${input.profileId}/publish`,
    body: {
      actorRole: input.actorRole,
    },
  });
}

export function archiveExecutionProfile(
  client: ExecutionGovernanceHttpClient,
  input: ArchiveExecutionProfileInput,
) {
  return client.request<ModuleExecutionProfileViewModel>({
    method: "POST",
    url: `/api/v1/execution-governance/profiles/${input.profileId}/archive`,
    body: {
      actorRole: input.actorRole,
    },
  });
}

export function listExecutionProfiles(client: ExecutionGovernanceHttpClient) {
  return client.request<ModuleExecutionProfileViewModel[]>({
    method: "GET",
    url: "/api/v1/execution-governance/profiles",
  });
}

export function createKnowledgeBindingRule(
  client: ExecutionGovernanceHttpClient,
  input: CreateKnowledgeBindingRuleInput,
) {
  return client.request<KnowledgeBindingRuleViewModel>({
    method: "POST",
    url: "/api/v1/execution-governance/knowledge-binding-rules",
    body: {
      actorRole: input.actorRole,
      input: {
        knowledgeItemId: input.knowledgeItemId,
        module: input.module,
        manuscriptTypes: input.manuscriptTypes,
        templateFamilyIds: input.templateFamilyIds,
        moduleTemplateIds: input.moduleTemplateIds,
        sections: input.sections,
        riskTags: input.riskTags,
        priority: input.priority,
        bindingPurpose: input.bindingPurpose,
      },
    },
  });
}

export function activateKnowledgeBindingRule(
  client: ExecutionGovernanceHttpClient,
  input: ActivateKnowledgeBindingRuleInput,
) {
  return client.request<KnowledgeBindingRuleViewModel>({
    method: "POST",
    url: `/api/v1/execution-governance/knowledge-binding-rules/${input.ruleId}/activate`,
    body: {
      actorRole: input.actorRole,
    },
  });
}

export function listKnowledgeBindingRules(client: ExecutionGovernanceHttpClient) {
  return client.request<KnowledgeBindingRuleViewModel[]>({
    method: "GET",
    url: "/api/v1/execution-governance/knowledge-binding-rules",
  });
}
