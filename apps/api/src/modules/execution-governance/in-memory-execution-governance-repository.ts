import type { SnapshotCapableRepository } from "../shared/write-transaction-manager.ts";
import type {
  ExecutionGovernanceRepository,
} from "./execution-governance-repository.ts";
import type {
  KnowledgeBindingRuleRecord,
  ModuleExecutionProfileRecord,
} from "./execution-governance-record.ts";

function cloneProfileRecord(
  record: ModuleExecutionProfileRecord,
): ModuleExecutionProfileRecord {
  return {
    ...record,
    skill_package_ids: [...record.skill_package_ids],
  };
}

function cloneKnowledgeBindingRuleRecord(
  record: KnowledgeBindingRuleRecord,
): KnowledgeBindingRuleRecord {
  return {
    ...record,
    manuscript_types:
      record.manuscript_types === "any"
        ? "any"
        : [...record.manuscript_types],
    template_family_ids: record.template_family_ids
      ? [...record.template_family_ids]
      : undefined,
    module_template_ids: record.module_template_ids
      ? [...record.module_template_ids]
      : undefined,
    sections: record.sections ? [...record.sections] : undefined,
    risk_tags: record.risk_tags ? [...record.risk_tags] : undefined,
  };
}

function compareProfiles(
  left: ModuleExecutionProfileRecord,
  right: ModuleExecutionProfileRecord,
): number {
  if (left.module !== right.module) {
    return left.module.localeCompare(right.module);
  }

  if (left.manuscript_type !== right.manuscript_type) {
    return left.manuscript_type.localeCompare(right.manuscript_type);
  }

  if (left.template_family_id !== right.template_family_id) {
    return left.template_family_id.localeCompare(right.template_family_id);
  }

  if (left.version !== right.version) {
    return left.version - right.version;
  }

  return left.id.localeCompare(right.id);
}

function compareKnowledgeBindingRules(
  left: KnowledgeBindingRuleRecord,
  right: KnowledgeBindingRuleRecord,
): number {
  if (left.priority !== right.priority) {
    return right.priority - left.priority;
  }

  if (left.module !== right.module) {
    return left.module.localeCompare(right.module);
  }

  return left.id.localeCompare(right.id);
}

function versionKey(
  module: ModuleExecutionProfileRecord["module"],
  manuscriptType: ModuleExecutionProfileRecord["manuscript_type"],
  templateFamilyId: ModuleExecutionProfileRecord["template_family_id"],
): string {
  return `${module}:${manuscriptType}:${templateFamilyId}`;
}

export class InMemoryExecutionGovernanceRepository
  implements
    ExecutionGovernanceRepository,
    SnapshotCapableRepository<{
      profiles: Map<string, ModuleExecutionProfileRecord>;
      rules: Map<string, KnowledgeBindingRuleRecord>;
      reservedProfileVersions: Map<string, number>;
    }>
{
  private readonly profiles = new Map<string, ModuleExecutionProfileRecord>();
  private readonly rules = new Map<string, KnowledgeBindingRuleRecord>();
  private readonly reservedProfileVersions = new Map<string, number>();

  async saveProfile(record: ModuleExecutionProfileRecord): Promise<void> {
    this.profiles.set(record.id, cloneProfileRecord(record));
    const key = versionKey(
      record.module,
      record.manuscript_type,
      record.template_family_id,
    );
    const currentReserved = this.reservedProfileVersions.get(key) ?? 0;
    if (record.version > currentReserved) {
      this.reservedProfileVersions.set(key, record.version);
    }
  }

  async findProfileById(
    id: string,
  ): Promise<ModuleExecutionProfileRecord | undefined> {
    const record = this.profiles.get(id);
    return record ? cloneProfileRecord(record) : undefined;
  }

  async listProfiles(): Promise<ModuleExecutionProfileRecord[]> {
    return [...this.profiles.values()]
      .sort(compareProfiles)
      .map(cloneProfileRecord);
  }

  async reserveNextProfileVersion(
    module: ModuleExecutionProfileRecord["module"],
    manuscriptType: ModuleExecutionProfileRecord["manuscript_type"],
    templateFamilyId: ModuleExecutionProfileRecord["template_family_id"],
  ): Promise<number> {
    const key = versionKey(module, manuscriptType, templateFamilyId);
    const currentReserved = this.reservedProfileVersions.get(key);

    if (currentReserved !== undefined) {
      const nextVersion = currentReserved + 1;
      this.reservedProfileVersions.set(key, nextVersion);
      return nextVersion;
    }

    const highestStoredVersion = (await this.listProfiles())
      .filter(
        (record) =>
          record.module === module &&
          record.manuscript_type === manuscriptType &&
          record.template_family_id === templateFamilyId,
      )
      .reduce(
        (currentHighest, record) => Math.max(currentHighest, record.version),
        0,
      );
    const nextVersion = highestStoredVersion + 1;
    this.reservedProfileVersions.set(key, nextVersion);
    return nextVersion;
  }

  async saveKnowledgeBindingRule(
    record: KnowledgeBindingRuleRecord,
  ): Promise<void> {
    this.rules.set(record.id, cloneKnowledgeBindingRuleRecord(record));
  }

  async findKnowledgeBindingRuleById(
    id: string,
  ): Promise<KnowledgeBindingRuleRecord | undefined> {
    const record = this.rules.get(id);
    return record ? cloneKnowledgeBindingRuleRecord(record) : undefined;
  }

  async listKnowledgeBindingRules(): Promise<KnowledgeBindingRuleRecord[]> {
    return [...this.rules.values()]
      .sort(compareKnowledgeBindingRules)
      .map(cloneKnowledgeBindingRuleRecord);
  }

  snapshotState(): {
    profiles: Map<string, ModuleExecutionProfileRecord>;
    rules: Map<string, KnowledgeBindingRuleRecord>;
    reservedProfileVersions: Map<string, number>;
  } {
    return {
      profiles: new Map(
        [...this.profiles.entries()].map(([id, record]) => [
          id,
          cloneProfileRecord(record),
        ]),
      ),
      rules: new Map(
        [...this.rules.entries()].map(([id, record]) => [
          id,
          cloneKnowledgeBindingRuleRecord(record),
        ]),
      ),
      reservedProfileVersions: new Map(this.reservedProfileVersions.entries()),
    };
  }

  restoreState(snapshot: {
    profiles: Map<string, ModuleExecutionProfileRecord>;
    rules: Map<string, KnowledgeBindingRuleRecord>;
    reservedProfileVersions: Map<string, number>;
  }): void {
    this.profiles.clear();
    for (const [id, record] of snapshot.profiles.entries()) {
      this.profiles.set(id, cloneProfileRecord(record));
    }

    this.rules.clear();
    for (const [id, record] of snapshot.rules.entries()) {
      this.rules.set(id, cloneKnowledgeBindingRuleRecord(record));
    }

    this.reservedProfileVersions.clear();
    for (const [key, version] of snapshot.reservedProfileVersions.entries()) {
      this.reservedProfileVersions.set(key, version);
    }
  }
}
