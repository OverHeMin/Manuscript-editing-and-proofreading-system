import type { ReactNode } from "react";
import type {
  RulePackageCompilePreviewViewModel,
  RulePackageCompileToDraftResultViewModel,
  RulePackageDraftViewModel,
} from "../editorial-rules/index.ts";
import { RulePackageCandidateList } from "./rule-package-candidate-list.tsx";
import { RulePackageCompilePanel } from "./rule-package-compile-panel.tsx";
import { RulePackagePreviewPanel } from "./rule-package-preview-panel.tsx";
import { RulePackageSemanticCards } from "./rule-package-semantic-cards.tsx";
import {
  getSelectedRulePackageDraft,
  getSelectedRulePackagePreview,
  type RulePackageAuthoringWorkspaceState,
} from "./rule-package-authoring-state.ts";

export interface RulePackageAuthoringShellProps {
  workspaceState: RulePackageAuthoringWorkspaceState | null;
  targetModule: string;
  isLoading: boolean;
  isPreviewRefreshing?: boolean;
  isCompilePreviewBusy?: boolean;
  isCompileBusy?: boolean;
  compilePreview?: RulePackageCompilePreviewViewModel | null;
  compileResult?: RulePackageCompileToDraftResultViewModel | null;
  canPreviewCompile?: boolean;
  canCompile?: boolean;
  loadErrorMessage?: string | null;
  onSelectPackage: (packageId: string) => void;
  onUpdateDraft?: (recipe: (draft: RulePackageDraftViewModel) => RulePackageDraftViewModel) => void;
  onRefreshPreview?: () => void;
  onPreviewCompile?: () => void;
  onCompileToDraft?: () => void;
  onOpenDraftRuleSet?: () => void;
  onOpenAdvancedRuleEditor?: () => void;
  onGoToPublishArea?: () => void;
  onToggleAdvancedEditor: () => void;
  advancedEditor?: ReactNode;
}

export function RulePackageAuthoringShell({
  workspaceState,
  targetModule,
  isLoading,
  isPreviewRefreshing = false,
  isCompilePreviewBusy = false,
  isCompileBusy = false,
  compilePreview = null,
  compileResult = null,
  canPreviewCompile = false,
  canCompile = false,
  loadErrorMessage = null,
  onSelectPackage,
  onUpdateDraft,
  onRefreshPreview,
  onPreviewCompile,
  onCompileToDraft,
  onOpenDraftRuleSet,
  onOpenAdvancedRuleEditor,
  onGoToPublishArea,
  onToggleAdvancedEditor,
  advancedEditor,
}: RulePackageAuthoringShellProps) {
  const selectedDraft = getSelectedRulePackageDraft(workspaceState);
  const selectedPreview = getSelectedRulePackagePreview(workspaceState);

  return (
    <section className="rule-package-workbench">
      {loadErrorMessage ? (
        <p className="template-governance-error" role="alert">
          {loadErrorMessage}
        </p>
      ) : null}

      {isLoading && workspaceState == null ? (
        <p className="template-governance-empty">
          Loading rule-package workspace...
        </p>
      ) : null}

      {workspaceState ? (
        <div className="rule-package-workbench-columns">
          <RulePackageCandidateList
            candidates={workspaceState.candidates}
            selectedPackageId={workspaceState.selectedPackageId}
            onSelectPackage={onSelectPackage}
          />
          <RulePackageSemanticCards
            packageDraft={selectedDraft}
            onUpdateDraft={onUpdateDraft}
          />
          <div className="rule-package-preview-stack">
            <RulePackagePreviewPanel
              preview={selectedPreview}
              isRefreshing={isPreviewRefreshing}
              onRefreshPreview={onRefreshPreview}
            />
            <RulePackageCompilePanel
              targetModule={targetModule}
              compilePreview={compilePreview}
              compileResult={compileResult}
              canPreview={canPreviewCompile}
              canCompile={canCompile}
              isPreviewBusy={isCompilePreviewBusy}
              isCompileBusy={isCompileBusy}
              onPreview={onPreviewCompile}
              onCompile={onCompileToDraft}
              onOpenDraftRuleSet={onOpenDraftRuleSet}
              onOpenAdvancedRuleEditor={onOpenAdvancedRuleEditor}
              onGoToPublishArea={onGoToPublishArea}
            />
          </div>
        </div>
      ) : !isLoading ? (
        <p className="template-governance-empty">
          Upload an original and edited example pair, or open the workbench from a reviewed-case snapshot.
        </p>
      ) : null}

      <div className="template-governance-actions">
        <button type="button" onClick={onToggleAdvancedEditor}>
          {workspaceState?.isAdvancedEditorVisible
            ? "Hide Advanced Rule Editor"
            : "Open Advanced Rule Editor"}
        </button>
      </div>

      {workspaceState?.isAdvancedEditorVisible ? advancedEditor : null}
    </section>
  );
}
