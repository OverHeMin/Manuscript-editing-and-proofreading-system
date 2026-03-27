import { ScreeningService } from "./screening-service.ts";
import type {
  RunScreeningInput,
  ScreeningRunResult,
} from "./screening-service.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateScreeningApiOptions {
  screeningService: ScreeningService;
}

export function createScreeningApi(options: CreateScreeningApiOptions) {
  const { screeningService } = options;

  return {
    async runScreening(
      input: RunScreeningInput,
    ): Promise<RouteResponse<ScreeningRunResult>> {
      return {
        status: 201,
        body: await screeningService.run(input),
      };
    },
  };
}
