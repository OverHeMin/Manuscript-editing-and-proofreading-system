import { AiGatewayService } from "./ai-gateway-service.ts";
import type {
  ResolveModelSelectionInput,
  ResolvedModelSelection,
} from "./ai-gateway-service.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateAiGatewayApiOptions {
  aiGatewayService: AiGatewayService;
}

export function createAiGatewayApi(options: CreateAiGatewayApiOptions) {
  const { aiGatewayService } = options;

  return {
    async resolveModelSelection(
      input: ResolveModelSelectionInput,
    ): Promise<RouteResponse<ResolvedModelSelection>> {
      return {
        status: 200,
        body: await aiGatewayService.resolveModelSelection(input),
      };
    },
  };
}
