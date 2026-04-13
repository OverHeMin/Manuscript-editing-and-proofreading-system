import type { AuthRole } from "../auth/roles.ts";
import type {
  CreateContentModuleDraftFromCandidateInput,
  CreateContentModuleDraftInput,
  CreateJournalTemplateProfileInput,
  CreateModuleTemplateDraftInput,
  CreateTemplateCompositionDraftFromCandidateInput,
  CreateTemplateCompositionDraftInput,
  CreateTemplateFamilyInput,
  GovernedContentModuleViewModel,
  JournalTemplateProfileViewModel,
  ModuleTemplateViewModel,
  TemplateCompositionViewModel,
  TemplateFamilyViewModel,
  UpdateContentModuleDraftInput,
  UpdateModuleTemplateDraftInput,
  UpdateTemplateCompositionDraftInput,
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

export function createJournalTemplateProfile(
  client: TemplateHttpClient,
  input: CreateJournalTemplateProfileInput,
) {
  return client.request<JournalTemplateProfileViewModel>({
    method: "POST",
    url: "/api/v1/templates/journal-templates",
    body: input,
  });
}

export function createContentModuleDraft(
  client: TemplateHttpClient,
  input: CreateContentModuleDraftInput,
) {
  return client.request<GovernedContentModuleViewModel>({
    method: "POST",
    url: "/api/v1/templates/content-modules",
    body: input,
  });
}

export function createContentModuleDraftFromCandidate(
  client: TemplateHttpClient,
  input: CreateContentModuleDraftFromCandidateInput,
) {
  return client.request<GovernedContentModuleViewModel>({
    method: "POST",
    url: "/api/v1/templates/content-modules/intake-from-candidate",
    body: input,
  });
}

export function listContentModules(
  client: TemplateHttpClient,
  moduleClass?: CreateContentModuleDraftInput["moduleClass"],
) {
  const url = moduleClass
    ? `/api/v1/templates/content-modules?moduleClass=${encodeURIComponent(moduleClass)}`
    : "/api/v1/templates/content-modules";

  return client.request<GovernedContentModuleViewModel[]>({
    method: "GET",
    url,
  });
}

export function updateContentModuleDraft(
  client: TemplateHttpClient,
  contentModuleId: string,
  input: UpdateContentModuleDraftInput,
) {
  return client.request<GovernedContentModuleViewModel>({
    method: "POST",
    url: `/api/v1/templates/content-modules/${contentModuleId}/draft`,
    body: input,
  });
}

export function createTemplateCompositionDraft(
  client: TemplateHttpClient,
  input: CreateTemplateCompositionDraftInput,
) {
  return client.request<TemplateCompositionViewModel>({
    method: "POST",
    url: "/api/v1/templates/template-compositions",
    body: input,
  });
}

export function createTemplateCompositionDraftFromCandidate(
  client: TemplateHttpClient,
  input: CreateTemplateCompositionDraftFromCandidateInput,
) {
  return client.request<TemplateCompositionViewModel>({
    method: "POST",
    url: "/api/v1/templates/template-compositions/intake-from-candidate",
    body: input,
  });
}

export function listTemplateCompositions(client: TemplateHttpClient) {
  return client.request<TemplateCompositionViewModel[]>({
    method: "GET",
    url: "/api/v1/templates/template-compositions",
  });
}

export function updateTemplateCompositionDraft(
  client: TemplateHttpClient,
  templateCompositionId: string,
  input: UpdateTemplateCompositionDraftInput,
) {
  return client.request<TemplateCompositionViewModel>({
    method: "POST",
    url: `/api/v1/templates/template-compositions/${templateCompositionId}/draft`,
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

export function listJournalTemplateProfilesByTemplateFamilyId(
  client: TemplateHttpClient,
  templateFamilyId: string,
) {
  return client.request<JournalTemplateProfileViewModel[]>({
    method: "GET",
    url: `/api/v1/templates/families/${templateFamilyId}/journal-templates`,
  });
}

export function activateJournalTemplateProfile(
  client: TemplateHttpClient,
  journalTemplateProfileId: string,
  actorRole: AuthRole,
) {
  return client.request<JournalTemplateProfileViewModel>({
    method: "POST",
    url: `/api/v1/templates/journal-templates/${journalTemplateProfileId}/activate`,
    body: {
      actorRole,
    },
  });
}

export function archiveJournalTemplateProfile(
  client: TemplateHttpClient,
  journalTemplateProfileId: string,
  actorRole: AuthRole,
) {
  return client.request<JournalTemplateProfileViewModel>({
    method: "POST",
    url: `/api/v1/templates/journal-templates/${journalTemplateProfileId}/archive`,
    body: {
      actorRole,
    },
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
