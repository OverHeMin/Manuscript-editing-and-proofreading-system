import type { SnapshotCapableRepository } from "../shared/write-transaction-manager.ts";
import type {
  HarnessDatasetPublicationRecord,
  HarnessGoldSetFamilyRecord,
  HarnessGoldSetItemRecord,
  HarnessGoldSetVersionRecord,
  HarnessRubricDefinitionRecord,
  HarnessRubricDimensionRecord,
} from "./harness-dataset-record.ts";
import type { HarnessDatasetRepository } from "./harness-dataset-repository.ts";

function cloneJson(
  value: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!value) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function cloneGoldSetItem(
  record: HarnessGoldSetItemRecord,
): HarnessGoldSetItemRecord {
  return {
    ...record,
    risk_tags: record.risk_tags ? [...record.risk_tags] : undefined,
    expected_structured_output: cloneJson(record.expected_structured_output),
  };
}

function cloneGoldSetFamily(
  record: HarnessGoldSetFamilyRecord,
): HarnessGoldSetFamilyRecord {
  return {
    ...record,
    scope: {
      ...record.scope,
      manuscript_types: [...record.scope.manuscript_types],
    },
  };
}

function cloneGoldSetVersion(
  record: HarnessGoldSetVersionRecord,
): HarnessGoldSetVersionRecord {
  return {
    ...record,
    items: record.items.map(cloneGoldSetItem),
  };
}

function cloneRubricDimension(
  record: HarnessRubricDimensionRecord,
): HarnessRubricDimensionRecord {
  return {
    ...record,
  };
}

function cloneRubricDefinition(
  record: HarnessRubricDefinitionRecord,
): HarnessRubricDefinitionRecord {
  return {
    ...record,
    scope: {
      ...record.scope,
      manuscript_types: [...record.scope.manuscript_types],
    },
    scoring_dimensions: record.scoring_dimensions.map(cloneRubricDimension),
    hard_gate_rules: record.hard_gate_rules ? [...record.hard_gate_rules] : undefined,
    failure_anchors: record.failure_anchors
      ? [...record.failure_anchors]
      : undefined,
    borderline_examples: record.borderline_examples
      ? [...record.borderline_examples]
      : undefined,
  };
}

function cloneDatasetPublication(
  record: HarnessDatasetPublicationRecord,
): HarnessDatasetPublicationRecord {
  return {
    ...record,
  };
}

function compareById<T extends { id: string }>(left: T, right: T): number {
  return left.id.localeCompare(right.id);
}

function compareVersionAsc(
  left: HarnessGoldSetVersionRecord | HarnessRubricDefinitionRecord,
  right: HarnessGoldSetVersionRecord | HarnessRubricDefinitionRecord,
): number {
  return left.version_no - right.version_no || left.id.localeCompare(right.id);
}

export class InMemoryHarnessDatasetRepository
  implements
    HarnessDatasetRepository,
    SnapshotCapableRepository<{
      families: Map<string, HarnessGoldSetFamilyRecord>;
      versions: Map<string, HarnessGoldSetVersionRecord>;
      rubrics: Map<string, HarnessRubricDefinitionRecord>;
      publications: Map<string, HarnessDatasetPublicationRecord>;
    }>
{
  private readonly families = new Map<string, HarnessGoldSetFamilyRecord>();
  private readonly versions = new Map<string, HarnessGoldSetVersionRecord>();
  private readonly rubrics = new Map<string, HarnessRubricDefinitionRecord>();
  private readonly publications =
    new Map<string, HarnessDatasetPublicationRecord>();

  async saveGoldSetFamily(record: HarnessGoldSetFamilyRecord): Promise<void> {
    this.families.set(record.id, cloneGoldSetFamily(record));
  }

  async findGoldSetFamilyById(
    id: string,
  ): Promise<HarnessGoldSetFamilyRecord | undefined> {
    const record = this.families.get(id);
    return record ? cloneGoldSetFamily(record) : undefined;
  }

  async listGoldSetFamilies(): Promise<HarnessGoldSetFamilyRecord[]> {
    return [...this.families.values()].sort(compareById).map(cloneGoldSetFamily);
  }

  async saveGoldSetVersion(record: HarnessGoldSetVersionRecord): Promise<void> {
    this.versions.set(record.id, cloneGoldSetVersion(record));
  }

  async findGoldSetVersionById(
    id: string,
  ): Promise<HarnessGoldSetVersionRecord | undefined> {
    const record = this.versions.get(id);
    return record ? cloneGoldSetVersion(record) : undefined;
  }

  async listGoldSetVersionsByFamilyId(
    familyId: string,
  ): Promise<HarnessGoldSetVersionRecord[]> {
    return [...this.versions.values()]
      .filter((record) => record.family_id === familyId)
      .sort(compareVersionAsc)
      .map(cloneGoldSetVersion);
  }

  async saveRubricDefinition(record: HarnessRubricDefinitionRecord): Promise<void> {
    this.rubrics.set(record.id, cloneRubricDefinition(record));
  }

  async findRubricDefinitionById(
    id: string,
  ): Promise<HarnessRubricDefinitionRecord | undefined> {
    const record = this.rubrics.get(id);
    return record ? cloneRubricDefinition(record) : undefined;
  }

  async listRubricDefinitions(): Promise<HarnessRubricDefinitionRecord[]> {
    return [...this.rubrics.values()]
      .sort(
        (left, right) =>
          left.name.localeCompare(right.name) || compareVersionAsc(left, right),
      )
      .map(cloneRubricDefinition);
  }

  async listRubricDefinitionsByName(
    name: string,
  ): Promise<HarnessRubricDefinitionRecord[]> {
    return [...this.rubrics.values()]
      .filter((record) => record.name === name)
      .sort(compareVersionAsc)
      .map(cloneRubricDefinition);
  }

  async saveDatasetPublication(
    record: HarnessDatasetPublicationRecord,
  ): Promise<void> {
    this.publications.set(record.id, cloneDatasetPublication(record));
  }

  async listDatasetPublicationsByVersionId(
    goldSetVersionId: string,
  ): Promise<HarnessDatasetPublicationRecord[]> {
    return [...this.publications.values()]
      .filter((record) => record.gold_set_version_id === goldSetVersionId)
      .sort(
        (left, right) =>
          left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id),
      )
      .map(cloneDatasetPublication);
  }

  snapshotState(): {
    families: Map<string, HarnessGoldSetFamilyRecord>;
    versions: Map<string, HarnessGoldSetVersionRecord>;
    rubrics: Map<string, HarnessRubricDefinitionRecord>;
    publications: Map<string, HarnessDatasetPublicationRecord>;
  } {
    return {
      families: new Map(
        [...this.families.entries()].map(([id, record]) => [
          id,
          cloneGoldSetFamily(record),
        ]),
      ),
      versions: new Map(
        [...this.versions.entries()].map(([id, record]) => [
          id,
          cloneGoldSetVersion(record),
        ]),
      ),
      rubrics: new Map(
        [...this.rubrics.entries()].map(([id, record]) => [
          id,
          cloneRubricDefinition(record),
        ]),
      ),
      publications: new Map(
        [...this.publications.entries()].map(([id, record]) => [
          id,
          cloneDatasetPublication(record),
        ]),
      ),
    };
  }

  restoreState(snapshot: {
    families: Map<string, HarnessGoldSetFamilyRecord>;
    versions: Map<string, HarnessGoldSetVersionRecord>;
    rubrics: Map<string, HarnessRubricDefinitionRecord>;
    publications: Map<string, HarnessDatasetPublicationRecord>;
  }): void {
    this.families.clear();
    for (const [id, record] of snapshot.families.entries()) {
      this.families.set(id, cloneGoldSetFamily(record));
    }

    this.versions.clear();
    for (const [id, record] of snapshot.versions.entries()) {
      this.versions.set(id, cloneGoldSetVersion(record));
    }

    this.rubrics.clear();
    for (const [id, record] of snapshot.rubrics.entries()) {
      this.rubrics.set(id, cloneRubricDefinition(record));
    }

    this.publications.clear();
    for (const [id, record] of snapshot.publications.entries()) {
      this.publications.set(id, cloneDatasetPublication(record));
    }
  }
}
