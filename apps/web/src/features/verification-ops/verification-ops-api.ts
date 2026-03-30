import type {
  ActivateEvaluationSuiteInput,
  CompleteEvaluationRunInput,
  CreateLearningCandidateFromEvaluationInput,
  CreateEvaluationRunInput,
  CreateEvaluationSampleSetInput,
  CreateEvaluationSuiteInput,
  CreateReleaseCheckProfileInput,
  CreateVerificationCheckProfileInput,
  EvaluationLearningCandidateViewModel,
  EvaluationRunItemViewModel,
  EvaluationRunViewModel,
  EvaluationSampleSetItemViewModel,
  EvaluationSampleSetViewModel,
  EvaluationSuiteViewModel,
  FinalizeEvaluationRunInput,
  FinalizeEvaluationRunResultViewModel,
  PublishEvaluationSampleSetInput,
  PublishReleaseCheckProfileInput,
  PublishVerificationCheckProfileInput,
  RecordEvaluationRunItemResultInput,
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

export function createEvaluationSampleSet(
  client: VerificationOpsHttpClient,
  input: CreateEvaluationSampleSetInput,
) {
  return client.request<EvaluationSampleSetViewModel>({
    method: "POST",
    url: "/api/v1/verification-ops/evaluation-sample-sets",
    body: {
      actorRole: input.actorRole,
      input: {
        name: input.name,
        module: input.module,
        sampleItemInputs: input.sampleItemInputs,
      },
    },
  });
}

export function publishEvaluationSampleSet(
  client: VerificationOpsHttpClient,
  sampleSetId: string,
  input: PublishEvaluationSampleSetInput,
) {
  return client.request<EvaluationSampleSetViewModel>({
    method: "POST",
    url: `/api/v1/verification-ops/evaluation-sample-sets/${sampleSetId}/publish`,
    body: input,
  });
}

export function listEvaluationSampleSets(client: VerificationOpsHttpClient) {
  return client.request<EvaluationSampleSetViewModel[]>({
    method: "GET",
    url: "/api/v1/verification-ops/evaluation-sample-sets",
  });
}

export function listEvaluationSampleSetItems(
  client: VerificationOpsHttpClient,
  sampleSetId: string,
) {
  return client.request<EvaluationSampleSetItemViewModel[]>({
    method: "GET",
    url: `/api/v1/verification-ops/evaluation-sample-sets/${sampleSetId}/items`,
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
        requiresProductionBaseline: input.requiresProductionBaseline,
        supportsAbComparison: input.supportsAbComparison,
        hardGatePolicy: input.hardGatePolicy,
        scoreWeights: input.scoreWeights,
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
        sampleSetId: input.sampleSetId,
        baselineBinding: input.baselineBinding,
        candidateBinding: input.candidateBinding,
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

export function recordEvaluationRunItemResult(
  client: VerificationOpsHttpClient,
  input: RecordEvaluationRunItemResultInput,
) {
  return client.request<EvaluationRunItemViewModel>({
    method: "POST",
    url: `/api/v1/verification-ops/evaluation-run-items/${input.runItemId}/result`,
    body: {
      actorRole: input.actorRole,
      input: {
        runItemId: input.runItemId,
        resultAssetId: input.resultAssetId,
        hardGatePassed: input.hardGatePassed,
        weightedScore: input.weightedScore,
        failureKind: input.failureKind,
        failureReason: input.failureReason,
        diffSummary: input.diffSummary,
        requiresHumanReview: input.requiresHumanReview,
      },
    },
  });
}

export function finalizeEvaluationRun(
  client: VerificationOpsHttpClient,
  input: FinalizeEvaluationRunInput,
) {
  return client.request<FinalizeEvaluationRunResultViewModel>({
    method: "POST",
    url: `/api/v1/verification-ops/evaluation-runs/${input.runId}/finalize`,
    body: {
      actorRole: input.actorRole,
    },
  });
}

export function createLearningCandidateFromEvaluation(
  client: VerificationOpsHttpClient,
  input: CreateLearningCandidateFromEvaluationInput,
) {
  return client.request<EvaluationLearningCandidateViewModel>({
    method: "POST",
    // Keep the route nested under the frozen run so future admin workbenches can
    // treat experiment-to-learning handoff as a governed run action.
    url: `/api/v1/verification-ops/evaluation-runs/${input.runId}/learning-candidates`,
    body: {
      actorRole: input.actorRole,
      input: {
        runId: input.runId,
        evidencePackId: input.evidencePackId,
        reviewedCaseSnapshotId: input.reviewedCaseSnapshotId,
        candidateType: input.candidateType,
        title: input.title,
        proposalText: input.proposalText,
        createdBy: input.createdBy,
        sourceAssetId: input.sourceAssetId,
      },
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

export function listEvaluationRunItemsByRunId(
  client: VerificationOpsHttpClient,
  runId: string,
) {
  return client.request<EvaluationRunItemViewModel[]>({
    method: "GET",
    url: `/api/v1/verification-ops/evaluation-runs/${runId}/items`,
  });
}
