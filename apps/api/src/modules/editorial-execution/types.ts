import type {
  EditorialRuleRecord,
  EditorialRuleSetRecord,
  EditorialRuleSeverity,
} from "../editorial-rules/editorial-rule-record.ts";
import type { KnowledgeRecord } from "../knowledge/knowledge-record.ts";
import type {
  PromptTemplateKind,
  PromptTemplateRecord,
} from "../prompt-skill-registry/prompt-skill-record.ts";

export interface EditorialTextBlock {
  text: string;
  section?: string;
  block_kind?: string;
}

export interface AppliedDeterministicRuleChange {
  ruleId: string;
  before: string;
  after: string;
  blockIndex?: number;
}

export interface DeterministicFormatExecutionResult {
  blocks: EditorialTextBlock[];
  appliedRuleIds: string[];
  appliedChanges: AppliedDeterministicRuleChange[];
}

export interface ApplyDeterministicDocxRulesInput {
  manuscriptId: string;
  sourceAssetId: string;
  outputStorageKey: string;
  outputFileName?: string;
  rules: EditorialRuleRecord[];
}

export interface DeterministicDocxTransformResult {
  appliedRuleIds: string[];
  appliedChanges: AppliedDeterministicRuleChange[];
}

export interface GovernedKnowledgeSelectionInput {
  knowledgeItem: KnowledgeRecord;
  matchSource: "binding_rule" | "template_binding" | "dynamic_routing";
  matchSourceId?: string;
  bindingRuleId?: string;
  matchReasons: string[];
}

export interface ManualReviewItem {
  ruleId: string;
  reason: string;
}

export interface ContentRuleCandidate {
  ruleId: string;
  reason: string;
  severity: EditorialRuleSeverity;
  actionKind: string;
}

export interface InstructionTemplatePayload {
  templateId: string;
  templateKind: PromptTemplateKind;
  systemInstructions: string;
  taskFrame: string;
  hardRuleSummary: string;
  allowedContentOperations: string[];
  forbiddenOperations: string[];
  manualReviewPolicy: string;
  outputContract: string;
  reportStyle?: string;
  promptSnippets: string[];
  manualReviewItems: ManualReviewItem[];
  contentRuleCandidates: ContentRuleCandidate[];
}

export interface AssembleInstructionTemplateInput {
  promptTemplate: PromptTemplateRecord;
  ruleSet: EditorialRuleSetRecord;
  rules: readonly EditorialRuleRecord[];
  knowledgeSelections: readonly GovernedKnowledgeSelectionInput[];
}

export interface ProofreadingCheckResult {
  ruleId: string;
  expected: string;
  actual: string;
  severity: EditorialRuleSeverity;
  blockIndex?: number;
}

export interface ProofreadingRiskItem {
  ruleId?: string;
  reason: string;
  severity?: EditorialRuleSeverity;
}

export interface ProofreadingInspectionResult {
  passedChecks: ProofreadingCheckResult[];
  failedChecks: ProofreadingCheckResult[];
  riskItems: ProofreadingRiskItem[];
  manualReviewItems: ManualReviewItem[];
  appliedChanges: AppliedDeterministicRuleChange[];
}

export interface ProofreadingSourceBlockResolver {
  resolveBlocks(input: {
    manuscriptId: string;
    assetId: string;
  }): Promise<EditorialTextBlock[]>;
}
