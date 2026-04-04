import type { RoleKey } from "../../users/roles.ts";
import type {
  ArchiveGoldSetVersionInput,
  CreateGoldSetFamilyInput,
  CreateGoldSetVersionInput,
  CreateRubricDefinitionInput,
  ExportHarnessGoldSetVersionInput,
  HarnessDatasetExportResultRecord,
  HarnessDatasetService,
  HarnessDatasetWorkbenchOverviewRecord,
  PublishGoldSetVersionInput,
  PublishRubricDefinitionInput,
  UpdateGoldSetVersionDraftInput,
} from "./harness-dataset-service.ts";
import type {
  HarnessGoldSetFamilyRecord,
  HarnessGoldSetVersionRecord,
  HarnessRubricDefinitionRecord,
} from "./harness-dataset-record.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateHarnessDatasetApiOptions {
  harnessDatasetService: HarnessDatasetService;
}

export function createHarnessDatasetApi(options: CreateHarnessDatasetApiOptions) {
  const { harnessDatasetService } = options;

  return {
    async listWorkbenchOverview({
      actorRole,
      exportRootDir,
    }: {
      actorRole: RoleKey;
      exportRootDir: string;
    }): Promise<RouteResponse<HarnessDatasetWorkbenchOverviewRecord>> {
      return {
        status: 200,
        body: await harnessDatasetService.listWorkbenchOverview(actorRole, {
          exportRootDir,
        }),
      };
    },

    async createGoldSetFamily({
      actorRole,
      input,
    }: {
      actorRole: RoleKey;
      input: CreateGoldSetFamilyInput;
    }): Promise<RouteResponse<HarnessGoldSetFamilyRecord>> {
      return {
        status: 201,
        body: await harnessDatasetService.createGoldSetFamily(actorRole, input),
      };
    },

    async createRubricDefinition({
      actorRole,
      input,
    }: {
      actorRole: RoleKey;
      input: CreateRubricDefinitionInput;
    }): Promise<RouteResponse<HarnessRubricDefinitionRecord>> {
      return {
        status: 201,
        body: await harnessDatasetService.createRubricDefinition(actorRole, input),
      };
    },

    async publishRubricDefinition({
      actorRole,
      rubricDefinitionId,
      input,
    }: {
      actorRole: RoleKey;
      rubricDefinitionId: string;
      input: PublishRubricDefinitionInput;
    }): Promise<RouteResponse<HarnessRubricDefinitionRecord>> {
      return {
        status: 200,
        body: await harnessDatasetService.publishRubricDefinition(
          actorRole,
          rubricDefinitionId,
          input,
        ),
      };
    },

    async createGoldSetVersion({
      actorRole,
      input,
    }: {
      actorRole: RoleKey;
      input: CreateGoldSetVersionInput;
    }): Promise<RouteResponse<HarnessGoldSetVersionRecord>> {
      return {
        status: 201,
        body: await harnessDatasetService.createGoldSetVersion(actorRole, input),
      };
    },

    async updateGoldSetVersionDraft({
      actorRole,
      goldSetVersionId,
      input,
    }: {
      actorRole: RoleKey;
      goldSetVersionId: string;
      input: UpdateGoldSetVersionDraftInput;
    }): Promise<RouteResponse<HarnessGoldSetVersionRecord>> {
      return {
        status: 200,
        body: await harnessDatasetService.updateGoldSetVersionDraft(
          actorRole,
          goldSetVersionId,
          input,
        ),
      };
    },

    async publishGoldSetVersion({
      actorRole,
      goldSetVersionId,
      input,
    }: {
      actorRole: RoleKey;
      goldSetVersionId: string;
      input: PublishGoldSetVersionInput;
    }): Promise<RouteResponse<HarnessGoldSetVersionRecord>> {
      return {
        status: 200,
        body: await harnessDatasetService.publishGoldSetVersion(
          actorRole,
          goldSetVersionId,
          input,
        ),
      };
    },

    async archiveGoldSetVersion({
      actorRole,
      goldSetVersionId,
      input,
    }: {
      actorRole: RoleKey;
      goldSetVersionId: string;
      input: ArchiveGoldSetVersionInput;
    }): Promise<RouteResponse<HarnessGoldSetVersionRecord>> {
      return {
        status: 200,
        body: await harnessDatasetService.archiveGoldSetVersion(
          actorRole,
          goldSetVersionId,
          input,
        ),
      };
    },

    async exportGoldSetVersion({
      actorRole,
      goldSetVersionId,
      input,
    }: {
      actorRole: RoleKey;
      goldSetVersionId: string;
      input: ExportHarnessGoldSetVersionInput;
    }): Promise<RouteResponse<HarnessDatasetExportResultRecord>> {
      return {
        status: 201,
        body: await harnessDatasetService.exportGoldSetVersion(
          actorRole,
          goldSetVersionId,
          input,
        ),
      };
    },
  };
}
