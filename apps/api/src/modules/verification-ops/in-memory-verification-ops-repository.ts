import type { SnapshotCapableRepository } from "../shared/write-transaction-manager.ts";
import type {
  EvaluationEvidencePackRecord,
  EvaluationPromotionRecommendationRecord,
  EvaluationRunRecord,
  EvaluationRunItemRecord,
  EvaluationSampleSetItemRecord,
  EvaluationSampleSetRecord,
  FrozenExperimentBindingRecord,
  GovernedExecutionEvaluationSourceRecord,
  EvaluationSuiteRecord,
  ReleaseCheckProfileRecord,
  VerificationCheckProfileRecord,
  VerificationEvidenceRecord,
} from "./verification-ops-record.ts";
import type { VerificationOpsRepository } from "./verification-ops-repository.ts";

function cloneSampleSetSourcePolicy(
  record: EvaluationSampleSetRecord["source_policy"],
): EvaluationSampleSetRecord["source_policy"] {
  return { ...record };
}

function cloneEvaluationSampleSet(
  record: EvaluationSampleSetRecord,
): EvaluationSampleSetRecord {
  return {
    ...record,
    manuscript_types: [...record.manuscript_types],
    risk_tags: record.risk_tags ? [...record.risk_tags] : undefined,
    source_policy: cloneSampleSetSourcePolicy(record.source_policy),
  };
}

function cloneEvaluationSampleSetItem(
  record: EvaluationSampleSetItemRecord,
): EvaluationSampleSetItemRecord {
  return {
    ...record,
    risk_tags: record.risk_tags ? [...record.risk_tags] : undefined,
  };
}

function cloneCheckProfile(
  record: VerificationCheckProfileRecord,
): VerificationCheckProfileRecord {
  return {
    ...record,
    tool_ids: record.tool_ids ? [...record.tool_ids] : undefined,
  };
}

function cloneReleaseCheckProfile(
  record: ReleaseCheckProfileRecord,
): ReleaseCheckProfileRecord {
  return {
    ...record,
    verification_check_profile_ids: [...record.verification_check_profile_ids],
  };
}

function cloneEvaluationSuite(
  record: EvaluationSuiteRecord,
): EvaluationSuiteRecord {
  return {
    ...record,
    verification_check_profile_ids: [...record.verification_check_profile_ids],
    module_scope: record.module_scope === "any" ? "any" : [...record.module_scope],
    hard_gate_policy: { ...record.hard_gate_policy },
    score_weights: { ...record.score_weights },
  };
}

function cloneVerificationEvidence(
  record: VerificationEvidenceRecord,
): VerificationEvidenceRecord {
  return {
    ...record,
  };
}

function cloneEvaluationEvidencePack(
  record: EvaluationEvidencePackRecord,
): EvaluationEvidencePackRecord {
  return {
    ...record,
  };
}

function cloneEvaluationPromotionRecommendation(
  record: EvaluationPromotionRecommendationRecord,
): EvaluationPromotionRecommendationRecord {
  return {
    ...record,
    learning_candidate_ids: record.learning_candidate_ids
      ? [...record.learning_candidate_ids]
      : undefined,
  };
}

function cloneFrozenExperimentBinding(
  record: FrozenExperimentBindingRecord,
): FrozenExperimentBindingRecord {
  return {
    ...record,
    skill_package_ids: [...record.skill_package_ids],
  };
}

function cloneGovernedExecutionEvaluationSource(
  record: GovernedExecutionEvaluationSourceRecord,
): GovernedExecutionEvaluationSourceRecord {
  return {
    ...record,
  };
}

function cloneEvaluationRun(record: EvaluationRunRecord): EvaluationRunRecord {
  return {
    ...record,
    baseline_binding: record.baseline_binding
      ? cloneFrozenExperimentBinding(record.baseline_binding)
      : undefined,
    candidate_binding: record.candidate_binding
      ? cloneFrozenExperimentBinding(record.candidate_binding)
      : undefined,
    governed_source: record.governed_source
      ? cloneGovernedExecutionEvaluationSource(record.governed_source)
      : undefined,
    evidence_ids: [...record.evidence_ids],
  };
}

function cloneEvaluationRunItem(
  record: EvaluationRunItemRecord,
): EvaluationRunItemRecord {
  return {
    ...record,
  };
}

function compareById<T extends { id: string }>(left: T, right: T): number {
  return left.id.localeCompare(right.id);
}

function compareCreatedAtDesc(left: string, right: string): number {
  return right.localeCompare(left);
}

export class InMemoryVerificationOpsRepository
  implements
    VerificationOpsRepository,
    SnapshotCapableRepository<{
      sampleSets: Map<string, EvaluationSampleSetRecord>;
      sampleSetItems: Map<string, EvaluationSampleSetItemRecord>;
      checkProfiles: Map<string, VerificationCheckProfileRecord>;
      releaseProfiles: Map<string, ReleaseCheckProfileRecord>;
      suites: Map<string, EvaluationSuiteRecord>;
      evidence: Map<string, VerificationEvidenceRecord>;
      runs: Map<string, EvaluationRunRecord>;
      runItems: Map<string, EvaluationRunItemRecord>;
      evidencePacks: Map<string, EvaluationEvidencePackRecord>;
      recommendations: Map<string, EvaluationPromotionRecommendationRecord>;
    }>
{
  private readonly sampleSets = new Map<string, EvaluationSampleSetRecord>();
  private readonly sampleSetItems = new Map<string, EvaluationSampleSetItemRecord>();
  private readonly checkProfiles = new Map<string, VerificationCheckProfileRecord>();
  private readonly releaseProfiles = new Map<string, ReleaseCheckProfileRecord>();
  private readonly suites = new Map<string, EvaluationSuiteRecord>();
  private readonly evidence = new Map<string, VerificationEvidenceRecord>();
  private readonly runs = new Map<string, EvaluationRunRecord>();
  private readonly runItems = new Map<string, EvaluationRunItemRecord>();
  private readonly evidencePacks = new Map<string, EvaluationEvidencePackRecord>();
  private readonly recommendations =
    new Map<string, EvaluationPromotionRecommendationRecord>();

  async saveEvaluationSampleSet(record: EvaluationSampleSetRecord): Promise<void> {
    this.sampleSets.set(record.id, cloneEvaluationSampleSet(record));
  }

  async findEvaluationSampleSetById(
    id: string,
  ): Promise<EvaluationSampleSetRecord | undefined> {
    const record = this.sampleSets.get(id);
    return record ? cloneEvaluationSampleSet(record) : undefined;
  }

  async listEvaluationSampleSets(): Promise<EvaluationSampleSetRecord[]> {
    return [...this.sampleSets.values()]
      .sort(compareById)
      .map(cloneEvaluationSampleSet);
  }

  async saveEvaluationSampleSetItem(
    record: EvaluationSampleSetItemRecord,
  ): Promise<void> {
    this.sampleSetItems.set(record.id, cloneEvaluationSampleSetItem(record));
  }

  async listEvaluationSampleSetItemsBySampleSetId(
    sampleSetId: string,
  ): Promise<EvaluationSampleSetItemRecord[]> {
    return [...this.sampleSetItems.values()]
      .filter((record) => record.sample_set_id === sampleSetId)
      .sort(compareById)
      .map(cloneEvaluationSampleSetItem);
  }

  async saveVerificationCheckProfile(
    record: VerificationCheckProfileRecord,
  ): Promise<void> {
    this.checkProfiles.set(record.id, cloneCheckProfile(record));
  }

  async findVerificationCheckProfileById(
    id: string,
  ): Promise<VerificationCheckProfileRecord | undefined> {
    const record = this.checkProfiles.get(id);
    return record ? cloneCheckProfile(record) : undefined;
  }

  async listVerificationCheckProfiles(): Promise<VerificationCheckProfileRecord[]> {
    return [...this.checkProfiles.values()].sort(compareById).map(cloneCheckProfile);
  }

  async saveReleaseCheckProfile(record: ReleaseCheckProfileRecord): Promise<void> {
    this.releaseProfiles.set(record.id, cloneReleaseCheckProfile(record));
  }

  async findReleaseCheckProfileById(
    id: string,
  ): Promise<ReleaseCheckProfileRecord | undefined> {
    const record = this.releaseProfiles.get(id);
    return record ? cloneReleaseCheckProfile(record) : undefined;
  }

  async listReleaseCheckProfiles(): Promise<ReleaseCheckProfileRecord[]> {
    return [...this.releaseProfiles.values()]
      .sort(compareById)
      .map(cloneReleaseCheckProfile);
  }

  async saveEvaluationSuite(record: EvaluationSuiteRecord): Promise<void> {
    this.suites.set(record.id, cloneEvaluationSuite(record));
  }

  async findEvaluationSuiteById(
    id: string,
  ): Promise<EvaluationSuiteRecord | undefined> {
    const record = this.suites.get(id);
    return record ? cloneEvaluationSuite(record) : undefined;
  }

  async listEvaluationSuites(): Promise<EvaluationSuiteRecord[]> {
    return [...this.suites.values()].sort(compareById).map(cloneEvaluationSuite);
  }

  async saveVerificationEvidence(record: VerificationEvidenceRecord): Promise<void> {
    this.evidence.set(record.id, cloneVerificationEvidence(record));
  }

  async findVerificationEvidenceById(
    id: string,
  ): Promise<VerificationEvidenceRecord | undefined> {
    const record = this.evidence.get(id);
    return record ? cloneVerificationEvidence(record) : undefined;
  }

  async listVerificationEvidence(): Promise<VerificationEvidenceRecord[]> {
    return [...this.evidence.values()]
      .sort(compareById)
      .map(cloneVerificationEvidence);
  }

  async saveEvaluationRun(record: EvaluationRunRecord): Promise<void> {
    this.runs.set(record.id, cloneEvaluationRun(record));
  }

  async findEvaluationRunById(id: string): Promise<EvaluationRunRecord | undefined> {
    const record = this.runs.get(id);
    return record ? cloneEvaluationRun(record) : undefined;
  }

  async listEvaluationRunsBySuiteId(suiteId: string): Promise<EvaluationRunRecord[]> {
    return [...this.runs.values()]
      .filter((record) => record.suite_id === suiteId)
      .sort(compareById)
      .map(cloneEvaluationRun);
  }

  async saveEvaluationRunItem(record: EvaluationRunItemRecord): Promise<void> {
    this.runItems.set(record.id, cloneEvaluationRunItem(record));
  }

  async findEvaluationRunItemById(
    id: string,
  ): Promise<EvaluationRunItemRecord | undefined> {
    const record = this.runItems.get(id);
    return record ? cloneEvaluationRunItem(record) : undefined;
  }

  async listEvaluationRunItemsByRunId(
    runId: string,
  ): Promise<EvaluationRunItemRecord[]> {
    return [...this.runItems.values()]
      .filter((record) => record.evaluation_run_id === runId)
      .sort(compareById)
      .map(cloneEvaluationRunItem);
  }

  async saveEvaluationEvidencePack(
    record: EvaluationEvidencePackRecord,
  ): Promise<void> {
    this.evidencePacks.set(record.id, cloneEvaluationEvidencePack(record));
  }

  async findEvaluationEvidencePackById(
    id: string,
  ): Promise<EvaluationEvidencePackRecord | undefined> {
    const record = this.evidencePacks.get(id);
    return record ? cloneEvaluationEvidencePack(record) : undefined;
  }

  async findLatestEvaluationEvidencePackByRunId(
    runId: string,
  ): Promise<EvaluationEvidencePackRecord | undefined> {
    const record = [...this.evidencePacks.values()]
      .filter((candidate) => candidate.experiment_run_id === runId)
      .sort(
        (left, right) =>
          compareCreatedAtDesc(left.created_at, right.created_at) ||
          compareById(right, left),
      )[0];
    return record ? cloneEvaluationEvidencePack(record) : undefined;
  }

  async saveEvaluationPromotionRecommendation(
    record: EvaluationPromotionRecommendationRecord,
  ): Promise<void> {
    this.recommendations.set(
      record.id,
      cloneEvaluationPromotionRecommendation(record),
    );
  }

  async findLatestEvaluationPromotionRecommendationByRunId(
    runId: string,
  ): Promise<EvaluationPromotionRecommendationRecord | undefined> {
    const record = [...this.recommendations.values()]
      .filter((candidate) => candidate.experiment_run_id === runId)
      .sort(
        (left, right) =>
          compareCreatedAtDesc(left.created_at, right.created_at) ||
          compareById(right, left),
      )[0];
    return record ? cloneEvaluationPromotionRecommendation(record) : undefined;
  }

  snapshotState(): {
    sampleSets: Map<string, EvaluationSampleSetRecord>;
    sampleSetItems: Map<string, EvaluationSampleSetItemRecord>;
    checkProfiles: Map<string, VerificationCheckProfileRecord>;
    releaseProfiles: Map<string, ReleaseCheckProfileRecord>;
    suites: Map<string, EvaluationSuiteRecord>;
    evidence: Map<string, VerificationEvidenceRecord>;
    runs: Map<string, EvaluationRunRecord>;
    runItems: Map<string, EvaluationRunItemRecord>;
    evidencePacks: Map<string, EvaluationEvidencePackRecord>;
    recommendations: Map<string, EvaluationPromotionRecommendationRecord>;
  } {
    return {
      sampleSets: new Map(
        [...this.sampleSets.entries()].map(([id, record]) => [
          id,
          cloneEvaluationSampleSet(record),
        ]),
      ),
      sampleSetItems: new Map(
        [...this.sampleSetItems.entries()].map(([id, record]) => [
          id,
          cloneEvaluationSampleSetItem(record),
        ]),
      ),
      checkProfiles: new Map(
        [...this.checkProfiles.entries()].map(([id, record]) => [
          id,
          cloneCheckProfile(record),
        ]),
      ),
      releaseProfiles: new Map(
        [...this.releaseProfiles.entries()].map(([id, record]) => [
          id,
          cloneReleaseCheckProfile(record),
        ]),
      ),
      suites: new Map(
        [...this.suites.entries()].map(([id, record]) => [
          id,
          cloneEvaluationSuite(record),
        ]),
      ),
      evidence: new Map(
        [...this.evidence.entries()].map(([id, record]) => [
          id,
          cloneVerificationEvidence(record),
        ]),
      ),
      runs: new Map(
        [...this.runs.entries()].map(([id, record]) => [id, cloneEvaluationRun(record)]),
      ),
      runItems: new Map(
        [...this.runItems.entries()].map(([id, record]) => [
          id,
          cloneEvaluationRunItem(record),
        ]),
      ),
      evidencePacks: new Map(
        [...this.evidencePacks.entries()].map(([id, record]) => [
          id,
          cloneEvaluationEvidencePack(record),
        ]),
      ),
      recommendations: new Map(
        [...this.recommendations.entries()].map(([id, record]) => [
          id,
          cloneEvaluationPromotionRecommendation(record),
        ]),
      ),
    };
  }

  restoreState(snapshot: {
    sampleSets: Map<string, EvaluationSampleSetRecord>;
    sampleSetItems: Map<string, EvaluationSampleSetItemRecord>;
    checkProfiles: Map<string, VerificationCheckProfileRecord>;
    releaseProfiles: Map<string, ReleaseCheckProfileRecord>;
    suites: Map<string, EvaluationSuiteRecord>;
    evidence: Map<string, VerificationEvidenceRecord>;
    runs: Map<string, EvaluationRunRecord>;
    runItems: Map<string, EvaluationRunItemRecord>;
    evidencePacks: Map<string, EvaluationEvidencePackRecord>;
    recommendations: Map<string, EvaluationPromotionRecommendationRecord>;
  }): void {
    this.sampleSets.clear();
    for (const [id, record] of snapshot.sampleSets.entries()) {
      this.sampleSets.set(id, cloneEvaluationSampleSet(record));
    }

    this.sampleSetItems.clear();
    for (const [id, record] of snapshot.sampleSetItems.entries()) {
      this.sampleSetItems.set(id, cloneEvaluationSampleSetItem(record));
    }

    this.checkProfiles.clear();
    for (const [id, record] of snapshot.checkProfiles.entries()) {
      this.checkProfiles.set(id, cloneCheckProfile(record));
    }

    this.releaseProfiles.clear();
    for (const [id, record] of snapshot.releaseProfiles.entries()) {
      this.releaseProfiles.set(id, cloneReleaseCheckProfile(record));
    }

    this.suites.clear();
    for (const [id, record] of snapshot.suites.entries()) {
      this.suites.set(id, cloneEvaluationSuite(record));
    }

    this.evidence.clear();
    for (const [id, record] of snapshot.evidence.entries()) {
      this.evidence.set(id, cloneVerificationEvidence(record));
    }

    this.runs.clear();
    for (const [id, record] of snapshot.runs.entries()) {
      this.runs.set(id, cloneEvaluationRun(record));
    }

    this.runItems.clear();
    for (const [id, record] of snapshot.runItems.entries()) {
      this.runItems.set(id, cloneEvaluationRunItem(record));
    }

    this.evidencePacks.clear();
    for (const [id, record] of snapshot.evidencePacks.entries()) {
      this.evidencePacks.set(id, cloneEvaluationEvidencePack(record));
    }

    this.recommendations.clear();
    for (const [id, record] of snapshot.recommendations.entries()) {
      this.recommendations.set(
        id,
        cloneEvaluationPromotionRecommendation(record),
      );
    }
  }
}
