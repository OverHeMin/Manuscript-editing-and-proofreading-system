import type { LearningCandidateViewModel } from "../learning-review/index.ts";
import type { ReviewItemViewModel } from "../review-items/index.ts";
import type {
  TemplateGovernanceContentModuleLedgerViewModel,
  TemplateGovernanceExtractionLedgerViewModel,
  TemplateGovernanceTemplateLedgerViewModel,
  TemplateGovernanceWorkbenchController,
  TemplateGovernanceWorkbenchOverview,
} from "./template-governance-controller.ts";
import type { TemplateGovernanceRuleLedgerViewModel } from "./template-governance-ledger-types.ts";
import type {
  TemplateGovernanceV2RouteState,
  TemplateGovernanceV2Subtype,
} from "./template-governance-v2-types.ts";

export type TemplateGovernanceV2SectionData =
  | {
      section: "dashboard";
      overview: TemplateGovernanceWorkbenchOverview;
    }
  | {
      section: "rules";
      overview: TemplateGovernanceWorkbenchOverview;
      ledger: TemplateGovernanceRuleLedgerViewModel;
    }
  | {
      section: "templates";
      subtype: "large";
      ledger: TemplateGovernanceTemplateLedgerViewModel;
    }
  | {
      section: "templates";
      subtype: "journal";
      overview: TemplateGovernanceWorkbenchOverview;
    }
  | {
      section: "packages";
      subtype: "general" | "medical";
      ledger: TemplateGovernanceContentModuleLedgerViewModel;
    }
  | {
      section: "extraction";
      ledger: TemplateGovernanceExtractionLedgerViewModel;
    }
  | {
      section: "recovery";
      candidates: LearningCandidateViewModel[];
      reviewItems: ReviewItemViewModel[];
    }
  | {
      section: "release";
      overview: TemplateGovernanceWorkbenchOverview;
    }
  | {
      section: "advanced";
      overview: TemplateGovernanceWorkbenchOverview;
    }
  | {
      section: "ai-intake";
      overview: TemplateGovernanceWorkbenchOverview;
    };

export async function loadTemplateGovernanceV2SectionData(
  controller: TemplateGovernanceWorkbenchController,
  routeState: TemplateGovernanceV2RouteState,
): Promise<TemplateGovernanceV2SectionData> {
  if (routeState.section === "rules") {
    const [overview, ledger] = await Promise.all([
      controller.loadOverview(),
      controller.loadRuleLedger({
        selectedRowId:
          routeState.selectedKind === "rule-ledger-row"
            ? routeState.selectedId
            : undefined,
      }),
    ]);

    return { section: "rules", overview, ledger };
  }

  if (routeState.section === "templates") {
    if (routeState.subtype === "journal") {
      return {
        section: "templates",
        subtype: "journal",
        overview: await controller.loadOverview(),
      };
    }

    return {
      section: "templates",
      subtype: "large",
      ledger: await controller.loadTemplateLedger({
        selectedTemplateId:
          routeState.selectedKind === "template" ? routeState.selectedId : undefined,
      }),
    };
  }

  if (routeState.section === "packages") {
    const subtype = resolvePackageSubtype(routeState.subtype);

    return {
      section: "packages",
      subtype,
      ledger: await controller.loadContentModuleLedger({
        moduleClass: subtype === "medical" ? "medical_specialized" : "general",
        selectedModuleId:
          routeState.selectedKind === "package" ? routeState.selectedId : undefined,
      }),
    };
  }

  if (routeState.section === "extraction") {
    return {
      section: "extraction",
      ledger: await controller.loadExtractionLedger({
        selectedTaskId:
          routeState.selectedKind === "extraction-task"
            ? routeState.selectedId
            : undefined,
      }),
    };
  }

  if (routeState.section === "recovery") {
    const [candidates, reviewItems] = await Promise.all([
      controller.loadLearningCandidates?.() ?? Promise.resolve([]),
      controller.loadReviewItems?.() ?? Promise.resolve([]),
    ]);

    return {
      section: "recovery",
      candidates,
      reviewItems,
    };
  }

  if (routeState.section === "release") {
    return {
      section: "release",
      overview: await controller.loadOverview(),
    };
  }

  if (routeState.section === "advanced") {
    return {
      section: "advanced",
      overview: await controller.loadOverview(),
    };
  }

  if (routeState.section === "ai-intake") {
    return {
      section: "ai-intake",
      overview: await controller.loadOverview(),
    };
  }

  return {
    section: "dashboard",
    overview: await controller.loadOverview(),
  };
}

function resolvePackageSubtype(
  subtype: TemplateGovernanceV2Subtype | undefined,
): "general" | "medical" {
  return subtype === "medical" ? "medical" : "general";
}
