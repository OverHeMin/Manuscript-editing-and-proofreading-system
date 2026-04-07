import type {
  EditorialRuleRecord,
  EditorialRuleSetRecord,
} from "./editorial-rule-record.ts";

export interface EditorialRuleRepository {
  saveRuleSet(record: EditorialRuleSetRecord): Promise<void>;
  findRuleSetById(id: string): Promise<EditorialRuleSetRecord | undefined>;
  listRuleSets(): Promise<EditorialRuleSetRecord[]>;
  listRuleSetsByTemplateFamilyAndModule(
    templateFamilyId: string,
    module: EditorialRuleSetRecord["module"],
  ): Promise<EditorialRuleSetRecord[]>;
  reserveNextRuleSetVersion(
    templateFamilyId: string,
    module: EditorialRuleSetRecord["module"],
    journalTemplateId?: string,
  ): Promise<number>;
  saveRule(record: EditorialRuleRecord): Promise<void>;
  findRuleById(id: string): Promise<EditorialRuleRecord | undefined>;
  listRulesByRuleSetId(ruleSetId: string): Promise<EditorialRuleRecord[]>;
}
