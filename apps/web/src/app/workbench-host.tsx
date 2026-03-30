import { useEffect, useState } from "react";
import type {
  AuthSessionViewModel,
  WorkbenchEntry,
  WorkbenchId,
} from "../features/auth/index.ts";
import { AdminGovernanceWorkbenchPage } from "../features/admin-governance/index.ts";
import { KnowledgeReviewWorkbenchPage } from "../features/knowledge-review/index.ts";
import { LearningReviewWorkbenchPage } from "../features/learning-review/index.ts";
import { resolveWorkbenchRenderKind } from "./workbench-routing.ts";

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
  const [activeWorkbenchId, setActiveWorkbenchId] = useState<WorkbenchId>(() =>
    resolveInitialWorkbenchId(session.defaultWorkbench, visibleEntries),
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
      setActiveWorkbenchId(nextActiveWorkbenchId);
    }
  }, [activeWorkbenchId, session.defaultWorkbench, visibleEntries]);

  const activeEntry =
    visibleEntries.find((entry) => entry.id === activeWorkbenchId) ?? null;

  return (
    <main className="app-shell">
      <section className="workbench-host">
        <header className="workbench-header">
          <div className="workbench-header-topline">
            <div>
              <h1>Reviewer Workbench Host</h1>
              <p>
                Signed in as <strong>{session.displayName}</strong> ({session.username}) with role{" "}
                <code>{session.role}</code>.
              </p>
            </div>
            {onLogout ? (
              <button
                type="button"
                className="workbench-secondary-action"
                onClick={() => void onLogout()}
                disabled={isLogoutPending}
              >
                {isLogoutPending ? "Signing out..." : "Sign out"}
              </button>
            ) : null}
          </div>
        </header>

        <div className="workbench-layout">
          {noticeMessage ? (
            <article className="workbench-placeholder workbench-notice" role="alert">
              <h2>Session Action Error</h2>
              <p>{noticeMessage}</p>
            </article>
          ) : null}

          <aside className="workbench-nav" aria-label="Workbench navigation">
            <h2>Workbenches</h2>
            <ul className="workbench-nav-list">
              {visibleEntries.map((entry) => {
                const isActive = entry.id === activeWorkbenchId;
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      className={`workbench-nav-button${isActive ? " is-active" : ""}`}
                      onClick={() => setActiveWorkbenchId(entry.id)}
                    >
                      <span>{entry.label}</span>
                      <small>{entry.placement}</small>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <section className="workbench-content">{renderContent()}</section>
        </div>
      </section>
    </main>
  );

  function renderContent() {
    if (visibleEntries.length === 0) {
      return (
        <article className="workbench-placeholder" role="status">
          <h2>No Workbenches Available</h2>
          <p>This role currently has no web workbenches assigned.</p>
        </article>
      );
    }

    switch (resolveWorkbenchRenderKind(activeWorkbenchId)) {
      case "knowledge-review":
        return <KnowledgeReviewWorkbenchPage actorRole={session.role} />;
      case "learning-review":
        return <LearningReviewWorkbenchPage actorRole={session.role} />;
      case "admin-governance":
        return <AdminGovernanceWorkbenchPage actorRole={session.role} />;
      case "placeholder":
        return (
          <article className="workbench-placeholder" role="status">
            <h2>{activeEntry?.label ?? "Workbench"}</h2>
            <p>
              This workbench is visible for navigation, but its web implementation is not part of
              the current phase yet.
            </p>
          </article>
        );
    }
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
