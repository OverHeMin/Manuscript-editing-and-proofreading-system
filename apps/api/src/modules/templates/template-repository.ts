import type {
  GovernedContentModuleClass,
  GovernedContentModuleRecord,
  JournalTemplateProfileRecord,
  ModuleTemplateRecord,
  TemplateCompositionRecord,
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

export interface GovernedContentModuleRepository {
  saveContentModule(record: GovernedContentModuleRecord): Promise<void>;
  findContentModuleById(
    id: string,
  ): Promise<GovernedContentModuleRecord | undefined>;
  listContentModules(input?: {
    moduleClass?: GovernedContentModuleClass;
  }): Promise<GovernedContentModuleRecord[]>;
}

export interface TemplateCompositionRepository {
  saveTemplateComposition(record: TemplateCompositionRecord): Promise<void>;
  findTemplateCompositionById(
    id: string,
  ): Promise<TemplateCompositionRecord | undefined>;
  listTemplateCompositions(): Promise<TemplateCompositionRecord[]>;
}
