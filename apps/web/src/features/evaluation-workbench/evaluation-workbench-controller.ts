import {
  activateEvaluationSuite,
  listEvaluationRunItemsByRunId,
  listEvaluationRunsBySuiteId,
  listEvaluationSampleSets,
  listEvaluationSuites,
  listReleaseCheckProfiles,
  listVerificationCheckProfiles,
} from "../verification-ops/index.ts";
import type { AuthRole } from "../auth/index.ts";
import type {
  EvaluationRunItemViewModel,
  EvaluationRunViewModel,
  EvaluationSampleSetViewModel,
  EvaluationSuiteViewModel,
  ReleaseCheckProfileViewModel,
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
