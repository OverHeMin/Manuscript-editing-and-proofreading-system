import type {
  RulePackageCompilePreviewViewModel,
  RulePackageCompileToDraftResultViewModel,
  RulePackageCandidateViewModel,
  RulePackageDraftViewModel,
  RulePackagePreviewViewModel,
  RulePackageWorkspaceSourceInputViewModel,
  RulePackageWorkspaceViewModel,
} from "../editorial-rules/index.ts";
import type { StoredRulePackageDraft } from "./rule-package-draft-storage.ts";

export type { RulePackageWorkspaceViewModel };

export interface RulePackageAuthoringWorkspaceState {
  source: RulePackageWorkspaceSourceInputViewModel;
  candidates: RulePackageCandidateViewModel[];
  selectedPackageId: string | null;
  editableDraftById: Record<string, RulePackageDraftViewModel>;
  previewById: Record<string, RulePackagePreviewViewModel | undefined>;
  compilePreview: RulePackageCompilePreviewViewModel | null;
  compileResult: RulePackageCompileToDraftResultViewModel | null;
  isAdvancedEditorVisible: boolean;
}

export function createRulePackageAuthoringWorkspaceState(
  workspace: RulePackageWorkspaceViewModel,
  options: {
    editableDraftById?: Record<string, RulePackageDraftViewModel>;
    previewById?: Record<string, RulePackagePreviewViewModel | undefined>;
    compilePreview?: RulePackageCompilePreviewViewModel | null;
    compileResult?: RulePackageCompileToDraftResultViewModel | null;
    selectedPackageId?: string | null;
    isAdvancedEditorVisible?: boolean;
  } = {},
): RulePackageAuthoringWorkspaceState {
  const editableDraftById = Object.fromEntries(
    workspace.candidates.map((candidate) => [
      candidate.package_id,
      options.editableDraftById?.[candidate.package_id] ?? toRulePackageDraft(candidate),
    ]),
  );
  const previewById = Object.fromEntries(
    workspace.candidates.map((candidate) => [
      candidate.package_id,
      options.previewById?.[candidate.package_id] ?? candidate.preview,
    ]),
  );
  const selectedPackageId = resolveSelectedPackageId(
    workspace.candidates,
    options.selectedPackageId ?? workspace.selectedPackageId ?? null,
  );

  return {
    source: cloneRulePackageWorkspaceSource(workspace.source),
    candidates: workspace.candidates,
    selectedPackageId,
    editableDraftById,
    previewById,
    compilePreview: options.compilePreview ?? null,
    compileResult: options.compileResult ?? null,
    isAdvancedEditorVisible: options.isAdvancedEditorVisible ?? false,
  };
}

export function rebaseRulePackageAuthoringWorkspaceState(
  workspace: RulePackageWorkspaceViewModel,
  currentState: RulePackageAuthoringWorkspaceState | null,
): RulePackageAuthoringWorkspaceState {
  return createRulePackageAuthoringWorkspaceState(workspace, {
    editableDraftById: currentState?.editableDraftById,
    previewById: currentState?.previewById,
    compilePreview: currentState?.compilePreview ?? null,
    compileResult: currentState?.compileResult ?? null,
    selectedPackageId: currentState?.selectedPackageId ?? null,
    isAdvancedEditorVisible: currentState?.isAdvancedEditorVisible ?? false,
  });
}

export function restoreRulePackageAuthoringWorkspaceState(
  workspace: RulePackageWorkspaceViewModel,
  storedDraft: StoredRulePackageDraft,
  currentState: RulePackageAuthoringWorkspaceState | null = null,
): RulePackageAuthoringWorkspaceState {
  return createRulePackageAuthoringWorkspaceState(workspace, {
    editableDraftById: storedDraft.editableDraftById,
    previewById: storedDraft.previewById,
    compilePreview: currentState?.compilePreview ?? null,
    compileResult: currentState?.compileResult ?? null,
    selectedPackageId: storedDraft.selectedPackageId,
    isAdvancedEditorVisible: currentState?.isAdvancedEditorVisible ?? false,
  });
}

export function serializeRulePackageAuthoringWorkspaceState(
  state: RulePackageAuthoringWorkspaceState,
  savedAt: string,
): StoredRulePackageDraft {
  return {
    version: 1,
    source: cloneRulePackageWorkspaceSource(state.source),
    selectedPackageId: state.selectedPackageId,
    editableDraftById: { ...state.editableDraftById },
    previewById: { ...state.previewById },
    savedAt,
  };
}

export function selectRulePackageWorkspaceCandidate(
  state: RulePackageAuthoringWorkspaceState,
  packageId: string,
): RulePackageAuthoringWorkspaceState {
  return {
    ...state,
    selectedPackageId: packageId,
  };
}

export function toggleRulePackageAdvancedEditor(
  state: RulePackageAuthoringWorkspaceState,
): RulePackageAuthoringWorkspaceState {
  return {
    ...state,
    isAdvancedEditorVisible: !state.isAdvancedEditorVisible,
  };
}

export function updateRulePackageSemanticDraft(
  state: RulePackageAuthoringWorkspaceState,
  packageId: string,
  recipe: (draft: RulePackageDraftViewModel) => RulePackageDraftViewModel,
): RulePackageAuthoringWorkspaceState {
  const fallbackCandidate =
    state.candidates.find((candidate) => candidate.package_id === packageId) ??
    state.candidates[0] ??
    null;
  if (!fallbackCandidate) {
    return state;
  }

  const currentDraft =
    state.editableDraftById[packageId] ?? toRulePackageDraft(fallbackCandidate);

  return {
    ...state,
    editableDraftById: {
      ...state.editableDraftById,
      [packageId]: recipe(currentDraft),
    },
    compilePreview: null,
    compileResult: null,
  };
}

export function setRulePackagePreview(
  state: RulePackageAuthoringWorkspaceState,
  packageId: string,
  preview: RulePackagePreviewViewModel,
): RulePackageAuthoringWorkspaceState {
  return {
    ...state,
    previewById: {
      ...state.previewById,
      [packageId]: preview,
    },
  };
}

export function setRulePackageCompilePreview(
  state: RulePackageAuthoringWorkspaceState,
  preview: RulePackageCompilePreviewViewModel | null,
): RulePackageAuthoringWorkspaceState {
  return {
    ...state,
    compilePreview: preview,
  };
}

export function setRulePackageCompileResult(
  state: RulePackageAuthoringWorkspaceState,
  result: RulePackageCompileToDraftResultViewModel | null,
): RulePackageAuthoringWorkspaceState {
  return {
    ...state,
    compileResult: result,
  };
}

export function getSelectedRulePackageCandidate(
  state: RulePackageAuthoringWorkspaceState | null,
): RulePackageCandidateViewModel | null {
  if (!state?.selectedPackageId) {
    return null;
  }

  return (
    state.candidates.find((candidate) => candidate.package_id === state.selectedPackageId) ??
    null
  );
}

export function getSelectedRulePackageDraft(
  state: RulePackageAuthoringWorkspaceState | null,
): RulePackageDraftViewModel | null {
  if (!state?.selectedPackageId) {
    return null;
  }

  return state.editableDraftById[state.selectedPackageId] ?? null;
}

export function getSelectedRulePackagePreview(
  state: RulePackageAuthoringWorkspaceState | null,
): RulePackagePreviewViewModel | null {
  if (!state?.selectedPackageId) {
    return null;
  }

  return state.previewById[state.selectedPackageId] ?? null;
}

export function buildRulePackagePreviewSampleText(
  draft: RulePackageDraftViewModel | null,
): string {
  if (!draft) {
    return "";
  }

  const semanticExample = draft.semantic_draft?.evidence_examples[0]?.before?.trim();
  if (semanticExample && semanticExample.length > 0) {
    return semanticExample;
  }

  const cardExample = draft.cards.evidence.examples[0]?.before?.trim();
  if (cardExample && cardExample.length > 0) {
    return cardExample;
  }

  const previewHit = draft.semantic_draft?.semantic_summary?.trim();
  if (previewHit && previewHit.length > 0) {
    return previewHit;
  }

  return draft.title;
}

function resolveSelectedPackageId(
  candidates: readonly RulePackageCandidateViewModel[],
  preferredPackageId: string | null,
): string | null {
  if (
    preferredPackageId &&
    candidates.some((candidate) => candidate.package_id === preferredPackageId)
  ) {
    return preferredPackageId;
  }

  return candidates[0]?.package_id ?? null;
}

function cloneRulePackageWorkspaceSource(
  source: RulePackageWorkspaceSourceInputViewModel,
): RulePackageWorkspaceSourceInputViewModel {
  return source.sourceKind === "reviewed_case"
    ? {
        sourceKind: "reviewed_case",
        reviewedCaseSnapshotId: source.reviewedCaseSnapshotId,
        ...(source.journalKey ? { journalKey: source.journalKey } : {}),
      }
    : {
        sourceKind: "uploaded_example_pair",
        exampleSourceSessionId: source.exampleSourceSessionId,
        ...(source.journalKey ? { journalKey: source.journalKey } : {}),
      };
}

function toRulePackageDraft(
  candidate: RulePackageCandidateViewModel,
): RulePackageDraftViewModel {
  return {
    ...candidate,
    preview: undefined,
  };
}
