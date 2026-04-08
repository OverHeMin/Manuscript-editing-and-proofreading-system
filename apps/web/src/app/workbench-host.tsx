import { useEffect, useState } from "react";
import type {
  AuthSessionViewModel,
  WorkbenchEntry,
  WorkbenchId,
} from "../features/auth/index.ts";
import { AdminGovernanceWorkbenchPage } from "../features/admin-governance/index.ts";
import { EvaluationWorkbenchPage } from "../features/evaluation-workbench/index.ts";
import { HarnessDatasetsWorkbenchPage } from "../features/harness-datasets/index.ts";
import { KnowledgeReviewWorkbenchPage } from "../features/knowledge-review/index.ts";
import { LearningReviewWorkbenchPage } from "../features/learning-review/index.ts";
import {
  ManuscriptWorkbenchPage,
  type ManuscriptWorkbenchMode,
} from "../features/manuscript-workbench/index.ts";
import { TemplateGovernanceWorkbenchPage } from "../features/template-governance/index.ts";
import {
  formatWorkbenchHash,
  isManuscriptWorkbenchId,
  resolveWorkbenchLocation,
  resolveWorkbenchRenderKind,
  type RuleCenterMode,
} from "./workbench-routing.ts";
import { WorkbenchShellHeader } from "./workbench-shell-header.tsx";
import { resolveResponsiveNavigationOpenState } from "./workbench-shell-layout.ts";
import { buildWorkbenchNavigationGroups } from "./workbench-navigation.ts";
import { WorkbenchNavigationMenu } from "./workbench-navigation-menu.tsx";

export interface WorkbenchHostProps {
  session: AuthSessionViewModel;
  onLogout?: () => void | Promise<void>;
  isLogoutPending?: boolean;
  noticeMessage?: string | null;
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
  const activeNavigationWorkbenchId = resolveNavigationWorkbenchId(
    activeWorkbenchId,
    visibleEntries,
  );
  const accessibleManuscriptWorkbenchModes = visibleEntries
    .map((entry) => entry.id)
    .filter((entry): entry is ManuscriptWorkbenchMode => isManuscriptWorkbenchId(entry));
  const canOpenLearningReview = visibleEntries.some(
    (entry) => entry.id === "learning-review",
  );
  const canOpenEvaluationWorkbench = visibleEntries.some(
    (entry) => entry.id === "evaluation-workbench",
  );
  const [isCompactNavigation, setIsCompactNavigation] = useState(false);
  const [isNavigationOpen, setIsNavigationOpen] = useState(true);

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

  const activeEntry =
    visibleEntries.find((entry) => entry.id === activeNavigationWorkbenchId) ??
    visibleEntries.find((entry) => entry.id === activeWorkbenchId) ??
    null;
  const navigationGroups = buildWorkbenchNavigationGroups(visibleEntries);
  const activeNavigationGroup =
    navigationGroups.find((group) =>
      group.items.some((item) => item.id === activeNavigationWorkbenchId),
    ) ?? null;
  const activeWorkbenchDescription = describeWorkbenchFocus(activeNavigationWorkbenchId);
  const activeWorkbenchGroupLabel = activeNavigationGroup?.label ?? "当前工作区";
  const activeRenderKind = resolveWorkbenchRenderKind(activeWorkbenchId);
  const hasRuleCenter = visibleEntries.some(
    (entry) => entry.id === "template-governance",
  );

  return (
    <main className="app-shell">
      <section className="workbench-host">
        <WorkbenchShellHeader
          session={session}
          activeWorkbenchLabel={activeEntry?.navLabel ?? activeEntry?.label ?? "工作台"}
          activeWorkbenchDescription={activeWorkbenchDescription}
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
              activeWorkbenchId={activeNavigationWorkbenchId}
              onNavigate={(workbenchId) => navigateToWorkbench(workbenchId)}
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
            prefilledReviewedCaseSnapshotId={routeState.reviewedCaseSnapshotId}
            prefilledSampleSetItemId={routeState.sampleSetItemId}
            accessibleHandoffModes={accessibleManuscriptWorkbenchModes}
            canOpenLearningReview={canOpenLearningReview}
            canOpenEvaluationWorkbench={canOpenEvaluationWorkbench}
          />
        );
      case "knowledge-review":
        return (
          <KnowledgeReviewWorkbenchPage
            actorRole={session.role}
            prefilledKnowledgeItemId={routeState.knowledgeItemId}
          />
        );
      case "learning-review":
        return hasRuleCenter && session.role === "admin" ? (
          <TemplateGovernanceWorkbenchPage
            actorRole={session.role}
            initialMode="learning"
            prefilledManuscriptId={routeState.manuscriptId}
            prefilledReviewedCaseSnapshotId={routeState.reviewedCaseSnapshotId}
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
            prefilledManuscriptId={routeState.manuscriptId}
          />
        );
      case "harness-datasets":
        return <HarnessDatasetsWorkbenchPage />;
      case "template-governance":
        return (
          <TemplateGovernanceWorkbenchPage
            actorRole={session.role}
            initialMode={routeState.ruleCenterMode ?? "authoring"}
            prefilledManuscriptId={routeState.manuscriptId}
            prefilledReviewedCaseSnapshotId={routeState.reviewedCaseSnapshotId}
          />
        );
      case "placeholder":
        return (
          <article className="workbench-placeholder" role="status">
            <h2>{activeEntry?.navLabel ?? activeEntry?.label ?? "工作台"}</h2>
            <p>该工作区已在导航中开放，但当前阶段尚未接入对应的 Web 实现。</p>
          </article>
        );
    }
  }

  function navigateToWorkbench(
    workbenchId: WorkbenchId,
    handoff?: {
      manuscriptId?: string;
      knowledgeItemId?: string;
      reviewedCaseSnapshotId?: string;
      sampleSetItemId?: string;
      ruleCenterMode?: RuleCenterMode;
    },
  ) {
    if (isCompactNavigation) {
      setIsNavigationOpen(false);
    }

    setRouteState({
      activeWorkbenchId: workbenchId,
      manuscriptId: handoff?.manuscriptId,
      knowledgeItemId: handoff?.knowledgeItemId,
      reviewedCaseSnapshotId: handoff?.reviewedCaseSnapshotId,
      sampleSetItemId: handoff?.sampleSetItemId,
      ruleCenterMode: handoff?.ruleCenterMode,
    });

    if (typeof window !== "undefined") {
      window.location.hash = formatWorkbenchHash(workbenchId, handoff);
    }
  }
}

function describeWorkbenchFocus(workbenchId: WorkbenchId): string {
  switch (workbenchId) {
    case "screening":
      return "围绕来稿接收、初筛判断与编辑移交，保持首个工作节点清晰可控。";
    case "editing":
      return "聚焦正文编辑、模板上下文与校对前准备，让编辑台保持轻而稳。";
    case "proofreading":
      return "将问题清单、终稿确认与发布前检查收束在同一终审工作面。";
    case "knowledge-review":
      return "把待审知识、证据视图与决策动作收进一个稳定的审核桌面。";
    case "learning-review":
      return "让学习候选、审核通过与知识回写之间的桥接路线更加顺手。";
    case "admin-console":
      return "管理模板、模型与运行时治理资产，同时保持治理区视觉安静。";
    case "template-governance":
      return "把规则录入、规则学习与模板上下文统一收进规则中心。";
    case "evaluation-workbench":
      return "用只读评测视图观察差异、历史窗口与证据结论，不打断主工作线。";
    case "harness-datasets":
      return "在受控管理区内处理金标数据集、发布版本与本地导出路径。";
    case "system-settings":
      return "系统级设置保持在独立管理位，避免干扰四条核心工作线。";
    case "submission":
    default:
      return "从统一壳层进入个人稿件与后续工作流，保持入口与后续线路一致。";
  }
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
): {
  activeWorkbenchId: WorkbenchId;
  manuscriptId?: string;
  knowledgeItemId?: string;
  reviewedCaseSnapshotId?: string;
  sampleSetItemId?: string;
  ruleCenterMode?: RuleCenterMode;
} {
  const location = resolveWorkbenchLocation(
    hash ?? (typeof window !== "undefined" ? window.location.hash : ""),
  );

  if (
    location.workbenchId &&
    visibleEntries.some((entry) => entry.id === location.workbenchId)
  ) {
    return {
      activeWorkbenchId: location.workbenchId,
      manuscriptId: location.manuscriptId,
      knowledgeItemId: location.knowledgeItemId,
      reviewedCaseSnapshotId: location.reviewedCaseSnapshotId,
      sampleSetItemId: location.sampleSetItemId,
      ruleCenterMode: location.ruleCenterMode,
    };
  }

  return {
    activeWorkbenchId: resolveInitialWorkbenchId(defaultWorkbench, visibleEntries),
  };
}

function resolveNavigationWorkbenchId(
  activeWorkbenchId: WorkbenchId,
  visibleEntries: readonly WorkbenchEntry[],
): WorkbenchId {
  if (
    activeWorkbenchId === "learning-review" &&
    visibleEntries.some((entry) => entry.id === "template-governance")
  ) {
    return "template-governance";
  }

  return activeWorkbenchId;
}
