import type {
  EditorialRuleRecord,
  EditorialRuleSetRecord,
} from "./editorial-rule-record.ts";
import type { EditorialRuleRepository } from "./editorial-rule-repository.ts";

function cloneJsonObject<T extends Record<string, unknown>>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneRuleSet(record: EditorialRuleSetRecord): EditorialRuleSetRecord {
  return { ...record };
}

function cloneRule(record: EditorialRuleRecord): EditorialRuleRecord {
  return {
    ...record,
    scope: cloneJsonObject(record.scope),
    selector: cloneJsonObject(record.selector),
    trigger: cloneJsonObject(record.trigger),
    action: cloneJsonObject(record.action),
    authoring_payload: cloneJsonObject(record.authoring_payload),
    ...(record.explanation_payload
      ? { explanation_payload: cloneJsonObject(record.explanation_payload) }
      : {}),
    ...(record.linkage_payload
      ? { linkage_payload: cloneJsonObject(record.linkage_payload) }
      : {}),
    ...(record.projection_payload
      ? { projection_payload: cloneJsonObject(record.projection_payload) }
      : {}),
  };
}

function compareRuleSets(
  left: EditorialRuleSetRecord,
  right: EditorialRuleSetRecord,
): number {
  if (left.template_family_id !== right.template_family_id) {
    return left.template_family_id.localeCompare(right.template_family_id);
  }

  if (left.module !== right.module) {
    return left.module.localeCompare(right.module);
  }

  if (left.version_no !== right.version_no) {
    return left.version_no - right.version_no;
  }

  return left.id.localeCompare(right.id);
}

function compareRules(left: EditorialRuleRecord, right: EditorialRuleRecord): number {
  if (left.order_no !== right.order_no) {
    return left.order_no - right.order_no;
  }

  return left.id.localeCompare(right.id);
}

function versionKey(
  templateFamilyId: string,
  module: EditorialRuleSetRecord["module"],
  journalTemplateId?: string,
): string {
  return `${templateFamilyId}:${journalTemplateId ?? "<base>"}:${module}`;
}

export class InMemoryEditorialRuleRepository implements EditorialRuleRepository {
  private readonly ruleSets = new Map<string, EditorialRuleSetRecord>();
  private readonly rules = new Map<string, EditorialRuleRecord>();
  private readonly reservedVersions = new Map<string, number>();

  async saveRuleSet(record: EditorialRuleSetRecord): Promise<void> {
    this.ruleSets.set(record.id, cloneRuleSet(record));
    const key = versionKey(
      record.template_family_id,
      record.module,
      record.journal_template_id,
    );
    const currentReserved = this.reservedVersions.get(key) ?? 0;
    if (record.version_no > currentReserved) {
      this.reservedVersions.set(key, record.version_no);
    }
  }

  async findRuleSetById(
    id: string,
  ): Promise<EditorialRuleSetRecord | undefined> {
    const record = this.ruleSets.get(id);
    return record ? cloneRuleSet(record) : undefined;
  }

  async listRuleSets(): Promise<EditorialRuleSetRecord[]> {
    return [...this.ruleSets.values()]
      .sort(compareRuleSets)
      .map(cloneRuleSet);
  }

  async listRuleSetsByTemplateFamilyAndModule(
    templateFamilyId: string,
    module: EditorialRuleSetRecord["module"],
  ): Promise<EditorialRuleSetRecord[]> {
    return [...this.ruleSets.values()]
      .filter(
        (record) =>
          record.template_family_id === templateFamilyId &&
          record.module === module,
      )
      .sort(compareRuleSets)
      .map(cloneRuleSet);
  }

  async reserveNextRuleSetVersion(
    templateFamilyId: string,
    module: EditorialRuleSetRecord["module"],
    journalTemplateId?: string,
  ): Promise<number> {
    const key = versionKey(templateFamilyId, module, journalTemplateId);
    const currentReserved = this.reservedVersions.get(key);

    if (currentReserved !== undefined) {
      const nextVersion = currentReserved + 1;
      this.reservedVersions.set(key, nextVersion);
      return nextVersion;
    }

    const highestStoredVersion = (await this.listRuleSetsByTemplateFamilyAndModule(
      templateFamilyId,
      module,
    ))
      .filter(
        (record) =>
          (record.journal_template_id ?? undefined) ===
          (journalTemplateId ?? undefined),
      )
      .reduce(
      (currentHighest, record) => Math.max(currentHighest, record.version_no),
      0,
      );
    const nextVersion = highestStoredVersion + 1;
    this.reservedVersions.set(key, nextVersion);
    return nextVersion;
  }

  async saveRule(record: EditorialRuleRecord): Promise<void> {
    this.rules.set(record.id, cloneRule(record));
  }

  async findRuleById(id: string): Promise<EditorialRuleRecord | undefined> {
    const record = this.rules.get(id);
    return record ? cloneRule(record) : undefined;
  }

  async listRulesByRuleSetId(ruleSetId: string): Promise<EditorialRuleRecord[]> {
    return [...this.rules.values()]
      .filter((record) => record.rule_set_id === ruleSetId)
      .sort(compareRules)
      .map(cloneRule);
  }
}
