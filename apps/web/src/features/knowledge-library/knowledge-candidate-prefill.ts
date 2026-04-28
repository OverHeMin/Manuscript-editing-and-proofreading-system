import type { LearningCandidateViewModel } from "../learning-review/types.ts";
import type {
  CreateKnowledgeLibraryDraftInput,
  KnowledgeContentBlockViewModel,
  KnowledgeSemanticLayerViewModel,
} from "./types.ts";

export interface KnowledgeCandidateSourceSummary {
  candidateId: string;
  manuscriptId: string | null;
  module: string;
  manuscriptType: string;
  provenanceLabel: string;
  sourceAssetId: string | null;
  beforeFragment: string | null;
  afterFragment: string | null;
  evidenceSummary: string | null;
  proposalText: string | null;
}

export interface KnowledgeCandidatePrefill {
  sourceLearningCandidateId: string;
  draft: CreateKnowledgeLibraryDraftInput;
  contentBlocks: KnowledgeContentBlockViewModel[];
  semanticLayer?: KnowledgeSemanticLayerViewModel;
  sourceSummary: KnowledgeCandidateSourceSummary;
}

export function buildKnowledgeLibraryPrefillFromLearningCandidate(
  candidate: LearningCandidateViewModel,
): KnowledgeCandidatePrefill {
  if (candidate.type !== "knowledge_candidate") {
    throw new Error(`Learning candidate ${candidate.id} is not a knowledge candidate.`);
  }

  const payload = asRecord(candidate.candidate_payload);
  const knowledgePrefill = asRecord(payload?.knowledge_prefill);
  const semanticSuggestion = asRecord(payload?.ai_semantic_suggestion);
  const beforeFragment = readString(payload, "before_fragment");
  const afterFragment = readString(payload, "after_fragment");
  const evidenceSummary = readString(payload, "evidence_summary");
  const canonicalText =
    readString(knowledgePrefill, "canonical_text") ??
    readString(knowledgePrefill, "canonicalText") ??
    afterFragment ??
    candidate.proposal_text ??
    "";
  const summary =
    readString(knowledgePrefill, "summary") ??
    evidenceSummary ??
    candidate.proposal_text ??
    undefined;

  return {
    sourceLearningCandidateId: candidate.id,
    draft: {
      title:
        readString(knowledgePrefill, "title") ??
        candidate.title ??
        "未命名知识回流",
      canonicalText,
      ...(summary ? { summary } : {}),
      knowledgeKind: normalizeKnowledgeKind(
        readString(knowledgePrefill, "knowledge_kind") ??
          readString(knowledgePrefill, "knowledgeKind"),
      ),
      moduleScope: normalizeModuleScope(candidate.module),
      manuscriptTypes: normalizeManuscriptTypes(candidate.manuscript_type),
      sections: readStringArray(knowledgePrefill, "sections"),
      riskTags:
        readStringArray(knowledgePrefill, "risk_tags") ??
        readStringArray(knowledgePrefill, "riskTags"),
      disciplineTags:
        readStringArray(knowledgePrefill, "discipline_tags") ??
        readStringArray(knowledgePrefill, "disciplineTags"),
      aliases: readStringArray(knowledgePrefill, "aliases"),
      evidenceLevel: normalizeEvidenceLevel(
        readString(knowledgePrefill, "evidence_level") ??
          readString(knowledgePrefill, "evidenceLevel"),
      ),
      sourceType: normalizeSourceType(
        readString(knowledgePrefill, "source_type") ??
          readString(knowledgePrefill, "sourceType"),
      ),
      sourceLink:
        readString(knowledgePrefill, "source_link") ??
        readString(knowledgePrefill, "sourceLink"),
      sourceLearningCandidateId: candidate.id,
    },
    contentBlocks: [
      {
        id: `candidate-${candidate.id}-text-block`,
        revision_id: "local-draft",
        block_type: "text_block",
        order_no: 0,
        status: "active",
        content_payload: {
          text: buildCandidateContentBlockText({
            canonicalText,
            beforeFragment,
            afterFragment,
            evidenceSummary,
          }),
        },
      },
    ],
    ...(semanticSuggestion
      ? {
          semanticLayer: {
            revision_id: "local-draft",
            status: "pending_confirmation",
            page_summary: readString(semanticSuggestion, "page_summary"),
            retrieval_terms: readStringArray(
              semanticSuggestion,
              "retrieval_terms",
            ),
            retrieval_snippets: readStringArray(
              semanticSuggestion,
              "retrieval_snippets",
            ),
            table_semantics: asRecord(semanticSuggestion.table_semantics),
            image_understanding: asRecord(semanticSuggestion.image_understanding),
          },
        }
      : {}),
    sourceSummary: {
      candidateId: candidate.id,
      manuscriptId: candidate.manuscript_id ?? null,
      module: candidate.module,
      manuscriptType: candidate.manuscript_type,
      provenanceLabel: formatProvenanceLabel(candidate.governed_provenance_kind),
      sourceAssetId:
        candidate.snapshot_asset_id ??
        candidate.human_final_asset_id ??
        candidate.annotated_asset_id ??
        null,
      beforeFragment: beforeFragment ?? null,
      afterFragment: afterFragment ?? null,
      evidenceSummary: evidenceSummary ?? null,
      proposalText: candidate.proposal_text ?? null,
    },
  };
}

function buildCandidateContentBlockText(input: {
  canonicalText: string;
  beforeFragment?: string;
  afterFragment?: string;
  evidenceSummary?: string;
}): string {
  return [
    input.canonicalText,
    input.evidenceSummary ? `证据：${input.evidenceSummary}` : "",
    input.beforeFragment ? `原处理：${input.beforeFragment}` : "",
    input.afterFragment ? `确认处理：${input.afterFragment}` : "",
  ]
    .filter((value) => value.trim().length > 0)
    .join("\n\n");
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value != null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function readString(
  record: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readStringArray(
  record: Record<string, unknown> | undefined,
  key: string,
): string[] | undefined {
  const value = record?.[key];
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeModuleScope(
  value: string,
): CreateKnowledgeLibraryDraftInput["moduleScope"] {
  return value === "screening" || value === "editing" || value === "proofreading"
    ? value
    : "any";
}

function normalizeManuscriptTypes(
  value: string,
): CreateKnowledgeLibraryDraftInput["manuscriptTypes"] {
  return value.trim().length > 0 ? [value.trim() as never] : "any";
}

function normalizeKnowledgeKind(
  value?: string,
): CreateKnowledgeLibraryDraftInput["knowledgeKind"] {
  return value === "rule" ||
    value === "case_pattern" ||
    value === "checklist" ||
    value === "prompt_snippet" ||
    value === "reference" ||
    value === "other"
    ? value
    : "reference";
}

function normalizeEvidenceLevel(
  value?: string,
): CreateKnowledgeLibraryDraftInput["evidenceLevel"] {
  return value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "expert_opinion" ||
    value === "unknown"
    ? value
    : "unknown";
}

function normalizeSourceType(
  value?: string,
): CreateKnowledgeLibraryDraftInput["sourceType"] {
  return value === "paper" ||
    value === "guideline" ||
    value === "book" ||
    value === "website" ||
    value === "internal_case" ||
    value === "other"
    ? value
    : "internal_case";
}

function formatProvenanceLabel(
  value: LearningCandidateViewModel["governed_provenance_kind"],
): string {
  switch (value) {
    case "human_feedback":
      return "人工确认回流";
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
