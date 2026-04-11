import type { RoleKey } from "../../users/roles.ts";
import type {
  HarnessEnvironmentPreviewRecord,
  HarnessEnvironmentRecord,
} from "./harness-control-plane-record.ts";
import type {
  ActivateHarnessEnvironmentInput,
  HarnessControlPlaneService,
  ResolveHarnessEnvironmentPreviewInput,
  RollbackHarnessEnvironmentInput,
} from "./harness-control-plane-service.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateHarnessControlPlaneApiOptions {
  harnessControlPlaneService: HarnessControlPlaneService;
}

export function createHarnessControlPlaneApi(
  options: CreateHarnessControlPlaneApiOptions,
) {
  const { harnessControlPlaneService } = options;

  return {
    async getScopeEnvironment({
      input,
    }: {
      input: ResolveHarnessEnvironmentPreviewInput;
    }): Promise<RouteResponse<{ active_environment: HarnessEnvironmentRecord }>> {
      return {
        status: 200,
        body: {
          active_environment: await harnessControlPlaneService.getActiveEnvironment(
            input,
          ),
        },
      };
    },

    async previewEnvironment({
      input,
    }: {
      input: ResolveHarnessEnvironmentPreviewInput;
    }): Promise<RouteResponse<HarnessEnvironmentPreviewRecord>> {
      return {
        status: 200,
        body: await harnessControlPlaneService.previewEnvironment(input),
      };
    },

    async activateEnvironment({
      actorRole,
      input,
    }: {
      actorRole: RoleKey;
      input: ActivateHarnessEnvironmentInput;
    }): Promise<RouteResponse<HarnessEnvironmentRecord>> {
      return {
        status: 200,
        body: await harnessControlPlaneService.activateEnvironment(actorRole, input),
      };
    },

    async rollbackEnvironment({
      actorRole,
      input,
    }: {
      actorRole: RoleKey;
      input: RollbackHarnessEnvironmentInput;
    }): Promise<RouteResponse<HarnessEnvironmentRecord>> {
      return {
        status: 200,
        body: await harnessControlPlaneService.rollbackEnvironment(actorRole, input),
      };
    },
  };
}
