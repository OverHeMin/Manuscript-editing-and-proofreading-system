import {
  getManuscript,
  listManuscriptAssets,
  type ManuscriptHttpClient,
} from "../manuscripts/manuscript-api.ts";
import type {
  EditorialRuleExplanationPayload,
  EditorialRuleLinkagePayload,
  EditorialRuleProjectionPayload,
} from "../editorial-rules/types.ts";
import type { DocumentAssetViewModel, ManuscriptViewModel } from "../manuscripts/types.ts";
import type { AuthRole } from "../auth/roles.ts";
import type { TemplateModule } from "../templates/types.ts";
import {
  createRuleAuthoringDraft,
} from "../template-governance/rule-authoring-serialization.ts";
import type {
  AbstractRuleAuthoringDraft,
  RuleAuthoringDraft,
  RuleAuthoringObject,
  TableRuleAuthoringDraft,
} from "../template-governance/rule-authoring-types.ts";
import {
  isRuleAuthoringObject,
} from "../template-governance/rule-authoring-types.ts";
import type {
  CreateGovernedLearningCandidateInput,
  CreateReviewedCaseSnapshotInput,
  LearningCandidateViewModel,
} from "./types.ts";

export interface LoadLearningReviewPrefillInput {
  manuscriptId: string;
  actorRole: AuthRole;
}

export interface LearningReviewPrefillResult {
  status: string;
  snapshotForm: CreateReviewedCaseSnapshotInput;
  candidateForm: CreateGovernedLearningCandidateInput;
}

export interface BuildRuleAuthoringPrefillFromLearningCandidateInput {
  reviewedCaseSnapshotId?: string | null;
}

export interface RuleAuthoringPrefillFromLearningCandidate {
  module: TemplateModule;
  selectedTemplateFamilyId: string | null;
  selectedJournalTemplateId: string | null;
  reviewedCaseSnapshotId: string | null;
  sourceLearningCandidateId: string;
  ruleDraft: RuleAuthoringDraft;
  explanationPayload?: EditorialRuleExplanationPayload;
  linkagePayload: EditorialRuleLinkagePayload;
  projectionPayload?: EditorialRuleProjectionPayload;
}

export async function loadLearningReviewPrefill(
  client: ManuscriptHttpClient,
  input: LoadLearningReviewPrefillInput,
): Promise<LearningReviewPrefillResult> {
  const [manuscriptResponse, assetsResponse] = await Promise.all([
    getManuscript(client, input.manuscriptId),
    listManuscriptAssets(client, input.manuscriptId),
  ]);
  const manuscript = manuscriptResponse.body;
  const assets = sortAssetsForResolution(assetsResponse.body);
  const humanFinalAsset = resolveHumanFinalAsset(manuscript, assets);
  const annotatedAsset = resolveAnnotatedAsset(humanFinalAsset, assets);
  const requestedBy = input.actorRole === "admin" ? "admin-1" : "reviewer-1";

  return {
    status: `Prefilled learning review for manuscript ${manuscript.id}`,
    snapshotForm: {
      manuscriptId: manuscript.id,
      module: "proofreading",
      manuscriptType: manuscript.manuscript_type,
      humanFinalAssetId: humanFinalAsset.id,
      annotatedAssetId: annotatedAsset?.id,
      deidentificationPassed: true,
      requestedBy,
      storageKey: `learning/${manuscript.id}/reviewed-case-snapshot.bin`,
    },
    candidateForm: {
      snapshotId: "",
      type: "rule_candidate",
      title: "Terminology normalization candidate",
      proposalText: "Normalize endpoint terminology and statistics wording.",
      requestedBy,
      deidentificationPassed: true,
      governedSource: {
        sourceKind: "evaluation_experiment",
        reviewedCaseSnapshotId: "",
        evaluationRunId: `eval-${manuscript.id}`,
        evidencePackId: `evidence-${manuscript.id}`,
        sourceAssetId: humanFinalAsset.id,
      },
    },
  };
}

export function buildRuleAuthoringPrefillFromLearningCandidate(
  candidate: LearningCandidateViewModel,
  input: BuildRuleAuthoringPrefillFromLearningCandidateInput = {},
): RuleAuthoringPrefillFromLearningCandidate {
  const candidatePayload = asRecord(candidate.candidate_payload);
  const beforeFragment = extractString(candidatePayload, "before_fragment");
  const afterFragment = extractString(candidatePayload, "after_fragment");
  const evidenceSummary = extractString(candidatePayload, "evidence_summary");
  const rationale = candidate.proposal_text?.trim() || undefined;
  const ruleObject = resolveRuleAuthoringObject(candidate.suggested_rule_object);
  const ruleDraft = hydrateRuleAuthoringDraftFromCandidatePayload(
    createRuleAuthoringDraft(ruleObject),
    candidate,
    candidatePayload,
  );

  return {
    module: resolveTemplateModule(candidate.module),
    selectedTemplateFamilyId: candidate.suggested_template_family_id ?? null,
    selectedJournalTemplateId: candidate.suggested_journal_template_id ?? null,
    reviewedCaseSnapshotId: input.reviewedCaseSnapshotId?.trim() || null,
    sourceLearningCandidateId: candidate.id,
    ruleDraft,
    ...(rationale || beforeFragment || afterFragment || evidenceSummary
      ? {
          explanationPayload: {
            ...(rationale ? { rationale } : {}),
            ...(beforeFragment ? { incorrect_example: beforeFragment } : {}),
            ...(afterFragment ? { correct_example: afterFragment } : {}),
            ...(evidenceSummary
              ? {
                  review_prompt:
                    `Validate the governed learning evidence before publishing: ${evidenceSummary}`,
                }
              : {}),
          },
        }
      : {}),
    linkagePayload: {
      source_learning_candidate_id: candidate.id,
      ...(candidate.snapshot_asset_id
        ? { source_snapshot_asset_id: candidate.snapshot_asset_id }
        : {}),
    },
    ...(rationale || beforeFragment || afterFragment
      ? {
          projectionPayload: {
            projection_kind: "rule",
            ...(rationale ? { summary: rationale } : {}),
            ...(afterFragment ? { standard_example: afterFragment } : {}),
            ...(beforeFragment ? { incorrect_example: beforeFragment } : {}),
          },
        }
      : {}),
  };
}

function resolveHumanFinalAsset(
  manuscript: ManuscriptViewModel,
  assets: readonly DocumentAssetViewModel[],
): DocumentAssetViewModel {
  const currentAssetId = manuscript.current_proofreading_asset_id;
  if (currentAssetId) {
    const currentAsset = assets.find((asset) => asset.id === currentAssetId);
    if (currentAsset?.asset_type === "human_final_docx") {
      return currentAsset;
    }
  }

  const humanFinalAsset = assets.find((asset) => asset.asset_type === "human_final_docx");
  if (!humanFinalAsset) {
    throw new Error(
      `Manuscript ${manuscript.id} does not have a human-final asset available for learning review.`,
    );
  }

  return humanFinalAsset;
}

function resolveAnnotatedAsset(
  humanFinalAsset: DocumentAssetViewModel,
  assets: readonly DocumentAssetViewModel[],
): DocumentAssetViewModel | undefined {
  if (humanFinalAsset.parent_asset_id) {
    const parentAsset = assets.find((asset) => asset.id === humanFinalAsset.parent_asset_id);
    if (parentAsset?.asset_type === "final_proof_annotated_docx") {
      return parentAsset;
    }
  }

  return assets.find((asset) => asset.asset_type === "final_proof_annotated_docx");
}

function sortAssetsForResolution(
  assets: readonly DocumentAssetViewModel[],
): DocumentAssetViewModel[] {
  return [...assets].sort((left, right) => {
    if (left.is_current !== right.is_current) {
      return left.is_current ? -1 : 1;
    }

    if (left.created_at !== right.created_at) {
      return right.created_at.localeCompare(left.created_at);
    }

    if (left.version_no !== right.version_no) {
      return right.version_no - left.version_no;
    }

    return right.id.localeCompare(left.id);
  });
}

function resolveRuleAuthoringObject(value: string | undefined): RuleAuthoringObject {
  const candidate = value ?? "";
  return isRuleAuthoringObject(candidate) ? candidate : "manuscript_structure";
}

function resolveTemplateModule(value: string): TemplateModule {
  return value === "screening" || value === "proofreading" || value === "editing"
    ? value
    : "editing";
}

function hydrateRuleAuthoringDraftFromCandidatePayload(
  draft: RuleAuthoringDraft,
  candidate: LearningCandidateViewModel,
  candidatePayload: Record<string, unknown> | undefined,
): RuleAuthoringDraft {
  switch (draft.ruleObject) {
    case "abstract":
      return hydrateAbstractCandidateDraft(draft, candidatePayload);
    case "table":
      return hydrateTableCandidateDraft(draft, candidate, candidatePayload);
    case "manuscript_structure":
      return {
        ...draft,
        payload: {
          ...draft.payload,
          manuscriptType: candidate.manuscript_type,
        },
      };
    default:
      return draft;
  }
}

function hydrateAbstractCandidateDraft(
  draft: AbstractRuleAuthoringDraft,
  candidatePayload: Record<string, unknown> | undefined,
): AbstractRuleAuthoringDraft {
  const selector = asRecord(candidatePayload?.selector);
  const labelSelector = asRecord(selector?.label_selector);
  const action = asRecord(candidatePayload?.action);
  const sourceLabelText =
    extractString(candidatePayload, "before_fragment") ??
    extractString(labelSelector, "text") ??
    draft.payload.sourceLabelText;
  const normalizedLabelText =
    extractString(candidatePayload, "after_fragment") ??
    extractString(action, "to") ??
    draft.payload.normalizedLabelText;

  return {
    ...draft,
    payload: {
      ...draft.payload,
      labelRole: inferAbstractLabelRole(sourceLabelText),
      sourceLabelText,
      normalizedLabelText,
    },
  };
}

function hydrateTableCandidateDraft(
  draft: TableRuleAuthoringDraft,
  candidate: LearningCandidateViewModel,
  candidatePayload: Record<string, unknown> | undefined,
): TableRuleAuthoringDraft {
  const action = asRecord(candidatePayload?.action);
  const afterFragment = extractString(candidatePayload, "after_fragment") ?? "";
  const manualReviewReason =
    extractString(candidatePayload, "evidence_summary") ??
    candidate.proposal_text ??
    draft.payload.manualReviewReasonTemplate;
  const layoutSignals = [
    action?.forbid_vertical_rules === true || includesSignal(afterFragment, "竖线")
      ? "禁用竖线"
      : null,
    action?.place_table_notes_below === true || includesSignal(afterFragment, "表注")
      ? "表注置于表下"
      : null,
  ].filter((value): value is string => value != null);

  return {
    ...draft,
    manualReviewReasonTemplate: manualReviewReason,
    payload: {
      ...draft.payload,
      tableKind:
        action?.require_three_line_table === true || includesSignal(afterFragment, "三线表")
          ? "three_line_table"
          : draft.payload.tableKind,
      layoutRequirement:
        layoutSignals.length > 0
          ? layoutSignals.join("；")
          : draft.payload.layoutRequirement,
      manualReviewReasonTemplate: manualReviewReason,
    },
  };
}

function inferAbstractLabelRole(
  value: string,
): AbstractRuleAuthoringDraft["payload"]["labelRole"] {
  if (value.includes("方法")) {
    return "methods";
  }
  if (value.includes("结果")) {
    return "results";
  }
  if (value.includes("结论")) {
    return "conclusion";
  }

  return "objective";
}

function includesSignal(value: string, signal: string): boolean {
  return value.includes(signal);
}

function extractString(
  value: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const candidate = value?.[key];
  return typeof candidate === "string" && candidate.trim().length > 0
    ? candidate.trim()
    : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value != null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}
