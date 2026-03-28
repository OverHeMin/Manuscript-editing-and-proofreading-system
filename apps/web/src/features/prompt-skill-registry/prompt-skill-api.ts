import type {
  CreatePromptTemplateInput,
  CreateSkillPackageInput,
  PromptTemplateViewModel,
  SkillPackageViewModel,
} from "./types.ts";

export interface PromptSkillRegistryHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export function createSkillPackage(
  client: PromptSkillRegistryHttpClient,
  input: CreateSkillPackageInput,
) {
  return client.request<SkillPackageViewModel>({
    method: "POST",
    url: "/api/v1/prompt-skill-registry/skill-packages",
    body: input,
  });
}

export function listSkillPackages(client: PromptSkillRegistryHttpClient) {
  return client.request<SkillPackageViewModel[]>({
    method: "GET",
    url: "/api/v1/prompt-skill-registry/skill-packages",
  });
}

export function createPromptTemplate(
  client: PromptSkillRegistryHttpClient,
  input: CreatePromptTemplateInput,
) {
  return client.request<PromptTemplateViewModel>({
    method: "POST",
    url: "/api/v1/prompt-skill-registry/prompt-templates",
    body: input,
  });
}

export function listPromptTemplates(client: PromptSkillRegistryHttpClient) {
  return client.request<PromptTemplateViewModel[]>({
    method: "GET",
    url: "/api/v1/prompt-skill-registry/prompt-templates",
  });
}
