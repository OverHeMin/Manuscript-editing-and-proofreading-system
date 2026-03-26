import type {
  ModuleTemplateRepository,
  TemplateFamilyRepository,
} from "./template-repository.ts";
import type {
  ModuleTemplateRecord,
  TemplateFamilyRecord,
  TemplateModule,
} from "./template-record.ts";

function cloneTemplateFamilyRecord(
  record: TemplateFamilyRecord,
): TemplateFamilyRecord {
  return { ...record };
}

function cloneModuleTemplateRecord(
  record: ModuleTemplateRecord,
): ModuleTemplateRecord {
  return {
    ...record,
    checklist: record.checklist ? [...record.checklist] : undefined,
    section_requirements: record.section_requirements
      ? [...record.section_requirements]
      : undefined,
  };
}

function versionKey(templateFamilyId: string, module: TemplateModule): string {
  return `${templateFamilyId}:${module}`;
}

export class InMemoryTemplateFamilyRepository implements TemplateFamilyRepository {
  private readonly records = new Map<string, TemplateFamilyRecord>();

  async save(record: TemplateFamilyRecord): Promise<void> {
    this.records.set(record.id, cloneTemplateFamilyRecord(record));
  }

  async findById(id: string): Promise<TemplateFamilyRecord | undefined> {
    const record = this.records.get(id);
    return record ? cloneTemplateFamilyRecord(record) : undefined;
  }

  async list(): Promise<TemplateFamilyRecord[]> {
    return [...this.records.values()].map(cloneTemplateFamilyRecord);
  }

  snapshotState(): Map<string, TemplateFamilyRecord> {
    return new Map(
      [...this.records.entries()].map(([id, record]) => [
        id,
        cloneTemplateFamilyRecord(record),
      ]),
    );
  }

  restoreState(snapshot: Map<string, TemplateFamilyRecord>): void {
    this.records.clear();
    for (const [id, record] of snapshot.entries()) {
      this.records.set(id, cloneTemplateFamilyRecord(record));
    }
  }
}

export class InMemoryModuleTemplateRepository implements ModuleTemplateRepository {
  private readonly records = new Map<string, ModuleTemplateRecord>();
  private readonly reservedVersionNumbers = new Map<string, number>();

  async save(record: ModuleTemplateRecord): Promise<void> {
    this.records.set(record.id, cloneModuleTemplateRecord(record));
    const key = versionKey(record.template_family_id, record.module);
    const currentReserved = this.reservedVersionNumbers.get(key) ?? 0;
    if (record.version_no > currentReserved) {
      this.reservedVersionNumbers.set(key, record.version_no);
    }
  }

  async findById(id: string): Promise<ModuleTemplateRecord | undefined> {
    const record = this.records.get(id);
    return record ? cloneModuleTemplateRecord(record) : undefined;
  }

  async listByTemplateFamilyId(
    templateFamilyId: string,
  ): Promise<ModuleTemplateRecord[]> {
    return [...this.records.values()]
      .filter((record) => record.template_family_id === templateFamilyId)
      .sort((left, right) => left.version_no - right.version_no)
      .map(cloneModuleTemplateRecord);
  }

  async listByTemplateFamilyIdAndModule(
    templateFamilyId: string,
    module: TemplateModule,
  ): Promise<ModuleTemplateRecord[]> {
    return [...this.records.values()]
      .filter(
        (record) =>
          record.template_family_id === templateFamilyId &&
          record.module === module,
      )
      .sort((left, right) => left.version_no - right.version_no)
      .map(cloneModuleTemplateRecord);
  }

  async reserveNextVersionNumber(
    templateFamilyId: string,
    module: TemplateModule,
  ): Promise<number> {
    const key = versionKey(templateFamilyId, module);
    const currentReserved = this.reservedVersionNumbers.get(key);
    if (currentReserved !== undefined) {
      const nextVersion = currentReserved + 1;
      this.reservedVersionNumbers.set(key, nextVersion);
      return nextVersion;
    }

    const highestStoredVersion = (
      await this.listByTemplateFamilyIdAndModule(templateFamilyId, module)
    ).reduce(
      (currentHighest, template) =>
        Math.max(currentHighest, template.version_no),
      0,
    );
    const nextVersion = highestStoredVersion + 1;
    this.reservedVersionNumbers.set(key, nextVersion);
    return nextVersion;
  }

  snapshotState(): {
    records: Map<string, ModuleTemplateRecord>;
    reservedVersionNumbers: Map<string, number>;
  } {
    return {
      records: new Map(
        [...this.records.entries()].map(([id, record]) => [
          id,
          cloneModuleTemplateRecord(record),
        ]),
      ),
      reservedVersionNumbers: new Map(this.reservedVersionNumbers.entries()),
    };
  }

  restoreState(snapshot: {
    records: Map<string, ModuleTemplateRecord>;
    reservedVersionNumbers: Map<string, number>;
  }): void {
    this.records.clear();
    for (const [id, record] of snapshot.records.entries()) {
      this.records.set(id, cloneModuleTemplateRecord(record));
    }
    this.reservedVersionNumbers.clear();
    for (const [key, version] of snapshot.reservedVersionNumbers.entries()) {
      this.reservedVersionNumbers.set(key, version);
    }
  }
}
