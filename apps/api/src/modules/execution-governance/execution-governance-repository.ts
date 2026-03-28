import type {
  KnowledgeBindingRuleRecord,
  ModuleExecutionProfileRecord,
} from "./execution-governance-record.ts";

export interface ExecutionGovernanceRepository {
  saveProfile(record: ModuleExecutionProfileRecord): Promise<void>;
  findProfileById(id: string): Promise<ModuleExecutionProfileRecord | undefined>;
  listProfiles(): Promise<ModuleExecutionProfileRecord[]>;
  reserveNextProfileVersion(
    module: ModuleExecutionProfileRecord["module"],
    manuscriptType: ModuleExecutionProfileRecord["manuscript_type"],
    templateFamilyId: ModuleExecutionProfileRecord["template_family_id"],
  ): Promise<number>;
  saveKnowledgeBindingRule(record: KnowledgeBindingRuleRecord): Promise<void>;
  findKnowledgeBindingRuleById(
    id: string,
  ): Promise<KnowledgeBindingRuleRecord | undefined>;
  listKnowledgeBindingRules(): Promise<KnowledgeBindingRuleRecord[]>;
}
