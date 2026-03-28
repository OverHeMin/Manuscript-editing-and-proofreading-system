import type {
  ActivateEvaluationSuiteInput,
  CompleteEvaluationRunInput,
  CreateEvaluationRunInput,
  CreateEvaluationSuiteInput,
  CreateReleaseCheckProfileInput,
  CreateVerificationCheckProfileInput,
  EvaluationRunViewModel,
  EvaluationSuiteViewModel,
  PublishReleaseCheckProfileInput,
  PublishVerificationCheckProfileInput,
  RecordVerificationEvidenceInput,
  ReleaseCheckProfileViewModel,
  VerificationCheckProfileViewModel,
  VerificationEvidenceViewModel,
} from "./types.ts";

export interface VerificationOpsHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export function createVerificationCheckProfile(
  client: VerificationOpsHttpClient,
  input: CreateVerificationCheckProfileInput,
) {
  return client.request<VerificationCheckProfileViewModel>({
    method: "POST",
    url: "/api/v1/verification-ops/check-profiles",
    body: {
      actorRole: input.actorRole,
      input: {
        name: input.name,
        checkType: input.checkType,
        toolIds: input.toolIds,
      },
    },
  });
}

export function publishVerificationCheckProfile(
  client: VerificationOpsHttpClient,
  profileId: string,
  input: PublishVerificationCheckProfileInput,
) {
  return client.request<VerificationCheckProfileViewModel>({
    method: "POST",
    url: `/api/v1/verification-ops/check-profiles/${profileId}/publish`,
    body: input,
  });
}

export function listVerificationCheckProfiles(client: VerificationOpsHttpClient) {
  return client.request<VerificationCheckProfileViewModel[]>({
    method: "GET",
    url: "/api/v1/verification-ops/check-profiles",
  });
}

export function createReleaseCheckProfile(
  client: VerificationOpsHttpClient,
  input: CreateReleaseCheckProfileInput,
) {
  return client.request<ReleaseCheckProfileViewModel>({
    method: "POST",
    url: "/api/v1/verification-ops/release-check-profiles",
    body: {
      actorRole: input.actorRole,
      input: {
        name: input.name,
        checkType: input.checkType,
        verificationCheckProfileIds: input.verificationCheckProfileIds,
      },
    },
  });
}

export function publishReleaseCheckProfile(
  client: VerificationOpsHttpClient,
  profileId: string,
  input: PublishReleaseCheckProfileInput,
) {
  return client.request<ReleaseCheckProfileViewModel>({
    method: "POST",
    url: `/api/v1/verification-ops/release-check-profiles/${profileId}/publish`,
    body: input,
  });
}

export function listReleaseCheckProfiles(client: VerificationOpsHttpClient) {
  return client.request<ReleaseCheckProfileViewModel[]>({
    method: "GET",
    url: "/api/v1/verification-ops/release-check-profiles",
  });
}

export function createEvaluationSuite(
  client: VerificationOpsHttpClient,
  input: CreateEvaluationSuiteInput,
) {
  return client.request<EvaluationSuiteViewModel>({
    method: "POST",
    url: "/api/v1/verification-ops/evaluation-suites",
    body: {
      actorRole: input.actorRole,
      input: {
        name: input.name,
        suiteType: input.suiteType,
        verificationCheckProfileIds: input.verificationCheckProfileIds,
        moduleScope: input.moduleScope,
      },
    },
  });
}

export function activateEvaluationSuite(
  client: VerificationOpsHttpClient,
  suiteId: string,
  input: ActivateEvaluationSuiteInput,
) {
  return client.request<EvaluationSuiteViewModel>({
    method: "POST",
    url: `/api/v1/verification-ops/evaluation-suites/${suiteId}/activate`,
    body: input,
  });
}

export function listEvaluationSuites(client: VerificationOpsHttpClient) {
  return client.request<EvaluationSuiteViewModel[]>({
    method: "GET",
    url: "/api/v1/verification-ops/evaluation-suites",
  });
}

export function recordVerificationEvidence(
  client: VerificationOpsHttpClient,
  input: RecordVerificationEvidenceInput,
) {
  return client.request<VerificationEvidenceViewModel>({
    method: "POST",
    url: "/api/v1/verification-ops/evidence",
    body: {
      actorRole: input.actorRole,
      input: {
        kind: input.kind,
        label: input.label,
        uri: input.uri,
        artifactAssetId: input.artifactAssetId,
        checkProfileId: input.checkProfileId,
      },
    },
  });
}

export function createEvaluationRun(
  client: VerificationOpsHttpClient,
  input: CreateEvaluationRunInput,
) {
  return client.request<EvaluationRunViewModel>({
    method: "POST",
    url: "/api/v1/verification-ops/evaluation-runs",
    body: {
      actorRole: input.actorRole,
      input: {
        suiteId: input.suiteId,
        releaseCheckProfileId: input.releaseCheckProfileId,
      },
    },
  });
}

export function completeEvaluationRun(
  client: VerificationOpsHttpClient,
  input: CompleteEvaluationRunInput,
) {
  return client.request<EvaluationRunViewModel>({
    method: "POST",
    url: `/api/v1/verification-ops/evaluation-runs/${input.runId}/complete`,
    body: {
      actorRole: input.actorRole,
      status: input.status,
      evidenceIds: input.evidenceIds,
    },
  });
}

export function listEvaluationRunsBySuiteId(
  client: VerificationOpsHttpClient,
  suiteId: string,
) {
  return client.request<EvaluationRunViewModel[]>({
    method: "GET",
    url: `/api/v1/verification-ops/evaluation-suites/${suiteId}/runs`,
  });
}
