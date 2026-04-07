import type {
  JournalTemplateProfileRecord,
  ModuleTemplateRecord,
  TemplateFamilyRecord,
  TemplateModule,
} from "./template-record.ts";

export interface TemplateFamilyRepository {
  save(record: TemplateFamilyRecord): Promise<void>;
  findById(id: string): Promise<TemplateFamilyRecord | undefined>;
  list(): Promise<TemplateFamilyRecord[]>;
  saveJournalTemplateProfile(record: JournalTemplateProfileRecord): Promise<void>;
  findJournalTemplateProfileById(
    id: string,
  ): Promise<JournalTemplateProfileRecord | undefined>;
  findJournalTemplateProfileByTemplateFamilyIdAndJournalKey(
    templateFamilyId: string,
    journalKey: string,
  ): Promise<JournalTemplateProfileRecord | undefined>;
  listJournalTemplateProfilesByTemplateFamilyId(
    templateFamilyId: string,
  ): Promise<JournalTemplateProfileRecord[]>;
}

export interface ModuleTemplateRepository {
  save(record: ModuleTemplateRecord): Promise<void>;
  findById(id: string): Promise<ModuleTemplateRecord | undefined>;
  listByTemplateFamilyId(templateFamilyId: string): Promise<ModuleTemplateRecord[]>;
  listByTemplateFamilyIdAndModule(
    templateFamilyId: string,
    module: TemplateModule,
  ): Promise<ModuleTemplateRecord[]>;
  reserveNextVersionNumber(
    templateFamilyId: string,
    module: TemplateModule,
  ): Promise<number>;
}
