import {
  activateEvaluationSuite,
  completeEvaluationRun,
  createEvaluationRun,
  createLearningCandidateFromEvaluation as createLearningCandidateFromEvaluationRequest,
  finalizeEvaluationRun,
  listEvaluationRunItemsByRunId,
  listEvaluationRunsBySuiteId,
  listEvaluationSampleSets,
  listEvaluationSuites,
  listReleaseCheckProfiles,
  listVerificationCheckProfiles,
  recordEvaluationRunItemResult,
  recordVerificationEvidence,
} from "../verification-ops/index.ts";
import type { AuthRole } from "../auth/index.ts";
import type {
  CreateLearningCandidateFromEvaluationInput,
  CreateEvaluationRunInput,
  EvaluationLearningCandidateViewModel,
  EvaluationRunItemViewModel,
  EvaluationRunViewModel,
  EvaluationSampleSetViewModel,
  EvaluationSuiteViewModel,
  FinalizeEvaluationRunResultViewModel,
  RecordEvaluationRunItemResultInput,
  ReleaseCheckProfileViewModel,
  VerificationEvidenceKind,
  VerificationEvidenceViewModel,
  VerificationCheckProfileViewModel,
} from "../verification-ops/index.ts";

export interface EvaluationWorkbenchHttpClient {
  request<TResponse>(input: {
    method: "GET" | "POST";
    url: string;
    body?: unknown;
  }): Promise<{
    status: number;
    body: TResponse;
  }>;
}

export interface EvaluationWorkbenchOverview {
  checkProfiles: VerificationCheckProfileViewModel[];
  releaseCheckProfiles: ReleaseCheckProfileViewModel[];
  sampleSets: EvaluationSampleSetViewModel[];
  suites: EvaluationSuiteViewModel[];
  selectedSuiteId: string | null;
  runs: EvaluationRunViewModel[];
  selectedRunId: string | null;
  runItems: EvaluationRunItemViewModel[];
}

export interface EvaluationWorkbenchController {
  loadOverview(input?: {
    selectedSuiteId?: string | null;
    selectedRunId?: string | null;
  }): Promise<EvaluationWorkbenchOverview>;
  activateSuiteAndReload(input: {
    suiteId: string;
    actorRole: AuthRole;
  }): Promise<EvaluationWorkbenchOverview>;
  createRunAndReload(
    input: CreateEvaluationRunInput,
  ): Promise<EvaluationWorkbenchCreateRunResult>;
  recordRunItemResultAndReload(
    input: EvaluationWorkbenchRecordRunItemResultInput,
  ): Promise<EvaluationWorkbenchRecordRunItemResultResult>;
  completeRunWithEvidenceAndFinalize(
    input: EvaluationWorkbenchCompleteRunInput,
  ): Promise<EvaluationWorkbenchFinalizeRunResult>;
  createLearningCandidateFromEvaluation(
    input: CreateLearningCandidateFromEvaluationInput,
  ): Promise<EvaluationLearningCandidateViewModel>;
}

export interface EvaluationWorkbenchCreateRunResult {
  overview: EvaluationWorkbenchOverview;
  run: EvaluationRunViewModel;
}

export interface EvaluationWorkbenchRecordRunItemResultInput
  extends RecordEvaluationRunItemResultInput {
  suiteId: string;
  runId: string;
}

export interface EvaluationWorkbenchRecordRunItemResultResult {
  overview: EvaluationWorkbenchOverview;
  runItem: EvaluationRunItemViewModel;
}

export interface EvaluationWorkbenchCompleteRunInput {
  actorRole: AuthRole;
  suiteId: string;
  runId: string;
  status: "passed" | "failed";
  evidence?: {
    kind: VerificationEvidenceKind;
    label: string;
    uri?: string;
    artifactAssetId?: string;
    checkProfileId?: string;
  };
  existingEvidenceIds?: string[];
}

export interface EvaluationWorkbenchFinalizeRunResult {
  overview: EvaluationWorkbenchOverview;
  evidence: VerificationEvidenceViewModel | null;
  finalized: FinalizeEvaluationRunResultViewModel;
}

export function createEvaluationWorkbenchController(
  client: EvaluationWorkbenchHttpClient,
): EvaluationWorkbenchController {
  return {
    loadOverview(input) {
      return loadEvaluationWorkbenchOverview(client, input);
    },
    async activateSuiteAndReload(input) {
      await activateEvaluationSuite(client, input.suiteId, {
        actorRole: input.actorRole,
      });

      return loadEvaluationWorkbenchOverview(client, {
        selectedSuiteId: input.suiteId,
      });
    },
    async createRunAndReload(input) {
      const run = (await createEvaluationRun(client, input)).body;

      return {
        run,
        overview: await loadEvaluationWorkbenchOverview(client, {
          selectedSuiteId: input.suiteId,
          selectedRunId: run.id,
        }),
      };
    },
    async recordRunItemResultAndReload(input) {
      const runItem = (await recordEvaluationRunItemResult(client, input)).body;

      return {
        runItem,
        overview: await loadEvaluationWorkbenchOverview(client, {
          selectedSuiteId: input.suiteId,
          selectedRunId: input.runId,
        }),
      };
    },
    async completeRunWithEvidenceAndFinalize(input) {
      const evidenceIds = [...(input.existingEvidenceIds ?? [])];
      let evidence: VerificationEvidenceViewModel | null = null;

      if (input.evidence) {
        evidence = (
          await recordVerificationEvidence(client, {
            actorRole: input.actorRole,
            kind: input.evidence.kind,
            label: input.evidence.label,
            uri: input.evidence.uri,
            artifactAssetId: input.evidence.artifactAssetId,
            checkProfileId: input.evidence.checkProfileId,
          })
        ).body;
        evidenceIds.push(evidence.id);
      }

      const uniqueEvidenceIds = Array.from(new Set(evidenceIds));
      await completeEvaluationRun(client, {
        actorRole: input.actorRole,
        runId: input.runId,
        status: input.status,
        evidenceIds: uniqueEvidenceIds,
      });
      const finalized = (
        await finalizeEvaluationRun(client, {
          actorRole: input.actorRole,
          runId: input.runId,
        })
      ).body;

      return {
        evidence,
        finalized,
        overview: await loadEvaluationWorkbenchOverview(client, {
          selectedSuiteId: input.suiteId,
          selectedRunId: input.runId,
        }),
      };
    },
    async createLearningCandidateFromEvaluation(input) {
      return (await createLearningCandidateFromEvaluationRequest(client, input)).body;
    },
  };
}

async function loadEvaluationWorkbenchOverview(
  client: EvaluationWorkbenchHttpClient,
  input?: {
    selectedSuiteId?: string | null;
    selectedRunId?: string | null;
  },
): Promise<EvaluationWorkbenchOverview> {
  const [
    checkProfilesResponse,
    releaseCheckProfilesResponse,
    sampleSetsResponse,
    suitesResponse,
  ] = await Promise.all([
    listVerificationCheckProfiles(client),
    listReleaseCheckProfiles(client),
    listEvaluationSampleSets(client),
    listEvaluationSuites(client),
  ]);

  const suites = suitesResponse.body;
  const selectedSuiteId = resolveSelectedId(
    suites.map((suite) => suite.id),
    input?.selectedSuiteId ?? null,
  );

  let runs: EvaluationRunViewModel[] = [];
  let selectedRunId: string | null = null;
  let runItems: EvaluationRunItemViewModel[] = [];

  if (selectedSuiteId != null) {
    runs = (await listEvaluationRunsBySuiteId(client, selectedSuiteId)).body;
    selectedRunId = resolveSelectedId(
      runs.map((run) => run.id),
      input?.selectedRunId ?? null,
    );

    if (selectedRunId != null) {
      runItems = (await listEvaluationRunItemsByRunId(client, selectedRunId)).body;
    }
  }

  return {
    checkProfiles: checkProfilesResponse.body,
    releaseCheckProfiles: releaseCheckProfilesResponse.body,
    sampleSets: sampleSetsResponse.body,
    suites,
    selectedSuiteId,
    runs,
    selectedRunId,
    runItems,
  };
}

function resolveSelectedId(
  candidateIds: readonly string[],
  preferredId: string | null,
): string | null {
  if (preferredId && candidateIds.includes(preferredId)) {
    return preferredId;
  }

  return candidateIds[0] ?? null;
}
