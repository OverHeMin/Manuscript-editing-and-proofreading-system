import type {
  GovernedContentModuleRepository,
  ModuleTemplateRepository,
  TemplateCompositionRepository,
  TemplateFamilyRepository,
} from "./template-repository.ts";
import type {
  GovernedContentModuleRecord,
  JournalTemplateProfileRecord,
  ModuleTemplateRecord,
  TemplateCompositionRecord,
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

function cloneJournalTemplateProfileRecord(
  record: JournalTemplateProfileRecord,
): JournalTemplateProfileRecord {
  return { ...record };
}

function cloneGovernedContentModuleRecord(
  record: GovernedContentModuleRecord,
): GovernedContentModuleRecord {
  return {
    ...record,
    manuscript_type_scope: [...record.manuscript_type_scope],
    execution_module_scope: [...record.execution_module_scope],
    applicable_sections: record.applicable_sections
      ? [...record.applicable_sections]
      : undefined,
    guidance: record.guidance ? [...record.guidance] : undefined,
    examples: record.examples
      ? record.examples.map((example) => ({ ...example }))
      : undefined,
  };
}

function cloneTemplateCompositionRecord(
  record: TemplateCompositionRecord,
): TemplateCompositionRecord {
  return {
    ...record,
    general_module_ids: [...record.general_module_ids],
    medical_module_ids: [...record.medical_module_ids],
    execution_module_scope: [...record.execution_module_scope],
    source_candidate_ids: record.source_candidate_ids
      ? [...record.source_candidate_ids]
      : undefined,
  };
}

function versionKey(templateFamilyId: string, module: TemplateModule): string {
  return `${templateFamilyId}:${module}`;
}

export class InMemoryTemplateFamilyRepository
  implements
    TemplateFamilyRepository,
    GovernedContentModuleRepository,
    TemplateCompositionRepository
{
  private readonly records = new Map<string, TemplateFamilyRecord>();
  private readonly journalTemplateProfileRecords = new Map<
    string,
    JournalTemplateProfileRecord
  >();
  private readonly contentModuleRecords = new Map<
    string,
    GovernedContentModuleRecord
  >();
  private readonly templateCompositionRecords = new Map<
    string,
    TemplateCompositionRecord
  >();

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

  async saveJournalTemplateProfile(
    record: JournalTemplateProfileRecord,
  ): Promise<void> {
    this.journalTemplateProfileRecords.set(
      record.id,
      cloneJournalTemplateProfileRecord(record),
    );
  }

  async findJournalTemplateProfileById(
    id: string,
  ): Promise<JournalTemplateProfileRecord | undefined> {
    const record = this.journalTemplateProfileRecords.get(id);
    return record ? cloneJournalTemplateProfileRecord(record) : undefined;
  }

  async findJournalTemplateProfileByTemplateFamilyIdAndJournalKey(
    templateFamilyId: string,
    journalKey: string,
  ): Promise<JournalTemplateProfileRecord | undefined> {
    const record = [...this.journalTemplateProfileRecords.values()].find(
      (candidate) =>
        candidate.template_family_id === templateFamilyId &&
        candidate.journal_key === journalKey,
    );
    return record ? cloneJournalTemplateProfileRecord(record) : undefined;
  }

  async listJournalTemplateProfilesByTemplateFamilyId(
    templateFamilyId: string,
  ): Promise<JournalTemplateProfileRecord[]> {
    return [...this.journalTemplateProfileRecords.values()]
      .filter((record) => record.template_family_id === templateFamilyId)
      .map(cloneJournalTemplateProfileRecord);
  }

  async saveContentModule(record: GovernedContentModuleRecord): Promise<void> {
    this.contentModuleRecords.set(
      record.id,
      cloneGovernedContentModuleRecord(record),
    );
  }

  async findContentModuleById(
    id: string,
  ): Promise<GovernedContentModuleRecord | undefined> {
    const record = this.contentModuleRecords.get(id);
    return record ? cloneGovernedContentModuleRecord(record) : undefined;
  }

  async listContentModules(input?: {
    moduleClass?: GovernedContentModuleRecord["module_class"];
  }): Promise<GovernedContentModuleRecord[]> {
    return [...this.contentModuleRecords.values()]
      .filter((record) =>
        input?.moduleClass ? record.module_class === input.moduleClass : true,
      )
      .sort((left, right) => left.created_at.localeCompare(right.created_at))
      .map(cloneGovernedContentModuleRecord);
  }

  async saveTemplateComposition(record: TemplateCompositionRecord): Promise<void> {
    this.templateCompositionRecords.set(
      record.id,
      cloneTemplateCompositionRecord(record),
    );
  }

  async findTemplateCompositionById(
    id: string,
  ): Promise<TemplateCompositionRecord | undefined> {
    const record = this.templateCompositionRecords.get(id);
    return record ? cloneTemplateCompositionRecord(record) : undefined;
  }

  async listTemplateCompositions(): Promise<TemplateCompositionRecord[]> {
    return [...this.templateCompositionRecords.values()]
      .sort((left, right) => left.created_at.localeCompare(right.created_at))
      .map(cloneTemplateCompositionRecord);
  }

  snapshotState(): {
    records: Map<string, TemplateFamilyRecord>;
    journalTemplateProfileRecords: Map<string, JournalTemplateProfileRecord>;
    contentModuleRecords: Map<string, GovernedContentModuleRecord>;
    templateCompositionRecords: Map<string, TemplateCompositionRecord>;
  } {
    return {
      records: new Map(
        [...this.records.entries()].map(([id, record]) => [
          id,
          cloneTemplateFamilyRecord(record),
        ]),
      ),
      journalTemplateProfileRecords: new Map(
        [...this.journalTemplateProfileRecords.entries()].map(([id, record]) => [
          id,
          cloneJournalTemplateProfileRecord(record),
        ]),
      ),
      contentModuleRecords: new Map(
        [...this.contentModuleRecords.entries()].map(([id, record]) => [
          id,
          cloneGovernedContentModuleRecord(record),
        ]),
      ),
      templateCompositionRecords: new Map(
        [...this.templateCompositionRecords.entries()].map(([id, record]) => [
          id,
          cloneTemplateCompositionRecord(record),
        ]),
      ),
    };
  }

  restoreState(snapshot: {
    records: Map<string, TemplateFamilyRecord>;
    journalTemplateProfileRecords: Map<string, JournalTemplateProfileRecord>;
    contentModuleRecords: Map<string, GovernedContentModuleRecord>;
    templateCompositionRecords: Map<string, TemplateCompositionRecord>;
  }): void {
    this.records.clear();
    for (const [id, record] of snapshot.records.entries()) {
      this.records.set(id, cloneTemplateFamilyRecord(record));
    }
    this.journalTemplateProfileRecords.clear();
    for (const [id, record] of snapshot.journalTemplateProfileRecords.entries()) {
      this.journalTemplateProfileRecords.set(
        id,
        cloneJournalTemplateProfileRecord(record),
      );
    }
    this.contentModuleRecords.clear();
    for (const [id, record] of snapshot.contentModuleRecords.entries()) {
      this.contentModuleRecords.set(id, cloneGovernedContentModuleRecord(record));
    }
    this.templateCompositionRecords.clear();
    for (const [id, record] of snapshot.templateCompositionRecords.entries()) {
      this.templateCompositionRecords.set(
        id,
        cloneTemplateCompositionRecord(record),
      );
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
