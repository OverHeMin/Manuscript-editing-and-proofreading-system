import { useEffect, useState } from "react";
import type {
  AuthSessionViewModel,
  WorkbenchEntry,
  WorkbenchId,
} from "../features/auth/index.ts";
import { AdminGovernanceWorkbenchPage } from "../features/admin-governance/index.ts";
import { EvaluationWorkbenchPage } from "../features/evaluation-workbench/index.ts";
import {
  KnowledgeLibraryLedgerPage,
  KnowledgeLibraryWorkbenchPage,
} from "../features/knowledge-library/index.ts";
import { KnowledgeReviewWorkbenchPage } from "../features/knowledge-review/index.ts";
import { LearningReviewWorkbenchPage } from "../features/learning-review/index.ts";
import {
  ManuscriptWorkbenchPage,
  type ManuscriptWorkbenchMode,
} from "../features/manuscript-workbench/index.ts";
import { ManuscriptHarnessPage } from "../features/manuscript-harness/index.ts";
import { SystemSettingsWorkbenchPage } from "../features/system-settings/index.ts";
import { TemplateGovernanceWorkbenchPage } from "../features/template-governance/index.ts";
import { resolveWorkbenchRuntimeMode } from "./persistent-session.ts";
import {
  formatWorkbenchHash,
  isManuscriptWorkbenchId,
  resolveKnowledgeLibraryEntryView,
  resolveWorkbenchLocation,
  resolveWorkbenchRenderKind,
  type WorkbenchHandoff,
} from "./workbench-routing.ts";
import {
  buildWorkbenchNavigationGroups,
  getWorkbenchNavigationTargetKey,
  type WorkbenchNavigationGroup,
  type WorkbenchNavigationItem,
  type WorkbenchNavigationTarget,
} from "./workbench-navigation.ts";
import { WorkbenchNavigationMenu } from "./workbench-navigation-menu.tsx";
import { resolveResponsiveNavigationOpenState } from "./workbench-shell-layout.ts";
import { WorkbenchShellHeader } from "./workbench-shell-header.tsx";

export interface WorkbenchHostProps {
  session: AuthSessionViewModel;
  onLogout?: () => void | Promise<void>;
  isLogoutPending?: boolean;
  noticeMessage?: string | null;
}

interface HostRouteState extends WorkbenchHandoff {
  activeWorkbenchId: WorkbenchId;
}

export function WorkbenchHost({
  session,
  onLogout,
  isLogoutPending = false,
  noticeMessage = null,
}: WorkbenchHostProps) {
  const visibleEntries = session.availableWorkbenchEntries;
  const [routeState, setRouteState] = useState(() =>
    resolveInitialWorkbenchRoute(session.defaultWorkbench, visibleEntries),
  );
  const activeWorkbenchId = routeState.activeWorkbenchId;
  const [isCompactNavigation, setIsCompactNavigation] = useState(false);
  const [isNavigationOpen, setIsNavigationOpen] = useState(true);

  const accessibleManuscriptWorkbenchModes = visibleEntries
    .map((entry) => entry.id)
    .filter((entry): entry is ManuscriptWorkbenchMode => isManuscriptWorkbenchId(entry));
  const hasRuleCenter = visibleEntries.some(
    (entry) => entry.id === "template-governance",
  );
  const canOpenLearningReview =
    hasRuleCenter || visibleEntries.some((entry) => entry.id === "learning-review");
  const canOpenEvaluationWorkbench = visibleEntries.some(
    (entry) => entry.id === "evaluation-workbench",
  );

  useEffect(() => {
    if (visibleEntries.length === 0) {
      return;
    }

    const nextActiveWorkbenchId = visibleEntries.some(
      (entry) => entry.id === activeWorkbenchId,
    )
      ? activeWorkbenchId
      : resolveInitialWorkbenchId(session.defaultWorkbench, visibleEntries);
    if (nextActiveWorkbenchId !== activeWorkbenchId) {
      setRouteState({
        activeWorkbenchId: nextActiveWorkbenchId,
        knowledgeView:
          nextActiveWorkbenchId === "knowledge-library"
            ? routeState.knowledgeView
            : undefined,
      });
    }
  }, [activeWorkbenchId, session.defaultWorkbench, visibleEntries]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    function handleHashChange() {
      setRouteState(
        resolveInitialWorkbenchRoute(
          session.defaultWorkbench,
          visibleEntries,
          window.location.hash,
        ),
      );
    }

    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [session.defaultWorkbench, visibleEntries]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 1024px)");

    function synchronizeNavigationLayout(nextCompactNavigation: boolean) {
      setIsCompactNavigation((previousCompactNavigation) => {
        setIsNavigationOpen((previousNavigationOpen) =>
          resolveResponsiveNavigationOpenState({
            isCompactNavigation: nextCompactNavigation,
            previousCompactNavigation,
            previousNavigationOpen,
          }),
        );

        return nextCompactNavigation;
      });
    }

    synchronizeNavigationLayout(mediaQuery.matches);

    const handleMediaChange = (event: MediaQueryListEvent) => {
      synchronizeNavigationLayout(event.matches);
    };

    mediaQuery.addEventListener("change", handleMediaChange);
    return () => {
      mediaQuery.removeEventListener("change", handleMediaChange);
    };
  }, []);

  const navigationGroups = buildWorkbenchNavigationGroups(visibleEntries);
  const activeNavigationItem =
    resolveActiveNavigationItem(routeState, navigationGroups) ??
    resolveFallbackNavigationItem(activeWorkbenchId, navigationGroups);
  const activeNavigationTargetKey = activeNavigationItem
    ? activeNavigationItem.targetKey
    : getWorkbenchNavigationTargetKey({
        workbenchId: activeWorkbenchId,
        settingsSection:
          activeWorkbenchId === "system-settings"
            ? routeState.settingsSection ?? "ai-access"
            : routeState.settingsSection,
        harnessSection:
          activeWorkbenchId === "evaluation-workbench"
            ? routeState.harnessSection ?? "overview"
            : routeState.harnessSection,
        harnessMode:
          activeWorkbenchId === "evaluation-workbench"
            ? routeState.harnessMode
            : undefined,
      });
  const activeNavigationGroup =
    navigationGroups.find((group) =>
      group.items.some((item) => item.targetKey === activeNavigationTargetKey),
    ) ?? null;
  const activeWorkbenchLabel =
    visibleEntries.find((entry) => entry.id === activeWorkbenchId)?.navLabel ??
    visibleEntries.find((entry) => entry.id === activeWorkbenchId)?.label ??
    activeNavigationItem?.label ??
    "工作台";
  const headerWorkbenchLabel =
    activeWorkbenchId === "harness-datasets" && activeNavigationItem != null
      ? activeNavigationItem.label
      : activeWorkbenchId === "harness-datasets"
      ? activeWorkbenchLabel
      : activeNavigationItem?.label ?? activeWorkbenchLabel;
  const activeWorkbenchGroupLabel = activeNavigationGroup?.label ?? "当前工作区";
  const activeRenderKind = resolveWorkbenchRenderKind(activeWorkbenchId);

  return (
    <main className="app-shell">
      <section className="workbench-host">
        <WorkbenchShellHeader
          session={session}
          activeWorkbenchLabel={headerWorkbenchLabel}
          activeWorkbenchGroupLabel={activeWorkbenchGroupLabel}
          isCompactNavigation={isCompactNavigation}
          isNavigationOpen={isNavigationOpen}
          onToggleNavigation={() => setIsNavigationOpen((current) => !current)}
          onLogout={onLogout}
          isLogoutPending={isLogoutPending}
        />

        <div className="workbench-layout">
          {noticeMessage ? (
            <article className="workbench-placeholder workbench-notice" role="alert">
              <h2>会话操作失败</h2>
              <p>{noticeMessage}</p>
            </article>
          ) : null}

          <aside
            id="workbench-navigation-panel"
            className={`workbench-nav${isCompactNavigation ? " is-compact" : ""}${isCompactNavigation && !isNavigationOpen ? " is-collapsed" : ""}`}
            aria-label="工作区导航"
          >
            <h2>工作区导航</h2>
            <WorkbenchNavigationMenu
              groups={navigationGroups}
              activeTargetKey={activeNavigationTargetKey}
              onNavigate={(target) => navigateToWorkbenchTarget(target)}
            />
          </aside>

          <section className={`workbench-content workbench-content--${activeRenderKind}`}>
            {renderContent()}
          </section>
        </div>
      </section>
    </main>
  );

  function renderContent() {
    if (visibleEntries.length === 0) {
      return (
        <article className="workbench-placeholder" role="status">
          <h2>暂无可用工作区</h2>
          <p>当前账号尚未分配可访问的 Web 工作区。</p>
        </article>
      );
    }

    switch (resolveWorkbenchRenderKind(activeWorkbenchId)) {
      case "manuscript-workbench":
        return (
          <ManuscriptWorkbenchPage
            key={activeWorkbenchId}
            actorRole={session.role}
            mode={activeWorkbenchId as ManuscriptWorkbenchMode}
            prefilledManuscriptId={routeState.manuscriptId}
            prefilledAssetId={routeState.assetId}
            prefilledPresentation={routeState.presentation}
            prefilledReviewedCaseSnapshotId={routeState.reviewedCaseSnapshotId}
            prefilledSampleSetItemId={routeState.sampleSetItemId}
            accessibleHandoffModes={accessibleManuscriptWorkbenchModes}
            canOpenLearningReview={canOpenLearningReview}
            canOpenEvaluationWorkbench={canOpenEvaluationWorkbench}
          />
        );
      case "knowledge-library":
        return resolveKnowledgeLibraryEntryView(routeState.knowledgeView) === "classic" ? (
          <KnowledgeLibraryWorkbenchPage
            actorRole={session.role}
            prefilledAssetId={routeState.assetId}
            prefilledRevisionId={routeState.revisionId}
          />
        ) : (
          <KnowledgeLibraryLedgerPage
            actorRole={session.role}
            prefilledAssetId={routeState.assetId}
            prefilledRevisionId={routeState.revisionId}
            prefilledKnowledgeTemplateId={routeState.knowledgePrefillTemplateId}
            prefilledLearningCandidateId={routeState.learningCandidateId}
            prefilledReviewItemId={routeState.reviewItemId}
          />
        );
      case "knowledge-review":
        return (
          <KnowledgeReviewWorkbenchPage
            actorRole={session.role}
            prefilledRevisionId={routeState.revisionId}
            prefilledAssetId={routeState.assetId ?? routeState.knowledgeItemId}
          />
        );
      case "learning-review":
        return hasRuleCenter && session.role === "admin" ? (
          <TemplateGovernanceWorkbenchPage
            actorRole={session.role}
            initialMode="learning"
            prefilledManuscriptId={routeState.manuscriptId}
            prefilledReviewedCaseSnapshotId={routeState.reviewedCaseSnapshotId}
            initialSelectedLearningCandidateId={routeState.learningCandidateId}
            initialSelectedReviewItemId={routeState.reviewItemId}
          />
        ) : (
          <LearningReviewWorkbenchPage
            actorRole={session.role}
            prefilledManuscriptId={routeState.manuscriptId}
          />
        );
      case "admin-governance":
        return <AdminGovernanceWorkbenchPage actorRole={session.role} />;
      case "evaluation-workbench":
        return (
          <EvaluationWorkbenchPage
            actorRole={session.role}
            section={routeState.harnessSection ?? "overview"}
            harnessMode={routeState.harnessMode}
            prefilledManuscriptId={routeState.manuscriptId}
          />
        );
      case "harness-datasets":
        return (
          <EvaluationWorkbenchPage
            actorRole={session.role}
            section="datasets"
            harnessMode="validation_sample_sets"
            prefilledManuscriptId={routeState.manuscriptId}
          />
        );
      case "manuscript-harness":
        return (
          <ManuscriptHarnessPage
            prefilledManuscriptId={routeState.manuscriptId}
          />
        );
      case "template-governance":
        return (
          <TemplateGovernanceWorkbenchPage
            actorRole={session.role}
            initialMode={routeState.ruleCenterMode ?? "authoring"}
            prefilledManuscriptId={routeState.manuscriptId}
            prefilledReviewedCaseSnapshotId={routeState.reviewedCaseSnapshotId}
            initialSelectedLearningCandidateId={routeState.learningCandidateId}
            initialSelectedReviewItemId={routeState.reviewItemId}
            initialView={routeState.templateGovernanceView ?? "overview"}
            initialSelectedRuleLedgerRowId={routeState.assetId}
          />
        );
      case "system-settings":
        return (
          <SystemSettingsWorkbenchPage
            runtimeMode={resolveWorkbenchRuntimeMode(
              ((import.meta as ImportMeta & {
                env?: Pick<ImportMetaEnv, "VITE_APP_ENV">;
              }).env ?? {}) as Pick<ImportMetaEnv, "VITE_APP_ENV">,
            )}
            section={routeState.settingsSection ?? "ai-access"}
          />
        );
      case "placeholder":
        return (
          <article className="workbench-placeholder" role="status">
            <h2>{activeWorkbenchLabel}</h2>
            <p>该工作区导航已开放，但当前阶段尚未接入对应的 Web 实现。</p>
          </article>
        );
    }
  }

  function navigateToWorkbenchTarget(target: WorkbenchNavigationTarget) {
    navigateToWorkbench(target.workbenchId, {
      settingsSection: target.settingsSection,
      harnessSection: target.harnessSection,
      harnessMode: target.harnessMode,
    });
  }

  function navigateToWorkbench(workbenchId: WorkbenchId, handoff?: WorkbenchHandoff) {
    if (isCompactNavigation) {
      setIsNavigationOpen(false);
    }

    setRouteState({
      activeWorkbenchId: workbenchId,
      manuscriptId: handoff?.manuscriptId,
      knowledgeItemId: handoff?.knowledgeItemId,
      assetId: handoff?.assetId,
      revisionId: handoff?.revisionId,
      learningCandidateId: handoff?.learningCandidateId,
      reviewItemId: handoff?.reviewItemId,
      knowledgeView: handoff?.knowledgeView,
      templateGovernanceView: handoff?.templateGovernanceView,
      reviewedCaseSnapshotId: handoff?.reviewedCaseSnapshotId,
      sampleSetItemId: handoff?.sampleSetItemId,
      ruleCenterMode: handoff?.ruleCenterMode,
      settingsSection: handoff?.settingsSection,
      harnessSection: handoff?.harnessSection,
      harnessMode: handoff?.harnessMode,
    });

    if (typeof window !== "undefined") {
      window.location.hash = formatWorkbenchHash(workbenchId, handoff);
    }
  }
}

function resolveActiveNavigationItem(
  routeState: HostRouteState,
  groups: readonly WorkbenchNavigationGroup[],
): WorkbenchNavigationItem | null {
  const effectiveWorkbenchId =
    routeState.activeWorkbenchId === "harness-datasets"
      ? "evaluation-workbench"
      : routeState.activeWorkbenchId;
  const effectiveSettingsSection =
    effectiveWorkbenchId === "system-settings"
      ? routeState.settingsSection ?? "ai-access"
      : routeState.settingsSection;
  const effectiveHarnessSection =
    routeState.activeWorkbenchId === "harness-datasets"
      ? "datasets"
      : effectiveWorkbenchId === "evaluation-workbench"
      ? routeState.harnessSection ?? "overview"
      : routeState.harnessSection;
  const effectiveHarnessMode =
    routeState.activeWorkbenchId === "harness-datasets"
      ? "ab_acceptance"
      : effectiveWorkbenchId === "evaluation-workbench"
      ? routeState.harnessMode
      : undefined;

  for (const group of groups) {
    for (const item of group.items) {
      if (item.target.workbenchId !== effectiveWorkbenchId) {
        continue;
      }

      if (
        item.target.settingsSection &&
        item.target.settingsSection !== effectiveSettingsSection
      ) {
        continue;
      }

      if (
        item.target.harnessSection &&
        item.target.harnessSection !== effectiveHarnessSection
      ) {
        continue;
      }

      if (
        item.target.harnessMode &&
        item.target.harnessMode !== effectiveHarnessMode
      ) {
        continue;
      }

      return item;
    }
  }

  return null;
}

function resolveFallbackNavigationItem(
  activeWorkbenchId: WorkbenchId,
  groups: readonly WorkbenchNavigationGroup[],
): WorkbenchNavigationItem | null {
  for (const group of groups) {
    const item = group.items.find((candidate) => candidate.id === activeWorkbenchId);
    if (item) {
      return item;
    }
  }

  return groups[0]?.items[0] ?? null;
}

function resolveInitialWorkbenchId(
  defaultWorkbench: WorkbenchId,
  visibleEntries: readonly WorkbenchEntry[],
): WorkbenchId {
  if (visibleEntries.some((entry) => entry.id === defaultWorkbench)) {
    return defaultWorkbench;
  }

  return visibleEntries[0]?.id ?? defaultWorkbench;
}

function resolveInitialWorkbenchRoute(
  defaultWorkbench: WorkbenchId,
  visibleEntries: readonly WorkbenchEntry[],
  hash?: string,
): HostRouteState {
  const location = resolveWorkbenchLocation(
    hash ?? (typeof window !== "undefined" ? window.location.hash : ""),
  );
  const hasRuleCenter = visibleEntries.some(
    (entry) => entry.id === "template-governance",
  );

  if (location.workbenchId === "learning-review" && hasRuleCenter) {
    return {
      activeWorkbenchId: "template-governance",
      manuscriptId: location.manuscriptId,
      knowledgeItemId: location.knowledgeItemId,
      assetId: location.assetId,
      revisionId: location.revisionId,
      learningCandidateId: location.learningCandidateId,
      reviewItemId: location.reviewItemId,
      templateGovernanceView: "rule-ledger",
      reviewedCaseSnapshotId: location.reviewedCaseSnapshotId,
      sampleSetItemId: location.sampleSetItemId,
      ruleCenterMode: "learning",
      settingsSection: location.settingsSection,
      harnessSection: location.harnessSection,
      harnessMode: location.harnessMode,
    };
  }

  if (
    location.workbenchId &&
    visibleEntries.some((entry) => entry.id === location.workbenchId)
  ) {
    return {
      activeWorkbenchId: location.workbenchId,
      manuscriptId: location.manuscriptId,
      knowledgeItemId: location.knowledgeItemId,
      assetId: location.assetId,
      revisionId: location.revisionId,
      learningCandidateId: location.learningCandidateId,
      reviewItemId: location.reviewItemId,
      knowledgeView: location.knowledgeView,
      templateGovernanceView: location.templateGovernanceView,
      reviewedCaseSnapshotId: location.reviewedCaseSnapshotId,
      sampleSetItemId: location.sampleSetItemId,
      ruleCenterMode: location.ruleCenterMode,
      settingsSection: location.settingsSection,
      harnessSection: location.harnessSection,
      harnessMode: location.harnessMode,
    };
  }

  return {
    activeWorkbenchId: resolveInitialWorkbenchId(defaultWorkbench, visibleEntries),
  };
}
