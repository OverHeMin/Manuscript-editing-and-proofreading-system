import type {
  CreateEditorialRuleInput,
  CreateEditorialRuleSetInput,
  EditorialRuleSetViewModel,
  EditorialRuleViewModel,
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
