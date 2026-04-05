import type {
  EvaluationEvidencePackRecord,
  EvaluationPromotionRecommendationRecord,
  GovernedExecutionEvaluationSourceRecord,
  EvaluationRunRecord,
  EvaluationRunItemRecord,
  EvaluationSampleSetItemRecord,
  EvaluationSampleSetRecord,
  EvaluationSuiteRecord,
  ReleaseCheckProfileRecord,
  VerificationCheckProfileRecord,
  VerificationEvidenceRecord,
} from "./verification-ops-record.ts";

export type EvaluationSuiteFinalizationHistoryWindowPreset =
  | "latest_10"
  | "last_7_days"
  | "last_30_days"
  | "all_suite";

export interface EvaluationSuiteFinalizationRecord {
  run: EvaluationRunRecord;
  evidence_pack: EvaluationEvidencePackRecord;
  recommendation: EvaluationPromotionRecommendationRecord;
  evidence: VerificationEvidenceRecord[];
}

export interface VerificationOpsRepository {
  saveEvaluationSampleSet(record: EvaluationSampleSetRecord): Promise<void>;
  findEvaluationSampleSetById(
    id: string,
  ): Promise<EvaluationSampleSetRecord | undefined>;
  listEvaluationSampleSets(): Promise<EvaluationSampleSetRecord[]>;

  saveEvaluationSampleSetItem(record: EvaluationSampleSetItemRecord): Promise<void>;
  listEvaluationSampleSetItemsBySampleSetId(
    sampleSetId: string,
  ): Promise<EvaluationSampleSetItemRecord[]>;

  saveVerificationCheckProfile(record: VerificationCheckProfileRecord): Promise<void>;
  findVerificationCheckProfileById(
    id: string,
  ): Promise<VerificationCheckProfileRecord | undefined>;
  listVerificationCheckProfiles(): Promise<VerificationCheckProfileRecord[]>;

  saveReleaseCheckProfile(record: ReleaseCheckProfileRecord): Promise<void>;
  findReleaseCheckProfileById(
    id: string,
  ): Promise<ReleaseCheckProfileRecord | undefined>;
  listReleaseCheckProfiles(): Promise<ReleaseCheckProfileRecord[]>;

  saveEvaluationSuite(record: EvaluationSuiteRecord): Promise<void>;
  findEvaluationSuiteById(id: string): Promise<EvaluationSuiteRecord | undefined>;
  listEvaluationSuites(): Promise<EvaluationSuiteRecord[]>;

  saveVerificationEvidence(record: VerificationEvidenceRecord): Promise<void>;
  findVerificationEvidenceById(
    id: string,
  ): Promise<VerificationEvidenceRecord | undefined>;
  listVerificationEvidence(): Promise<VerificationEvidenceRecord[]>;

  saveEvaluationRun(record: EvaluationRunRecord): Promise<void>;
  findEvaluationRunById(id: string): Promise<EvaluationRunRecord | undefined>;
  findGovernedEvaluationRun(input: {
    suiteId: string;
    governedSource: GovernedExecutionEvaluationSourceRecord;
    releaseCheckProfileId?: string;
  }): Promise<EvaluationRunRecord | undefined>;
  listEvaluationRunsBySuiteId(suiteId: string): Promise<EvaluationRunRecord[]>;
  listEvaluationSuiteFinalizations(
    suiteId: string,
    input?: {
      historyWindowPreset?: EvaluationSuiteFinalizationHistoryWindowPreset;
    },
  ): Promise<EvaluationSuiteFinalizationRecord[]>;

  saveEvaluationRunItem(record: EvaluationRunItemRecord): Promise<void>;
  findEvaluationRunItemById(id: string): Promise<EvaluationRunItemRecord | undefined>;
  listEvaluationRunItemsByRunId(runId: string): Promise<EvaluationRunItemRecord[]>;

  saveEvaluationEvidencePack(record: EvaluationEvidencePackRecord): Promise<void>;
  findEvaluationEvidencePackById(
    id: string,
  ): Promise<EvaluationEvidencePackRecord | undefined>;
  findLatestEvaluationEvidencePackByRunId(
    runId: string,
  ): Promise<EvaluationEvidencePackRecord | undefined>;
  saveEvaluationPromotionRecommendation(
    record: EvaluationPromotionRecommendationRecord,
  ): Promise<void>;
  findLatestEvaluationPromotionRecommendationByRunId(
    runId: string,
  ): Promise<EvaluationPromotionRecommendationRecord | undefined>;
}
