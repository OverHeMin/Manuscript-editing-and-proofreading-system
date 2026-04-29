import type { LearningCandidateViewModel } from "../learning-review/index.ts";
import type { RuleAiIntakeDraftResponseViewModel } from "../editorial-rules/index.ts";
import type {
  TemplateGovernanceRuleLedgerRow,
} from "./template-governance-ledger-types.ts";
import {
  formatTemplateGovernanceManuscriptTypeLabel,
  formatTemplateGovernanceModuleLabel,
} from "./template-governance-display.ts";
import type { RuleWizardCandidateHandoffViewModel } from "./template-governance-rule-wizard.tsx";
import {
  createRuleWizardEntryFormState,
  type RuleWizardEntryFormState,
} from "./template-governance-rule-wizard-api.ts";

export function createRuleWizardEntryFormStateFromRuleLedgerRow(
  row: TemplateGovernanceRuleLedgerRow,
): RuleWizardEntryFormState | null {
  if (
    row.asset_kind !== "recycled_candidate" ||
    row.learning_candidate == null ||
    !isRuleCenterLearningCandidate(row.learning_candidate)
  ) {
    return null;
  }

  return createRuleWizardEntryFormStateFromLearningCandidate(row.learning_candidate);
}

export function createRuleWizardEntryFormStateFromAiDraft(
  response: RuleAiIntakeDraftResponseViewModel,
): RuleWizardEntryFormState {
  const draft = response.draft;
  const sourceBasis = draft.evidence
    .map((item) => item.text?.trim())
    .filter((text): text is string => Boolean(text))
    .join("\n");
  const uncertaintyNotes = draft.uncertainties.map((item) => `不确定点：${item}`);
  const similarityNotes = response.similar_rule_matches.map((match) =>
    `相似规则：${match.title}（${match.kind}）${match.rationale}`,
  );
  const warningNotes = (response.warnings ?? []).map((warning) => `AI 提示：${warning}`);

  return createRuleWizardEntryFormState({
    title:
      draft.new_template_candidate?.title?.trim() ||
      draft.target_object.trim() ||
      "AI 生成规则草稿",
    moduleScope:
      draft.scope.module_scope && draft.scope.module_scope !== "any"
        ? draft.scope.module_scope
        : "any",
    manuscriptTypes: draft.scope.manuscript_types ?? "any",
    sourceType: "other",
    contributor: "AI 草稿生成",
    ruleBody: [
      draft.ai_understanding_summary,
      `命中条件：${draft.trigger}`,
      `执行动作：${draft.action}`,
    ]
      .filter((line) => line.trim().length > 0)
      .join("\n"),
    sourceBasis,
    sections: draft.scope.sections ?? [],
    riskTags: [
      "ai_generated_rule_draft",
      draft.recommended_governance_layer,
      response.template_match.status,
      ...(response.similar_rule_matches.length > 0
        ? ["similarity_manual_review"]
        : []),
    ],
    packageHints: [
      draft.recommended_template_id,
      response.template_match.template_id,
    ].filter((value): value is string => Boolean(value?.trim())),
    candidateOnly: true,
    conflictNotes: [...uncertaintyNotes, ...similarityNotes, ...warningNotes].join("\n"),
  });
}

export function resolveRuleWizardCandidateTitle(
  candidate: LearningCandidateViewModel | null,
): string | undefined {
  if (!candidate) {
    return undefined;
  }

  return candidate.title?.trim() || candidate.proposal_text?.trim() || candidate.id;
}

export function createRuleWizardCandidateHandoffViewModel(
  candidate: LearningCandidateViewModel,
  input: {
    prefilledManuscriptId?: string;
    prefilledReviewedCaseSnapshotId?: string;
  },
): RuleWizardCandidateHandoffViewModel {
  return {
    learningCandidateId: candidate.id,
    sourceLabel: resolveLearningCandidateProvenanceLabel(candidate.governed_provenance_kind),
    moduleLabel: formatTemplateGovernanceModuleLabel(
      normalizeLearningCandidateModule(candidate.module),
    ),
    manuscriptTypeLabel: formatTemplateGovernanceManuscriptTypeLabel(
      normalizeLearningCandidateManuscriptType(candidate.manuscript_type),
    ),
    statusLabel: resolveLearningCandidateStatusLabel(candidate.status),
    manuscriptId: input.prefilledManuscriptId?.trim() || null,
    reviewedCaseSnapshotId: input.prefilledReviewedCaseSnapshotId?.trim() || null,
    sourceAssetLabel: resolveLearningCandidateSourceAssetLabel(
      candidate.governed_provenance_kind,
    ),
    sourceAssetId:
      candidate.snapshot_asset_id ??
      candidate.human_final_asset_id ??
      candidate.annotated_asset_id ??
      null,
    suggestedTemplateFamilyId: candidate.suggested_template_family_id ?? null,
    suggestedJournalTemplateId: candidate.suggested_journal_template_id ?? null,
    proposalText: candidate.proposal_text?.trim() || null,
    evidenceSummary: extractLearningCandidatePayloadText(
      candidate.candidate_payload,
      "evidence_summary",
    ),
    beforeFragment: extractLearningCandidatePayloadText(
      candidate.candidate_payload,
      "before_fragment",
    ),
    afterFragment: extractLearningCandidatePayloadText(
      candidate.candidate_payload,
      "after_fragment",
    ),
  };
}

export function createRuleWizardEntryFormStateFromLearningCandidate(
  candidate: LearningCandidateViewModel,
): RuleWizardEntryFormState {
  const payload = candidate.candidate_payload;

  return createRuleWizardEntryFormState({
    title: candidate.title ?? "未命名回流候选",
    moduleScope: normalizeLearningCandidateModule(candidate.module),
    manuscriptTypes: normalizeLearningCandidateManuscriptType(candidate.manuscript_type),
    sourceType: "internal_case",
    contributor: candidate.created_by,
    ruleBody: candidate.proposal_text ?? "",
    positiveExample:
      payload && typeof payload === "object" && "after_fragment" in payload
        ? String(payload.after_fragment ?? "")
        : "",
    negativeExample:
      payload && typeof payload === "object" && "before_fragment" in payload
        ? String(payload.before_fragment ?? "")
        : "",
    sourceBasis:
      payload && typeof payload === "object" && "evidence_summary" in payload
        ? String(payload.evidence_summary ?? "")
        : "",
  });
}

export function isRuleCenterLearningCandidate(
  candidate: LearningCandidateViewModel | null | undefined,
): candidate is LearningCandidateViewModel & { type: "rule_candidate" } {
  return candidate?.type === "rule_candidate";
}

export function normalizeLearningCandidateModule(
  value: string,
): RuleWizardEntryFormState["moduleScope"] {
  switch (value) {
    case "screening":
    case "editing":
    case "proofreading":
      return value;
    default:
      return "any";
  }
}

export function normalizeLearningCandidateManuscriptType(value: string): string {
  return value.trim().length > 0 ? value : "any";
}

function resolveLearningCandidateProvenanceLabel(
  value: LearningCandidateViewModel["governed_provenance_kind"],
): string {
  switch (value) {
    case "human_feedback":
      return "人工反馈命中";
    case "evaluation_experiment":
      return "评测实验回流";
    case "reviewed_case_snapshot":
      return "复核快照回流";
    case "residual_issue":
      return "残差问题回流";
    default:
      return "学习候选回流";
  }
}

function resolveLearningCandidateSourceAssetLabel(
  value: LearningCandidateViewModel["governed_provenance_kind"],
): string {
  switch (value) {
    case "reviewed_case_snapshot":
    case "residual_issue":
      return "快照资产";
    case "human_feedback":
      return "来源资产";
    case "evaluation_experiment":
      return "证据资产";
    default:
      return "来源资产";
  }
}

function resolveLearningCandidateStatusLabel(
  value: LearningCandidateViewModel["status"],
): string {
  switch (value) {
    case "draft":
      return "草稿";
    case "pending_review":
      return "待审核";
    case "approved":
      return "已通过";
    case "rejected":
      return "已驳回";
    case "archived":
      return "已归档";
    default:
      return value;
  }
}

function extractLearningCandidatePayloadText(
  payload: LearningCandidateViewModel["candidate_payload"],
  key: string,
): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = (payload as Record<string, unknown>)[key];
  return typeof candidate === "string" && candidate.trim().length > 0
    ? candidate
    : null;
}
