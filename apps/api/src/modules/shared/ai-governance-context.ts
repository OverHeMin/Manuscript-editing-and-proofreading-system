export interface AiGovernanceRuleContext {
  ruleId: string;
  actionKind: string;
  ruleType?: string;
  severity?: string;
  confidencePolicy?: string;
  executionMode?: string;
  sections?: string[];
  sourceLayer?: string;
}

export interface AiGovernanceKnowledgeHitContext {
  knowledgeItemId: string;
  matchSource?: string;
  bindingRuleId?: string;
  matchSourceId?: string;
  matchReasons?: string[];
}

export interface AiGovernanceContext {
  hardRuleSummary?: string;
  allowedContentOperations?: string[];
  forbiddenOperations?: string[];
  manualReviewPolicy?: string;
  promptSnippets?: string[];
  manualReviewItems?: string[];
  contentRuleCandidates?: string[];
  requiredChecks?: string[];
  resolvedRules?: AiGovernanceRuleContext[];
  knowledgeHits?: AiGovernanceKnowledgeHitContext[];
}

export function isAiGovernanceContextEmpty(
  value: AiGovernanceContext | undefined,
): boolean {
  if (!value) {
    return true;
  }

  return !value.hardRuleSummary &&
    (!value.allowedContentOperations || value.allowedContentOperations.length === 0) &&
    (!value.forbiddenOperations || value.forbiddenOperations.length === 0) &&
    !value.manualReviewPolicy &&
    (!value.promptSnippets || value.promptSnippets.length === 0) &&
    (!value.manualReviewItems || value.manualReviewItems.length === 0) &&
    (!value.contentRuleCandidates || value.contentRuleCandidates.length === 0) &&
    (!value.requiredChecks || value.requiredChecks.length === 0) &&
    (!value.resolvedRules || value.resolvedRules.length === 0) &&
    (!value.knowledgeHits || value.knowledgeHits.length === 0);
}
