import type {
  ModuleTemplateRecord,
  TemplateFamilyRecord,
  TemplateModule,
} from "./template-record.ts";

export interface TemplateFamilyRepository {
  save(record: TemplateFamilyRecord): Promise<void>;
  findById(id: string): Promise<TemplateFamilyRecord | undefined>;
  list(): Promise<TemplateFamilyRecord[]>;
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
