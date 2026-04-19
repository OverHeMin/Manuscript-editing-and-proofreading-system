import type {
  ReviewItemDecisionResult,
  ReviewItemRecord,
} from "./review-item-record.ts";
import type {
  DecideReviewItemInput,
  ListReviewItemsInput,
  ReviewItemsService,
  SubmitGovernedHitInput,
  SubmitGovernedHitResult,
} from "./review-items-service.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateReviewItemsApiOptions {
  reviewItemsService: Pick<
    ReviewItemsService,
    "listReviewItems" | "submitGovernedHit" | "decideReviewItem"
  >;
}

export function createReviewItemsApi(options: CreateReviewItemsApiOptions) {
  const { reviewItemsService } = options;

  return {
    async listReviewItems(
      input: ListReviewItemsInput = {},
    ): Promise<RouteResponse<ReviewItemRecord[]>> {
      return {
        status: 200,
        body: await reviewItemsService.listReviewItems(input),
      };
    },

    async submitGovernedHit(
      input: SubmitGovernedHitInput,
    ): Promise<RouteResponse<SubmitGovernedHitResult>> {
      return {
        status: 201,
        body: await reviewItemsService.submitGovernedHit(input),
      };
    },

    async decideReviewItem(
      input: DecideReviewItemInput,
    ): Promise<RouteResponse<ReviewItemDecisionResult>> {
      return {
        status: 200,
        body: await reviewItemsService.decideReviewItem(input),
      };
    },
  };
}

export type ReviewItemsApi = ReturnType<typeof createReviewItemsApi>;
