import type {
  HumanReviewContentDecision,
  HumanReviewGovernanceIntent,
} from "@medical/contracts";
import type {
  HumanReviewDiffItemViewModel,
  HumanReviewPublishFinalResultViewModel,
  HumanReviewPublishModule,
  HumanReviewPublishPreflightResultViewModel,
  HumanReviewBackflowResultViewModel,
} from "./types.ts";

export interface HumanReviewHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export interface ListHumanReviewDiffItemsInput {
  manuscriptId: string;
  module: HumanReviewPublishModule;
}

export interface UpdateHumanReviewDiffDecisionInput {
  diffItemId: string;
  contentDecision: HumanReviewContentDecision;
  governanceIntents?: HumanReviewGovernanceIntent;
  note?: string;
}

export interface BatchUpdateHumanReviewDiffDecisionsInput {
  updates: readonly UpdateHumanReviewDiffDecisionInput[];
}

export interface HumanReviewPublishInput {
  manuscriptId: string;
  module: HumanReviewPublishModule;
  outputStorageKey?: string;
  outputFileName?: string;
}

export function listHumanReviewDiffItems(
  client: HumanReviewHttpClient,
  input: ListHumanReviewDiffItemsInput,
) {
  const query = new URLSearchParams({
    manuscriptId: input.manuscriptId,
    module: input.module,
  });

  return client.request<HumanReviewDiffItemViewModel[]>({
    method: "GET",
    url: `/api/v1/human-review/diff-items?${query.toString()}`,
  });
}

export function updateHumanReviewDiffDecision(
  client: HumanReviewHttpClient,
  input: UpdateHumanReviewDiffDecisionInput,
) {
  return client.request<HumanReviewDiffItemViewModel>({
    method: "POST",
    url: `/api/v1/human-review/diff-items/${encodeURIComponent(
      input.diffItemId,
    )}/decision`,
    body: {
      contentDecision: input.contentDecision,
      ...(input.governanceIntents
        ? { governanceIntents: input.governanceIntents }
        : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
    },
  });
}

export function batchUpdateHumanReviewDiffDecisions(
  client: HumanReviewHttpClient,
  input: BatchUpdateHumanReviewDiffDecisionsInput,
) {
  return client.request<HumanReviewDiffItemViewModel[]>({
    method: "POST",
    url: "/api/v1/human-review/diff-items/batch-decisions",
    body: {
      updates: input.updates.map((update) => ({
        diffItemId: update.diffItemId,
        contentDecision: update.contentDecision,
        ...(update.governanceIntents
          ? { governanceIntents: update.governanceIntents }
          : {}),
        ...(update.note !== undefined ? { note: update.note } : {}),
      })),
    },
  });
}

export function preflightHumanReviewPublish(
  client: HumanReviewHttpClient,
  input: Pick<HumanReviewPublishInput, "manuscriptId" | "module">,
) {
  return client.request<HumanReviewPublishPreflightResultViewModel>({
    method: "POST",
    url: "/api/v1/human-review/preflight-publish",
    body: {
      manuscriptId: input.manuscriptId,
      module: input.module,
    },
  });
}

export function publishHumanReviewFinal(
  client: HumanReviewHttpClient,
  input: HumanReviewPublishInput,
) {
  return client.request<HumanReviewPublishFinalResultViewModel>({
    method: "POST",
    url: "/api/v1/human-review/publish-final",
    body: {
      manuscriptId: input.manuscriptId,
      module: input.module,
      ...(input.outputStorageKey
        ? { outputStorageKey: input.outputStorageKey }
        : {}),
      ...(input.outputFileName ? { outputFileName: input.outputFileName } : {}),
    },
  });
}

export function retryHumanReviewBackflow(
  client: HumanReviewHttpClient,
  diffItemId: string,
) {
  return client.request<HumanReviewBackflowResultViewModel>({
    method: "POST",
    url: `/api/v1/human-review/diff-items/${encodeURIComponent(
      diffItemId,
    )}/retry-backflow`,
  });
}
