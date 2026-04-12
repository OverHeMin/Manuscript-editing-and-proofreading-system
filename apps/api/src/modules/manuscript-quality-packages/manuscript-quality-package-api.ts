import type { RoleKey } from "../../users/roles.ts";
import type { ManuscriptQualityPackageRecord } from "./manuscript-quality-package-record.ts";
import type {
  CreateManuscriptQualityPackageDraftInput,
  ListManuscriptQualityPackageVersionsInput,
  ManuscriptQualityPackageService,
} from "./manuscript-quality-package-service.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export interface CreateManuscriptQualityPackageApiOptions {
  manuscriptQualityPackageService: ManuscriptQualityPackageService;
}

export function createManuscriptQualityPackageApi(
  options: CreateManuscriptQualityPackageApiOptions,
) {
  const { manuscriptQualityPackageService } = options;

  return {
    async createDraftVersion({
      actorRole,
      input,
    }: {
      actorRole: RoleKey;
      input: CreateManuscriptQualityPackageDraftInput;
    }): Promise<RouteResponse<ManuscriptQualityPackageRecord>> {
      return {
        status: 201,
        body: await manuscriptQualityPackageService.createDraftVersion(
          actorRole,
          input,
        ),
      };
    },

    async publishVersion({
      actorRole,
      packageVersionId,
    }: {
      actorRole: RoleKey;
      packageVersionId: string;
    }): Promise<RouteResponse<ManuscriptQualityPackageRecord>> {
      return {
        status: 200,
        body: await manuscriptQualityPackageService.publishVersion(
          packageVersionId,
          actorRole,
        ),
      };
    },

    async listPackageVersions(
      input: ListManuscriptQualityPackageVersionsInput = {},
    ): Promise<RouteResponse<ManuscriptQualityPackageRecord[]>> {
      return {
        status: 200,
        body: await manuscriptQualityPackageService.listPackageVersions(input),
      };
    },
  };
}
