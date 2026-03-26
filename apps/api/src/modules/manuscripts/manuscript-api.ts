import {
  DocumentAssetService,
  ManuscriptNotFoundError,
} from "../assets/document-asset-service.ts";
import { ManuscriptLifecycleService } from "./manuscript-lifecycle-service.ts";
import type { UploadManuscriptInput } from "./manuscript-lifecycle-service.ts";
import type { DocumentAssetRecord } from "../assets/document-asset-record.ts";
import type { JobRecord } from "../jobs/job-record.ts";
import type { ManuscriptRecord } from "./manuscript-record.ts";

interface RouteResponse<T> {
  status: number;
  body: T;
}

export class JobNotFoundError extends Error {
  constructor(jobId: string) {
    super(`Job ${jobId} was not found.`);
    this.name = "JobNotFoundError";
  }
}

export interface CreateManuscriptApiOptions {
  manuscriptService: ManuscriptLifecycleService;
  assetService: DocumentAssetService;
}

export function createManuscriptApi(options: CreateManuscriptApiOptions) {
  const { manuscriptService, assetService } = options;

  return {
    async upload(
      input: UploadManuscriptInput,
    ): Promise<RouteResponse<Awaited<ReturnType<ManuscriptLifecycleService["upload"]>>>> {
      const result = await manuscriptService.upload(input);

      return {
        status: 201,
        body: result,
      };
    },

    async getManuscript({
      manuscriptId,
    }: {
      manuscriptId: string;
    }): Promise<RouteResponse<ManuscriptRecord>> {
      const manuscript = await manuscriptService.getManuscript(manuscriptId);

      if (!manuscript) {
        throw new ManuscriptNotFoundError(manuscriptId);
      }

      return {
        status: 200,
        body: manuscript,
      };
    },

    async listAssets({
      manuscriptId,
    }: {
      manuscriptId: string;
    }): Promise<RouteResponse<DocumentAssetRecord[]>> {
      const manuscript = await manuscriptService.getManuscript(manuscriptId);

      if (!manuscript) {
        throw new ManuscriptNotFoundError(manuscriptId);
      }

      return {
        status: 200,
        body: await assetService.listAssets(manuscriptId),
      };
    },

    async getJob({
      jobId,
    }: {
      jobId: string;
    }): Promise<RouteResponse<JobRecord>> {
      const job = await manuscriptService.getJob(jobId);

      if (!job) {
        throw new JobNotFoundError(jobId);
      }

      return {
        status: 200,
        body: job,
      };
    },
  };
}

export { ManuscriptNotFoundError };
