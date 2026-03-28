import type { SnapshotCapableRepository } from "../shared/write-transaction-manager.ts";
import type {
  EvaluationRunRecord,
  EvaluationSuiteRecord,
  ReleaseCheckProfileRecord,
  VerificationCheckProfileRecord,
  VerificationEvidenceRecord,
} from "./verification-ops-record.ts";
import type { VerificationOpsRepository } from "./verification-ops-repository.ts";

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
  };
}

function cloneVerificationEvidence(
  record: VerificationEvidenceRecord,
): VerificationEvidenceRecord {
  return {
    ...record,
  };
}

function cloneEvaluationRun(record: EvaluationRunRecord): EvaluationRunRecord {
  return {
    ...record,
    evidence_ids: [...record.evidence_ids],
  };
}

function compareById<T extends { id: string }>(left: T, right: T): number {
  return left.id.localeCompare(right.id);
}

export class InMemoryVerificationOpsRepository
  implements
    VerificationOpsRepository,
    SnapshotCapableRepository<{
      checkProfiles: Map<string, VerificationCheckProfileRecord>;
      releaseProfiles: Map<string, ReleaseCheckProfileRecord>;
      suites: Map<string, EvaluationSuiteRecord>;
      evidence: Map<string, VerificationEvidenceRecord>;
      runs: Map<string, EvaluationRunRecord>;
    }>
{
  private readonly checkProfiles = new Map<string, VerificationCheckProfileRecord>();
  private readonly releaseProfiles = new Map<string, ReleaseCheckProfileRecord>();
  private readonly suites = new Map<string, EvaluationSuiteRecord>();
  private readonly evidence = new Map<string, VerificationEvidenceRecord>();
  private readonly runs = new Map<string, EvaluationRunRecord>();

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

  snapshotState(): {
    checkProfiles: Map<string, VerificationCheckProfileRecord>;
    releaseProfiles: Map<string, ReleaseCheckProfileRecord>;
    suites: Map<string, EvaluationSuiteRecord>;
    evidence: Map<string, VerificationEvidenceRecord>;
    runs: Map<string, EvaluationRunRecord>;
  } {
    return {
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
    };
  }

  restoreState(snapshot: {
    checkProfiles: Map<string, VerificationCheckProfileRecord>;
    releaseProfiles: Map<string, ReleaseCheckProfileRecord>;
    suites: Map<string, EvaluationSuiteRecord>;
    evidence: Map<string, VerificationEvidenceRecord>;
    runs: Map<string, EvaluationRunRecord>;
  }): void {
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
  }
}
