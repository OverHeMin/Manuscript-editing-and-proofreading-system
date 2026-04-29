import { useEffect, useMemo, useState } from "react";
import { createBrowserHttpClient } from "../../lib/browser-http-client.ts";
import type {
  RuleCenterMode,
  TemplateGovernanceView,
} from "../../app/workbench-routing.ts";
import type { LearningCandidateViewModel } from "../learning-review/index.ts";
import type { ReviewItemViewModel } from "../review-items/index.ts";
import {
  createTemplateGovernanceWorkbenchController,
  type TemplateGovernanceWorkbenchController,
} from "./template-governance-controller.ts";
import { TemplateGovernanceV2DetailPanel } from "./template-governance-v2-detail-panel.tsx";
import {
  loadTemplateGovernanceV2SectionData,
  type TemplateGovernanceV2SectionData,
} from "./template-governance-v2-data.ts";
import { resolveTemplateGovernanceV2RouteState } from "./template-governance-v2-route.ts";
import { TemplateGovernanceV2Shell } from "./template-governance-v2-shell.tsx";
import type { TemplateGovernanceV2Command } from "./template-governance-v2-command-bar.tsx";
import type {
  TemplateGovernanceV2Panel,
  TemplateGovernanceV2RouteState,
  TemplateGovernanceV2Section,
} from "./template-governance-v2-types.ts";
import { TemplateGovernanceV2WorkQueue } from "./template-governance-v2-work-queue.tsx";

if (typeof document !== "undefined") {
  void import("./template-governance-v2-workbench.css");
}

const defaultController = createTemplateGovernanceWorkbenchController(
  createBrowserHttpClient(),
);

export interface TemplateGovernanceV2WorkbenchPageProps {
  controller?: TemplateGovernanceWorkbenchController;
  initialMode?: RuleCenterMode;
  initialView?: TemplateGovernanceView;
  initialSelectedRuleLedgerRowId?: string;
  initialSelectedLearningCandidateId?: string;
  initialSelectedReviewItemId?: string;
  initialLearningCandidates?: readonly LearningCandidateViewModel[];
  initialReviewItems?: readonly ReviewItemViewModel[];
  initialSectionData?: TemplateGovernanceV2SectionData | null;
}

export function TemplateGovernanceV2WorkbenchPage({
  controller = defaultController,
  initialMode,
  initialView = "overview",
  initialSelectedRuleLedgerRowId,
  initialSelectedLearningCandidateId,
  initialSelectedReviewItemId,
  initialLearningCandidates = [],
  initialReviewItems = [],
  initialSectionData = null,
}: TemplateGovernanceV2WorkbenchPageProps) {
  const initialRouteState = useMemo(
    () =>
      resolveTemplateGovernanceV2RouteState({
        templateGovernanceView: initialView,
        ruleCenterMode: initialMode,
        assetId: initialSelectedRuleLedgerRowId,
        learningCandidateId: initialSelectedLearningCandidateId,
        reviewItemId: initialSelectedReviewItemId,
      }),
    [
      initialMode,
      initialSelectedLearningCandidateId,
      initialSelectedReviewItemId,
      initialSelectedRuleLedgerRowId,
      initialView,
    ],
  );
  const [routeState, setRouteState] =
    useState<TemplateGovernanceV2RouteState>(initialRouteState);
  const [sectionData, setSectionData] =
    useState<TemplateGovernanceV2SectionData | null>(initialSectionData);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (initialSectionData) {
      return;
    }

    let isMounted = true;
    void loadTemplateGovernanceV2SectionData(controller, routeState)
      .then((nextData) => {
        if (isMounted) {
          setSectionData(nextData);
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setLoadError(error instanceof Error ? error.message : "规则中心加载失败。");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [controller, initialSectionData, routeState]);

  const counts = createSectionCounts(sectionData, {
    initialLearningCandidates,
    initialReviewItems,
  });

  function handleSectionChange(section: TemplateGovernanceV2Section) {
    setRouteState(createRouteStateForSection(section));
    setSectionData(null);
  }

  function handleCommand(command: TemplateGovernanceV2Command) {
    setRouteState(createRouteStateForCommand(command));
    setSectionData(null);
  }

  function handleSelectItem(input: {
    selectedKind: TemplateGovernanceV2RouteState["selectedKind"];
    selectedId: string;
    panel: TemplateGovernanceV2Panel;
  }) {
    setRouteState({
      ...routeState,
      panel: input.panel,
      selectedKind: input.selectedKind,
      selectedId: input.selectedId,
    });
  }

  return (
    <TemplateGovernanceV2Shell
      activeSection={routeState.section}
      activePanel={routeState.panel}
      counts={counts}
      onSectionChange={handleSectionChange}
      onCommand={handleCommand}
      detailPanel={
        <TemplateGovernanceV2DetailPanel
          data={sectionData}
          routeState={routeState}
          initialSelectedLearningCandidateId={initialSelectedLearningCandidateId}
          initialSelectedReviewItemId={initialSelectedReviewItemId}
        />
      }
    >
      {loadError ? (
        <p className="template-governance-error" role="alert">
          {loadError}
        </p>
      ) : null}
      <TemplateGovernanceV2WorkQueue
        data={sectionData}
        routeState={routeState}
        onSelectItem={handleSelectItem}
      />
    </TemplateGovernanceV2Shell>
  );
}

function createSectionCounts(
  data: TemplateGovernanceV2SectionData | null,
  input: {
    initialLearningCandidates: readonly LearningCandidateViewModel[];
    initialReviewItems: readonly ReviewItemViewModel[];
  },
): Partial<Record<TemplateGovernanceV2Section, number>> {
  if (!data) {
    return {
      recovery: input.initialLearningCandidates.length + input.initialReviewItems.length,
    };
  }

  switch (data.section) {
    case "rules":
      return { rules: data.ledger.rows.length };
    case "templates":
      return {
        templates:
          data.subtype === "large"
            ? data.ledger.templates.length
            : data.overview.journalTemplateProfiles.length,
      };
    case "packages":
      return { packages: data.ledger.modules.length };
    case "extraction":
      return { extraction: data.ledger.tasks.length };
    case "recovery":
      return { recovery: data.candidates.length + data.reviewItems.length };
    case "release":
      return { release: data.overview.ruleSets.length };
    case "dashboard":
      return {
        dashboard:
          data.overview.ruleSets.length +
          data.overview.templateFamilies.length +
          data.overview.journalTemplateProfiles.length,
      };
    default:
      return {};
  }
}

function createRouteStateForSection(
  section: TemplateGovernanceV2Section,
): TemplateGovernanceV2RouteState {
  return {
    section,
    panel: section === "advanced" ? "advanced-compatibility" : "none",
    selectedKind: "none",
    selectedId: undefined,
    subtype:
      section === "templates" ? "large" : section === "packages" ? "general" : undefined,
  };
}

function createRouteStateForCommand(
  command: TemplateGovernanceV2Command,
): TemplateGovernanceV2RouteState {
  switch (command) {
    case "new-rule":
      return {
        section: "rules",
        panel: "rule-wizard",
        selectedKind: "none",
        selectedId: undefined,
        subtype: undefined,
      };
    case "new-ai-rule":
      return {
        section: "ai-intake",
        panel: "ai-intake",
        selectedKind: "none",
        selectedId: undefined,
        subtype: undefined,
      };
    case "import-extraction":
      return {
        section: "extraction",
        panel: "extraction-detail",
        selectedKind: "none",
        selectedId: undefined,
        subtype: undefined,
      };
    case "review-candidates":
      return {
        section: "recovery",
        panel: "none",
        selectedKind: "none",
        selectedId: undefined,
        subtype: undefined,
      };
    case "release-check":
      return {
        section: "release",
        panel: "release-check",
        selectedKind: "none",
        selectedId: undefined,
        subtype: undefined,
      };
  }
}
