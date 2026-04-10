import type {
  CompileRulePackagesToDraftInputViewModel,
  CreateRulePackageExampleSourceSessionInput,
  CreateEditorialRuleInput,
  CreateEditorialRuleSetInput,
  GenerateRulePackageCandidatesFromReviewedCaseInput,
  EditorialRuleSetViewModel,
  EditorialRuleViewModel,
  PreviewCompileRulePackagesInputViewModel,
  RulePackageCandidateViewModel,
  RulePackageCompilePreviewViewModel,
  RulePackageCompileToDraftResultViewModel,
  RulePackageDraftViewModel,
  RulePackageExampleSourceSessionViewModel,
  RulePackagePreviewViewModel,
  RulePackageWorkspaceSourceInputViewModel,
  RulePackageWorkspaceViewModel,
} from "./types.ts";

export interface EditorialRulesHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export function createEditorialRuleSet(
  client: EditorialRulesHttpClient,
  input: CreateEditorialRuleSetInput,
) {
  return client.request<EditorialRuleSetViewModel>({
    method: "POST",
    url: "/api/v1/editorial-rules/rule-sets",
    body: input,
  });
}

export function listEditorialRuleSets(client: EditorialRulesHttpClient) {
  return client.request<EditorialRuleSetViewModel[]>({
    method: "GET",
    url: "/api/v1/editorial-rules/rule-sets",
  });
}

export function publishEditorialRuleSet(
  client: EditorialRulesHttpClient,
  ruleSetId: string,
  input: {
    actorRole: CreateEditorialRuleSetInput["actorRole"];
  },
) {
  return client.request<EditorialRuleSetViewModel>({
    method: "POST",
    url: `/api/v1/editorial-rules/rule-sets/${ruleSetId}/publish`,
    body: input,
  });
}

export function createEditorialRule(
  client: EditorialRulesHttpClient,
  ruleSetId: string,
  input: CreateEditorialRuleInput,
) {
  return client.request<EditorialRuleViewModel>({
    method: "POST",
    url: `/api/v1/editorial-rules/rule-sets/${ruleSetId}/rules`,
    body: input,
  });
}

export function listEditorialRulesByRuleSetId(
  client: EditorialRulesHttpClient,
  ruleSetId: string,
) {
  return client.request<EditorialRuleViewModel[]>({
    method: "GET",
    url: `/api/v1/editorial-rules/rule-sets/${ruleSetId}/rules`,
  });
}

export function generateRulePackageCandidatesFromReviewedCase(
  client: EditorialRulesHttpClient,
  input: GenerateRulePackageCandidatesFromReviewedCaseInput,
) {
  return client.request<RulePackageCandidateViewModel[]>({
    method: "POST",
    url: "/api/v1/editorial-rules/rule-packages/candidates/from-reviewed-case",
    body: { input },
  });
}

export function createRulePackageExampleSourceSession(
  client: EditorialRulesHttpClient,
  input: CreateRulePackageExampleSourceSessionInput,
) {
  return client.request<RulePackageExampleSourceSessionViewModel>({
    method: "POST",
    url: "/api/v1/editorial-rules/rule-packages/example-source-sessions",
    body: { input },
  });
}

export function loadRulePackageWorkspace(
  client: EditorialRulesHttpClient,
  input: RulePackageWorkspaceSourceInputViewModel,
) {
  return client.request<RulePackageWorkspaceViewModel>({
    method: "POST",
    url: "/api/v1/editorial-rules/rule-packages/workspace",
    body: { input },
  });
}

export function previewRulePackageDraft(
  client: EditorialRulesHttpClient,
  input: {
    packageDraft: RulePackageDraftViewModel | RulePackageCandidateViewModel;
    sampleText: string;
  },
) {
  const { preview: _preview, ...packageDraft } = input.packageDraft;

  return client.request<RulePackagePreviewViewModel>({
    method: "POST",
    url: "/api/v1/editorial-rules/rule-packages/preview",
    body: {
      packageDraft,
      sampleText: input.sampleText,
    },
  });
}

export function previewRulePackageCompile(
  client: EditorialRulesHttpClient,
  input: PreviewCompileRulePackagesInputViewModel,
) {
  return client.request<RulePackageCompilePreviewViewModel>({
    method: "POST",
    url: "/api/v1/editorial-rules/rule-packages/compile-preview",
    body: { input },
  });
}

export function compileRulePackagesToDraft(
  client: EditorialRulesHttpClient,
  input: CompileRulePackagesToDraftInputViewModel,
) {
  return client.request<RulePackageCompileToDraftResultViewModel>({
    method: "POST",
    url: "/api/v1/editorial-rules/rule-packages/compile-to-draft",
    body: { input },
  });
}
