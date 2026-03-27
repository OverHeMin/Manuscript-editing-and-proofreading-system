import type {
  PromptTemplateRecord,
  SkillPackageRecord,
} from "./prompt-skill-record.ts";

export interface PromptSkillRegistryRepository {
  saveSkillPackage(record: SkillPackageRecord): Promise<void>;
  findSkillPackageById(id: string): Promise<SkillPackageRecord | undefined>;
  listSkillPackages(): Promise<SkillPackageRecord[]>;
  listSkillPackagesByName(name: string): Promise<SkillPackageRecord[]>;
  savePromptTemplate(record: PromptTemplateRecord): Promise<void>;
  findPromptTemplateById(id: string): Promise<PromptTemplateRecord | undefined>;
  listPromptTemplates(): Promise<PromptTemplateRecord[]>;
  listPromptTemplatesByNameAndModule(
    name: string,
    module: PromptTemplateRecord["module"],
  ): Promise<PromptTemplateRecord[]>;
}
