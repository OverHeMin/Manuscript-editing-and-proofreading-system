import type {
  CreateManuscriptQualityPackageDraftInput,
  ListManuscriptQualityPackagesInput,
  ManuscriptQualityPackageViewModel,
  PublishManuscriptQualityPackageVersionInput,
} from "./types.ts";

export interface ManuscriptQualityPackagesHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export function createManuscriptQualityPackageDraft(
  client: ManuscriptQualityPackagesHttpClient,
  input: CreateManuscriptQualityPackageDraftInput,
) {
  return client.request<ManuscriptQualityPackageViewModel>({
    method: "POST",
    url: "/api/v1/manuscript-quality-packages",
    body: {
      actorRole: input.actorRole,
      input: {
        packageName: input.packageName,
        packageKind: input.packageKind,
        targetScopes: input.targetScopes,
        manifest: input.manifest,
      },
    },
  });
}

export function listManuscriptQualityPackages(
  client: ManuscriptQualityPackagesHttpClient,
  input: ListManuscriptQualityPackagesInput = {},
) {
  const search = new URLSearchParams();
  if (input.packageKind) {
    search.set("packageKind", input.packageKind);
  }
  if (input.packageName) {
    search.set("packageName", input.packageName);
  }
  if (input.targetScope) {
    search.set("targetScope", input.targetScope);
  }
  if (input.status) {
    search.set("status", input.status);
  }

  const query = search.toString();

  return client.request<ManuscriptQualityPackageViewModel[]>({
    method: "GET",
    url:
      query.length > 0
        ? `/api/v1/manuscript-quality-packages?${query}`
        : "/api/v1/manuscript-quality-packages",
  });
}

export function publishManuscriptQualityPackageVersion(
  client: ManuscriptQualityPackagesHttpClient,
  packageVersionId: string,
  input: PublishManuscriptQualityPackageVersionInput,
) {
  return client.request<ManuscriptQualityPackageViewModel>({
    method: "POST",
    url: `/api/v1/manuscript-quality-packages/${packageVersionId}/publish`,
    body: input,
  });
}
