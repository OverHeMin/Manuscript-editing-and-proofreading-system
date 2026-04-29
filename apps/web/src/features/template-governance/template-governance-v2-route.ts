import type {
  RuleCenterMode,
  TemplateGovernanceView,
} from "../../app/workbench-routing.ts";
import type { TemplateGovernanceV2RouteState } from "./template-governance-v2-types.ts";

export interface TemplateGovernanceV2RouteInput {
  templateGovernanceView?: TemplateGovernanceView;
  ruleCenterMode?: RuleCenterMode;
  learningCandidateId?: string;
  reviewItemId?: string;
  assetId?: string;
}

export function resolveTemplateGovernanceV2RouteState(
  input: TemplateGovernanceV2RouteInput,
): TemplateGovernanceV2RouteState {
  if (input.ruleCenterMode === "learning") {
    if (input.reviewItemId && input.reviewItemId.trim().length > 0) {
      return routeState({
        section: "recovery",
        panel: "review-item-detail",
        selectedKind: "review-item",
        selectedId: input.reviewItemId,
      });
    }

    return routeState({
      section: "recovery",
      panel:
        input.learningCandidateId && input.learningCandidateId.trim().length > 0
          ? "candidate-detail"
          : "none",
      selectedKind:
        input.learningCandidateId && input.learningCandidateId.trim().length > 0
          ? "learning-candidate"
          : "none",
      selectedId: input.learningCandidateId,
    });
  }

  if (input.ruleCenterMode === "ai-intake") {
    return routeState({
      section: "ai-intake",
      panel: "ai-intake",
    });
  }

  if (input.ruleCenterMode === "authoring") {
    return routeState({
      section: "rules",
      panel: "rule-wizard",
    });
  }

  const view = input.templateGovernanceView ?? "overview";

  if (view === "authoring") {
    return routeState({
      section: "rules",
      panel: "rule-wizard",
    });
  }

  if (view === "rule-ledger") {
    return routeState({
      section: "rules",
      panel: input.assetId ? "rule-detail" : "none",
      selectedKind: input.assetId ? "rule-ledger-row" : "none",
      selectedId: input.assetId,
    });
  }

  if (view === "large-template-ledger") {
    return routeState({
      section: "templates",
      subtype: "large",
    });
  }

  if (view === "journal-template-ledger") {
    return routeState({
      section: "templates",
      subtype: "journal",
    });
  }

  if (view === "general-package-ledger") {
    return routeState({
      section: "packages",
      subtype: "general",
    });
  }

  if (view === "medical-package-ledger") {
    return routeState({
      section: "packages",
      subtype: "medical",
    });
  }

  if (view === "extraction-ledger") {
    return routeState({
      section: "extraction",
      panel: input.assetId ? "extraction-detail" : "none",
      selectedKind: input.assetId ? "extraction-task" : "none",
      selectedId: input.assetId,
    });
  }

  if (view === "classic") {
    return routeState({
      section: "advanced",
      panel: "advanced-compatibility",
    });
  }

  return routeState({
    section: "dashboard",
  });
}

function routeState(
  partial: Partial<TemplateGovernanceV2RouteState> &
    Pick<TemplateGovernanceV2RouteState, "section">,
): TemplateGovernanceV2RouteState {
  return {
    section: partial.section,
    panel: partial.panel ?? "none",
    selectedKind: partial.selectedKind ?? "none",
    selectedId:
      partial.selectedId && partial.selectedId.trim().length > 0
        ? partial.selectedId
        : undefined,
    subtype: partial.subtype,
  };
}
