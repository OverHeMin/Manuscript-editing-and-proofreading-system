import type {
  HarnessAdapterRecord,
  HarnessExecutionAuditRecord,
  HarnessFeatureFlagChangeRecord,
  HarnessRedactionProfileRecord,
} from "./harness-integration-record.ts";
import type {
  HarnessIntegrationService,
  RecordHarnessExecutionAuditInput,
  RecordHarnessFeatureFlagChangeInput,
  RegisterHarnessAdapterInput,
  UpsertHarnessRedactionProfileInput,
} from "./harness-integration-service.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateHarnessIntegrationApiOptions {
  harnessIntegrationService: HarnessIntegrationService;
}

export function createHarnessIntegrationApi(
  options: CreateHarnessIntegrationApiOptions,
) {
  const { harnessIntegrationService } = options;

  return {
    async upsertRedactionProfile({
      input,
    }: {
      input: UpsertHarnessRedactionProfileInput;
    }): Promise<RouteResponse<HarnessRedactionProfileRecord>> {
      return {
        status: 201,
        body: await harnessIntegrationService.upsertRedactionProfile(input),
      };
    },

    async registerAdapter({
      input,
    }: {
      input: RegisterHarnessAdapterInput;
    }): Promise<RouteResponse<HarnessAdapterRecord>> {
      return {
        status: 201,
        body: await harnessIntegrationService.registerAdapter(input),
      };
    },

    async recordFeatureFlagChange({
      input,
    }: {
      input: RecordHarnessFeatureFlagChangeInput;
    }): Promise<RouteResponse<HarnessFeatureFlagChangeRecord>> {
      return {
        status: 201,
        body: await harnessIntegrationService.recordFeatureFlagChange(input),
      };
    },

    async recordExecutionAudit({
      input,
    }: {
      input: RecordHarnessExecutionAuditInput;
    }): Promise<RouteResponse<HarnessExecutionAuditRecord>> {
      return {
        status: 201,
        body: await harnessIntegrationService.recordExecutionAudit(input),
      };
    },

    async listAdapters(): Promise<RouteResponse<HarnessAdapterRecord[]>> {
      return {
        status: 200,
        body: await harnessIntegrationService.listAdapters(),
      };
    },

    async getRedactionProfileById({
      id,
    }: {
      id: string;
    }): Promise<RouteResponse<HarnessRedactionProfileRecord | undefined>> {
      return {
        status: 200,
        body: await harnessIntegrationService.getRedactionProfileById(id),
      };
    },

    async listFeatureFlagChangesByAdapterId({
      adapterId,
    }: {
      adapterId: string;
    }): Promise<RouteResponse<HarnessFeatureFlagChangeRecord[]>> {
      return {
        status: 200,
        body: await harnessIntegrationService.listFeatureFlagChangesByAdapterId(
          adapterId,
        ),
      };
    },

    async listExecutionAuditsByAdapterId({
      adapterId,
    }: {
      adapterId: string;
    }): Promise<RouteResponse<HarnessExecutionAuditRecord[]>> {
      return {
        status: 200,
        body: await harnessIntegrationService.listExecutionAuditsByAdapterId(
          adapterId,
        ),
      };
    },
  };
}
