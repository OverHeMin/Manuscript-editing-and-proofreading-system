import {
  activateEvaluationSuite,
  completeEvaluationRun,
  createEvaluationRun,
  createLearningCandidateFromEvaluation as createLearningCandidateFromEvaluationRequest,
  finalizeEvaluationRun,
  listEvaluationSuiteFinalizedResults,
  listEvaluationRunEvidenceByRunId,
  listEvaluationRunItemsByRunId,
  listEvaluationSampleSetItems,
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
  EvaluationSampleSetItemViewModel,
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
  sampleSetItems: EvaluationSampleSetItemViewModel[];
  runItems: EvaluationRunItemViewModel[];
  selectedRunEvidence: VerificationEvidenceViewModel[];
  previousRunEvidence: VerificationEvidenceViewModel[];
  selectedRunFinalization: FinalizeEvaluationRunResultViewModel | null;
  finalizedRunHistory: EvaluationWorkbenchFinalizedRunHistoryEntry[];
  manuscriptContext: EvaluationWorkbenchManuscriptContext | null;
}

export interface EvaluationWorkbenchFinalizedRunHistoryEntry {
  run: EvaluationRunViewModel;
  finalized: FinalizeEvaluationRunResultViewModel;
}

export interface EvaluationWorkbenchManuscriptContext {
  manuscriptId: string;
  matchedSuiteId: string | null;
  matchedRunId: string | null;
  matchedHistoryRunIds: string[];
}

interface ResolvedEvaluationManuscriptContext {
  manuscriptId: string;
  matchedSuiteId: string | null;
  matchedRunId: string | null;
  matchedRunIdsBySuiteId: Record<string, string[]>;
}

export interface EvaluationWorkbenchController {
  loadOverview(input?: {
    selectedSuiteId?: string | null;
    selectedRunId?: string | null;
    manuscriptId?: string | null;
  }): Promise<EvaluationWorkbenchOverview>;
  activateSuiteAndReload(input: {
    suiteId: string;
    actorRole: AuthRole;
    manuscriptId?: string | null;
  }): Promise<EvaluationWorkbenchOverview>;
  createRunAndReload(
    input: CreateEvaluationRunInput & {
      manuscriptId?: string | null;
    },
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
  manuscriptId?: string | null;
}

export interface EvaluationWorkbenchRecordRunItemResultResult {
  overview: EvaluationWorkbenchOverview;
  runItem: EvaluationRunItemViewModel;
}

export interface EvaluationWorkbenchCompleteRunInput {
  actorRole: AuthRole;
  suiteId: string;
  runId: string;
  manuscriptId?: string | null;
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
        manuscriptId: input.manuscriptId,
      });
    },
    async createRunAndReload(input) {
      const run = (await createEvaluationRun(client, input)).body;

      return {
        run,
        overview: await loadEvaluationWorkbenchOverview(client, {
          selectedSuiteId: input.suiteId,
          selectedRunId: run.id,
          manuscriptId: input.manuscriptId,
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
          manuscriptId: input.manuscriptId,
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
          manuscriptId: input.manuscriptId,
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
    manuscriptId?: string | null;
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
  const manuscriptId = input?.manuscriptId?.trim() ?? "";
  let manuscriptContext: EvaluationWorkbenchManuscriptContext | null = null;
  let resolvedManuscriptContext: ResolvedEvaluationManuscriptContext | null = null;
  let preferredSuiteId = input?.selectedSuiteId ?? null;
  let preferredRunId = input?.selectedRunId ?? null;

  if (manuscriptId.length > 0) {
    resolvedManuscriptContext = await resolveEvaluationManuscriptContext(
      client,
      suites,
      manuscriptId,
    );
    preferredSuiteId ??= resolvedManuscriptContext.matchedSuiteId;
    preferredRunId ??= resolvedManuscriptContext.matchedRunId;
  }

  const selectedSuiteId = resolveSelectedId(
    suites.map((suite) => suite.id),
    preferredSuiteId,
  );

  let runs: EvaluationRunViewModel[] = [];
  let selectedRunId: string | null = null;
  let sampleSetItems: EvaluationSampleSetItemViewModel[] = [];
  let runItems: EvaluationRunItemViewModel[] = [];
  let selectedRunEvidence: VerificationEvidenceViewModel[] = [];
  let previousRunEvidence: VerificationEvidenceViewModel[] = [];
  let selectedRunFinalization: FinalizeEvaluationRunResultViewModel | null = null;
  let finalizedRunHistory: EvaluationWorkbenchFinalizedRunHistoryEntry[] = [];

  if (selectedSuiteId != null) {
    runs = (await listEvaluationRunsBySuiteId(client, selectedSuiteId)).body;
    selectedRunId = resolveSelectedId(
      runs.map((run) => run.id),
      preferredRunId,
    );

    if (selectedRunId != null) {
      const selectedRun = runs.find((run) => run.id === selectedRunId) ?? null;
      const [nextSampleSetItems, nextRunItems, nextRunEvidence] = await Promise.all([
        selectedRun?.sample_set_id
          ? listEvaluationSampleSetItems(client, selectedRun.sample_set_id).then(
              (response) => response.body,
            )
          : Promise.resolve([]),
        listEvaluationRunItemsByRunId(client, selectedRunId).then((response) => response.body),
        selectedRun != null && selectedRun.evidence_ids.length > 0
          ? listEvaluationRunEvidenceByRunId(client, selectedRunId).then(
              (response) => response.body,
            )
          : Promise.resolve([]),
      ]);
      sampleSetItems = nextSampleSetItems;
      runItems = nextRunItems;
      selectedRunEvidence = nextRunEvidence;
    }

    if (runs.length > 0) {
      finalizedRunHistory = (
        await listEvaluationSuiteFinalizedResults(client, selectedSuiteId)
      ).body.map((finalized) => ({
        run: finalized.run,
        finalized,
      }))
        .sort(compareFinalizedRunHistory);
    }

    const previousRunId =
      selectedRunId == null
        ? null
        : findPreviousFinalizedRunHistoryRunId(finalizedRunHistory, selectedRunId);

    if (previousRunId != null) {
      const previousRun = runs.find((run) => run.id === previousRunId) ?? null;
      if (previousRun != null && previousRun.evidence_ids.length > 0) {
        previousRunEvidence = (
          await listEvaluationRunEvidenceByRunId(client, previousRunId)
        ).body;
      }
    }

    selectedRunFinalization =
      finalizedRunHistory.find((entry) => entry.run.id === selectedRunId)?.finalized ?? null;
  }

  if (resolvedManuscriptContext) {
    manuscriptContext = {
      manuscriptId: resolvedManuscriptContext.manuscriptId,
      matchedSuiteId: resolvedManuscriptContext.matchedSuiteId,
      matchedRunId: resolvedManuscriptContext.matchedRunId,
      matchedHistoryRunIds:
        selectedSuiteId == null
          ? []
          : resolvedManuscriptContext.matchedRunIdsBySuiteId[selectedSuiteId] ?? [],
    };
  }

  return {
    checkProfiles: checkProfilesResponse.body,
    releaseCheckProfiles: releaseCheckProfilesResponse.body,
    sampleSets: sampleSetsResponse.body,
    suites,
    selectedSuiteId,
    runs,
    selectedRunId,
    sampleSetItems,
    runItems,
    selectedRunEvidence,
    previousRunEvidence,
    selectedRunFinalization,
    finalizedRunHistory,
    manuscriptContext,
  };
}

async function resolveEvaluationManuscriptContext(
  client: EvaluationWorkbenchHttpClient,
  suites: EvaluationSuiteViewModel[],
  manuscriptId: string,
): Promise<ResolvedEvaluationManuscriptContext> {
  type SampleSetItemsEntry = readonly [string, EvaluationSampleSetItemViewModel[]];
  const suiteRuns = await Promise.all(
    suites.map(async (suite) => ({
      suiteId: suite.id,
      runs: (await listEvaluationRunsBySuiteId(client, suite.id)).body,
    })),
  );

  const sampleSetIds: string[] = Array.from(
    new Set(
      suiteRuns.flatMap((entry) =>
        entry.runs
          .flatMap((run) =>
            typeof run.sample_set_id === "string" && run.sample_set_id.trim().length > 0
              ? [run.sample_set_id]
              : [],
          ),
      ),
    ),
  );
  const sampleSetItemsEntries: SampleSetItemsEntry[] = await Promise.all(
    sampleSetIds.map(async (sampleSetId): Promise<SampleSetItemsEntry> => [
      sampleSetId,
      (await listEvaluationSampleSetItems(client, sampleSetId)).body,
    ]),
  );
  const sampleSetItemsById = new Map<string, EvaluationSampleSetItemViewModel[]>(
    await Promise.all(
      sampleSetItemsEntries,
    ),
  );

  const matchingRuns = suiteRuns.flatMap((entry) =>
    entry.runs
      .filter((run) =>
        doesRunMatchManuscript({
          run,
          manuscriptId,
          sampleSetItems:
            run.sample_set_id != null ? sampleSetItemsById.get(run.sample_set_id) : undefined,
        }),
      )
      .map((run) => ({
        suiteId: entry.suiteId,
        run,
      })),
  );
  const latestMatch =
    matchingRuns.sort((left, right) => compareRunRecency(right.run, left.run))[0] ?? null;
  const matchedRunIdsBySuiteId = matchingRuns.reduce<Record<string, string[]>>(
    (summary, entry) => {
      if (!summary[entry.suiteId]) {
        summary[entry.suiteId] = [];
      }
      summary[entry.suiteId]?.push(entry.run.id);
      return summary;
    },
    {},
  );

  return {
    manuscriptId,
    matchedSuiteId: latestMatch?.suiteId ?? null,
    matchedRunId: latestMatch?.run.id ?? null,
    matchedRunIdsBySuiteId,
  };
}

function doesRunMatchManuscript(input: {
  run: EvaluationRunViewModel;
  manuscriptId: string;
  sampleSetItems?: EvaluationSampleSetItemViewModel[];
}) {
  if (input.run.governed_source?.manuscript_id === input.manuscriptId) {
    return true;
  }

  return (
    input.sampleSetItems?.some((item) => item.manuscript_id === input.manuscriptId) ?? false
  );
}

function compareFinalizedRunHistory(
  left: EvaluationWorkbenchFinalizedRunHistoryEntry,
  right: EvaluationWorkbenchFinalizedRunHistoryEntry,
) {
  return compareRunRecency(right.run, left.run);
}

function compareRunRecency(
  left: EvaluationRunViewModel,
  right: EvaluationRunViewModel,
) {
  const leftTimestamp = left.finished_at ?? left.started_at;
  const rightTimestamp = right.finished_at ?? right.started_at;

  if (leftTimestamp !== rightTimestamp) {
    return leftTimestamp.localeCompare(rightTimestamp);
  }

  return left.id.localeCompare(right.id);
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

function findPreviousFinalizedRunHistoryRunId(
  entries: EvaluationWorkbenchFinalizedRunHistoryEntry[],
  selectedRunId: string,
) {
  const selectedIndex = entries.findIndex((entry) => entry.run.id === selectedRunId);
  if (selectedIndex === -1) return null;
  return entries.slice(selectedIndex + 1)[0]?.run.id ?? null;
}
