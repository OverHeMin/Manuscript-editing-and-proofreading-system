import type { TableEvidenceBindingTargetType } from "./table-evidence-record.ts";
import type { TableEvidenceService } from "./table-evidence-service.ts";

export interface RouteResponse<T> {
  status: number;
  body: T;
}

export function createTableEvidenceApi(options: {
  tableEvidenceService: TableEvidenceService;
}) {
  const { tableEvidenceService } = options;

  return {
    async createAssetFromDocxUpload(
      input: Parameters<TableEvidenceService["createAssetFromDocxUpload"]>[0],
    ): Promise<
      RouteResponse<
        Awaited<ReturnType<TableEvidenceService["createAssetFromDocxUpload"]>>
      >
    > {
      return {
        status: 201,
        body: await tableEvidenceService.createAssetFromDocxUpload(input),
      };
    },

    async saveCorrectionPatch(
      input: Parameters<TableEvidenceService["saveCorrectionPatch"]>[0],
    ): Promise<
      RouteResponse<
        Awaited<ReturnType<TableEvidenceService["saveCorrectionPatch"]>>
      >
    > {
      return {
        status: 200,
        body: await tableEvidenceService.saveCorrectionPatch(input),
      };
    },

    async confirmRevision(
      input: Parameters<TableEvidenceService["confirmRevision"]>[0],
    ): Promise<
      RouteResponse<Awaited<ReturnType<TableEvidenceService["confirmRevision"]>>>
    > {
      return {
        status: 200,
        body: await tableEvidenceService.confirmRevision(input),
      };
    },

    async bindRevision(
      input: Parameters<TableEvidenceService["bindRevision"]>[0],
    ): Promise<
      RouteResponse<Awaited<ReturnType<TableEvidenceService["bindRevision"]>>>
    > {
      return {
        status: 201,
        body: await tableEvidenceService.bindRevision(input),
      };
    },

    async listConfirmedPackagesForTarget(input: {
      targetType: TableEvidenceBindingTargetType;
      targetId: string;
    }): Promise<
      RouteResponse<
        Awaited<
          ReturnType<TableEvidenceService["resolveConfirmedPackagesForTarget"]>
        >
      >
    > {
      return {
        status: 200,
        body: await tableEvidenceService.resolveConfirmedPackagesForTarget(
          input.targetType,
          input.targetId,
        ),
      };
    },
  };
}
