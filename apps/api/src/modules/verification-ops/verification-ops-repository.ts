import type {
  EvaluationRunRecord,
  EvaluationRunItemRecord,
  EvaluationSampleSetItemRecord,
  EvaluationSampleSetRecord,
  EvaluationSuiteRecord,
  ReleaseCheckProfileRecord,
  VerificationCheckProfileRecord,
  VerificationEvidenceRecord,
} from "./verification-ops-record.ts";

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
  listEvaluationRunsBySuiteId(suiteId: string): Promise<EvaluationRunRecord[]>;

  saveEvaluationRunItem(record: EvaluationRunItemRecord): Promise<void>;
  findEvaluationRunItemById(id: string): Promise<EvaluationRunItemRecord | undefined>;
  listEvaluationRunItemsByRunId(runId: string): Promise<EvaluationRunItemRecord[]>;
}
