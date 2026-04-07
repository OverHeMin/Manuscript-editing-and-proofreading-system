import type {
  PromptTemplateRecord,
  SkillPackageRecord,
} from "./prompt-skill-record.ts";
import type { PromptSkillRegistryRepository } from "./prompt-skill-repository.ts";

function cloneSkillPackage(record: SkillPackageRecord): SkillPackageRecord {
  return {
    ...record,
    applies_to_modules: [...record.applies_to_modules],
    dependency_tools: record.dependency_tools
      ? [...record.dependency_tools]
      : undefined,
  };
}

function clonePromptTemplate(record: PromptTemplateRecord): PromptTemplateRecord {
  return {
    ...record,
    manuscript_types:
      record.manuscript_types === "any"
        ? "any"
        : [...record.manuscript_types],
    allowed_content_operations: record.allowed_content_operations
      ? [...record.allowed_content_operations]
      : undefined,
    forbidden_operations: record.forbidden_operations
      ? [...record.forbidden_operations]
      : undefined,
  };
}

function compareSkillPackages(
  left: SkillPackageRecord,
  right: SkillPackageRecord,
): number {
  if (left.name !== right.name) {
    return left.name.localeCompare(right.name);
  }

  if (left.version !== right.version) {
    return left.version.localeCompare(right.version);
  }

  return left.id.localeCompare(right.id);
}

function comparePromptTemplates(
  left: PromptTemplateRecord,
  right: PromptTemplateRecord,
): number {
  if (left.module !== right.module) {
    return left.module.localeCompare(right.module);
  }

  if (left.name !== right.name) {
    return left.name.localeCompare(right.name);
  }

  if (left.version !== right.version) {
    return left.version.localeCompare(right.version);
  }

  return left.id.localeCompare(right.id);
}

export class InMemoryPromptSkillRegistryRepository
  implements PromptSkillRegistryRepository
{
  private readonly skillPackages = new Map<string, SkillPackageRecord>();
  private readonly promptTemplates = new Map<string, PromptTemplateRecord>();

  async saveSkillPackage(record: SkillPackageRecord): Promise<void> {
    this.skillPackages.set(record.id, cloneSkillPackage(record));
  }

  async findSkillPackageById(
    id: string,
  ): Promise<SkillPackageRecord | undefined> {
    const record = this.skillPackages.get(id);
    return record ? cloneSkillPackage(record) : undefined;
  }

  async listSkillPackages(): Promise<SkillPackageRecord[]> {
    return [...this.skillPackages.values()]
      .sort(compareSkillPackages)
      .map(cloneSkillPackage);
  }

  async listSkillPackagesByName(name: string): Promise<SkillPackageRecord[]> {
    return [...this.skillPackages.values()]
      .filter((record) => record.name === name)
      .sort(compareSkillPackages)
      .map(cloneSkillPackage);
  }

  async savePromptTemplate(record: PromptTemplateRecord): Promise<void> {
    this.promptTemplates.set(record.id, clonePromptTemplate(record));
  }

  async findPromptTemplateById(
    id: string,
  ): Promise<PromptTemplateRecord | undefined> {
    const record = this.promptTemplates.get(id);
    return record ? clonePromptTemplate(record) : undefined;
  }

  async listPromptTemplates(): Promise<PromptTemplateRecord[]> {
    return [...this.promptTemplates.values()]
      .sort(comparePromptTemplates)
      .map(clonePromptTemplate);
  }

  async listPromptTemplatesByNameAndModule(
    name: string,
    module: PromptTemplateRecord["module"],
  ): Promise<PromptTemplateRecord[]> {
    return [...this.promptTemplates.values()]
      .filter((record) => record.name === name && record.module === module)
      .sort(comparePromptTemplates)
      .map(clonePromptTemplate);
  }
}
