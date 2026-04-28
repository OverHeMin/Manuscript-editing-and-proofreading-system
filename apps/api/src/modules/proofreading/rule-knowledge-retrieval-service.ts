import type { EditorialRuleRecord } from "../editorial-rules/editorial-rule-record.ts";
import type { KnowledgeRecord } from "../knowledge/knowledge-record.ts";
import type { KnowledgeRetrievalIndexEntryRecord } from "../knowledge-retrieval/knowledge-retrieval-record.ts";
import type { KnowledgeRetrievalService } from "../knowledge-retrieval/knowledge-retrieval-service.ts";
import type { ManuscriptType } from "../manuscripts/manuscript-record.ts";
import type { DeepProofreadingSlice } from "./deep-proofreading-contracts.ts";
import type { ProofreadingDeepPassKind } from "./proofreading-pass-run-record.ts";

export interface ProofreadingRetrievalContext {
  module: "proofreading";
  manuscriptType?: ManuscriptType;
  templateFamilyId?: string;
  journalTemplateId?: string;
  journalKey?: string;
  medicalPackageIds?: string[];
  generalPackageIds?: string[];
}

export interface RetrievedRuleCandidate {
  ruleId: string;
  rule: EditorialRuleRecord;
  score: number;
  reasons: string[];
}

export interface RetrievedKnowledgeCandidate {
  knowledgeItemId: string;
  knowledge: KnowledgeRecord;
  score: number;
  reasons: string[];
}

export async function retrieveRuleKnowledgeCandidates(input: {
  context: ProofreadingRetrievalContext;
  slice: DeepProofreadingSlice;
  passKind: ProofreadingDeepPassKind;
  rules?: readonly EditorialRuleRecord[];
  knowledge?: readonly KnowledgeRecord[];
  knowledgeRetrievalService?: Pick<
    KnowledgeRetrievalService,
    "rankIndexEntriesForContext"
  >;
}): Promise<{
  candidateRules: RetrievedRuleCandidate[];
  candidateKnowledge: RetrievedKnowledgeCandidate[];
  diagnostics: {
    fallbackReasons: string[];
  };
}> {
  const fallbackReasons: string[] = [];
  const sliceTerms = tokenize(input.slice.text);
  const contextRankedIds = new Set<string>();

  try {
    const ranked = await input.knowledgeRetrievalService?.rankIndexEntriesForContext({
      module: input.context.module,
      manuscriptType: input.context.manuscriptType,
      templateFamilyId: input.context.templateFamilyId,
      journalKey: input.context.journalKey,
      ruleObject: input.slice.sliceKind === "table" ? "table" : undefined,
    });
    (ranked ?? []).forEach((entry: KnowledgeRetrievalIndexEntryRecord) => {
      contextRankedIds.add(entry.knowledge_item_id);
    });
  } catch (error) {
    fallbackReasons.push(
      error instanceof Error ? error.message : "context_rank_failed",
    );
  }

  return {
    candidateRules: (input.rules ?? [])
      .map((rule) => scoreRule(rule, input, sliceTerms))
      .filter((candidate): candidate is RetrievedRuleCandidate => Boolean(candidate))
      .sort(sortCandidate),
    candidateKnowledge: (input.knowledge ?? [])
      .map((knowledge) =>
        scoreKnowledge(knowledge, input, sliceTerms, contextRankedIds),
      )
      .filter((candidate): candidate is RetrievedKnowledgeCandidate =>
        Boolean(candidate),
      )
      .sort(sortCandidate),
    diagnostics: { fallbackReasons },
  };
}

function scoreRule(
  rule: EditorialRuleRecord,
  input: {
    context: ProofreadingRetrievalContext;
    slice: DeepProofreadingSlice;
  },
  sliceTerms: Set<string>,
): RetrievedRuleCandidate | undefined {
  if (!rule.enabled) {
    return undefined;
  }
  if (!matchesManuscriptType(rule.scope.manuscript_types, input.context.manuscriptType)) {
    return undefined;
  }
  if (!matchesRuleObject(rule, input.slice)) {
    return undefined;
  }
  const reasons = ["binding_match"];
  let score = 10 + (rule.priority ? Math.max(0, 100 - rule.priority) / 10 : 0);
  const searchable = [
    rule.rule_object,
    rule.explanation_payload?.rationale,
    JSON.stringify(rule.trigger),
  ].join(" ");
  if (hasKeywordHit(searchable, sliceTerms)) {
    reasons.push("keyword_hit");
    score += 5;
  }
  if (rule.scope_layer === "medical") {
    reasons.push("medical_package_scope");
    score += 4;
  }
  if (rule.scope_layer === "general") {
    reasons.push("general_package_scope");
    score += 2;
  }
  return { ruleId: rule.id, rule, score, reasons };
}

function scoreKnowledge(
  knowledge: KnowledgeRecord,
  input: {
    context: ProofreadingRetrievalContext;
  },
  sliceTerms: Set<string>,
  contextRankedIds: Set<string>,
): RetrievedKnowledgeCandidate | undefined {
  if (knowledge.status !== "approved") {
    return undefined;
  }
  if (
    knowledge.routing.module_scope !== "any" &&
    knowledge.routing.module_scope !== input.context.module
  ) {
    return undefined;
  }
  if (!matchesManuscriptType(knowledge.routing.manuscript_types, input.context.manuscriptType)) {
    return undefined;
  }

  const reasons: string[] = [];
  let score = 0;
  if (matchesKnowledgeBinding(knowledge, input.context)) {
    reasons.push("binding_match");
    score += 10;
  }
  if (
    hasKeywordHit(
      [knowledge.title, knowledge.summary, knowledge.canonical_text].join(" "),
      sliceTerms,
    )
  ) {
    reasons.push("keyword_hit");
    score += 5;
  }
  if (contextRankedIds.has(knowledge.id)) {
    reasons.push("context_rank");
    score += 4;
  }
  if (score === 0) {
    return undefined;
  }
  return {
    knowledgeItemId: knowledge.id,
    knowledge,
    score,
    reasons,
  };
}

function matchesRuleObject(
  rule: EditorialRuleRecord,
  slice: DeepProofreadingSlice,
): boolean {
  if (slice.sliceKind === "table") {
    return (
      rule.rule_object === "table" ||
      Boolean(rule.scope.object_granularity?.includes("table"))
    );
  }
  return rule.rule_object !== "table" || Boolean(slice.tableIds?.length);
}

function matchesKnowledgeBinding(
  knowledge: KnowledgeRecord,
  context: ProofreadingRetrievalContext,
): boolean {
  const bindings = knowledge.binding_targets;
  return Boolean(
    (context.templateFamilyId &&
      bindings?.template_family_ids?.includes(context.templateFamilyId)) ||
      (context.journalTemplateId &&
        bindings?.journal_template_ids?.includes(context.journalTemplateId)) ||
      (context.medicalPackageIds ?? []).some((id) =>
        bindings?.medical_package_ids?.includes(id),
      ) ||
      (context.generalPackageIds ?? []).some((id) =>
        bindings?.general_package_ids?.includes(id),
      ),
  );
}

function matchesManuscriptType(
  values: unknown,
  manuscriptType: ManuscriptType | undefined,
): boolean {
  if (!manuscriptType || values === undefined || values === "any") {
    return true;
  }
  return Array.isArray(values) && values.includes(manuscriptType);
}

function hasKeywordHit(value: string, terms: Set<string>): boolean {
  const normalized = value.toLowerCase();
  for (const term of terms) {
    if (term.length >= 2 && normalized.includes(term.toLowerCase())) {
      return true;
    }
  }
  return false;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .split(/[^\p{L}\p{N}]+/u)
      .map((term) => term.trim())
      .filter(Boolean),
  );
}

function sortCandidate<T extends { score: number; reasons: string[] }>(
  left: T,
  right: T,
): number {
  return right.score - left.score || right.reasons.length - left.reasons.length;
}
