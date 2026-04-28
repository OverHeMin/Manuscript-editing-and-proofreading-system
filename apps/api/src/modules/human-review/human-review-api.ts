import type {
  BatchUpdateHumanReviewDiffDecisionsInput,
  HumanReviewPublishPreflightInput,
  HumanReviewService,
  ListHumanReviewDiffItemsInput,
  PublishHumanReviewFinalInput,
  RetryHumanReviewBackflowInput,
  UpdateHumanReviewDiffDecisionInput,
} from "./human-review-service.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateHumanReviewApiOptions {
  humanReviewService: HumanReviewService;
}

export function createHumanReviewApi(options: CreateHumanReviewApiOptions) {
  const { humanReviewService } = options;

  return {
    async listDiffItems(input: ListHumanReviewDiffItemsInput) {
      return {
        status: 200,
        body: await humanReviewService.listDiffItems(input),
      } satisfies RouteResponse<Awaited<ReturnType<HumanReviewService["listDiffItems"]>>>;
    },

    async updateDiffDecision(input: UpdateHumanReviewDiffDecisionInput) {
      return {
        status: 200,
        body: await humanReviewService.updateDiffDecision(input),
      } satisfies RouteResponse<
        Awaited<ReturnType<HumanReviewService["updateDiffDecision"]>>
      >;
    },

    async batchUpdateDiffDecisions(
      input: BatchUpdateHumanReviewDiffDecisionsInput,
    ) {
      return {
        status: 200,
        body: await humanReviewService.batchUpdateDiffDecisions(input),
      } satisfies RouteResponse<
        Awaited<ReturnType<HumanReviewService["batchUpdateDiffDecisions"]>>
      >;
    },

    async preflightPublish(input: HumanReviewPublishPreflightInput) {
      return {
        status: 200,
        body: await humanReviewService.preflightPublish(input),
      } satisfies RouteResponse<
        Awaited<ReturnType<HumanReviewService["preflightPublish"]>>
      >;
    },

    async publishConfirmedFinal(input: PublishHumanReviewFinalInput) {
      return {
        status: 201,
        body: await humanReviewService.publishConfirmedFinal(input),
      } satisfies RouteResponse<
        Awaited<ReturnType<HumanReviewService["publishConfirmedFinal"]>>
      >;
    },

    async retryBackflow(input: RetryHumanReviewBackflowInput) {
      return {
        status: 200,
        body: await humanReviewService.retryBackflow(input),
      } satisfies RouteResponse<
        Awaited<ReturnType<HumanReviewService["retryBackflow"]>>
      >;
    },
  };
}
