import type { AuthRole } from "../auth/roles.ts";
import type {
  CreateModuleTemplateDraftInput,
  CreateTemplateFamilyInput,
  ModuleTemplateViewModel,
  TemplateFamilyViewModel,
  UpdateModuleTemplateDraftInput,
  UpdateTemplateFamilyInput,
} from "./types.ts";

export interface TemplateHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export function createTemplateFamily(
  client: TemplateHttpClient,
  input: CreateTemplateFamilyInput,
) {
  return client.request<TemplateFamilyViewModel>({
    method: "POST",
    url: "/api/v1/templates/families",
    body: input,
  });
}

export function createModuleTemplateDraft(
  client: TemplateHttpClient,
  input: CreateModuleTemplateDraftInput,
) {
  return client.request<ModuleTemplateViewModel>({
    method: "POST",
    url: "/api/v1/templates/module-drafts",
    body: input,
  });
}

export function updateModuleTemplateDraft(
  client: TemplateHttpClient,
  moduleTemplateId: string,
  input: UpdateModuleTemplateDraftInput,
) {
  return client.request<ModuleTemplateViewModel>({
    method: "POST",
    url: `/api/v1/templates/module-templates/${moduleTemplateId}/draft`,
    body: input,
  });
}

export function listModuleTemplatesByTemplateFamilyId(
  client: TemplateHttpClient,
  templateFamilyId: string,
) {
  return client.request<ModuleTemplateViewModel[]>({
    method: "GET",
    url: `/api/v1/templates/families/${templateFamilyId}/module-templates`,
  });
}

export function publishModuleTemplate(
  client: TemplateHttpClient,
  moduleTemplateId: string,
  actorRole: AuthRole,
) {
  return client.request<ModuleTemplateViewModel>({
    method: "POST",
    url: `/api/v1/templates/module-templates/${moduleTemplateId}/publish`,
    body: {
      actorRole,
    },
  });
}

export function updateTemplateFamily(
  client: TemplateHttpClient,
  templateFamilyId: string,
  input: UpdateTemplateFamilyInput,
) {
  return client.request<TemplateFamilyViewModel>({
    method: "POST",
    url: `/api/v1/templates/families/${templateFamilyId}`,
    body: input,
  });
}

export function listTemplateFamilies(client: TemplateHttpClient) {
  return client.request<TemplateFamilyViewModel[]>({
    method: "GET",
    url: "/api/v1/templates/families",
  });
}
