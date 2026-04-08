import type { AuthSessionViewModel } from "../features/auth/index.ts";

export interface WorkbenchShellHeaderProps {
  session: AuthSessionViewModel;
  activeWorkbenchLabel: string;
  activeWorkbenchDescription: string;
  activeWorkbenchGroupLabel: string;
  isCompactNavigation: boolean;
  isNavigationOpen: boolean;
  onToggleNavigation: () => void;
  onLogout?: () => void | Promise<void>;
  isLogoutPending?: boolean;
}

const shellPillars = ["Screening", "Editing", "Proofreading", "Knowledge"] as const;

export function WorkbenchShellHeader({
  session,
  activeWorkbenchLabel,
  activeWorkbenchDescription,
  activeWorkbenchGroupLabel,
  isCompactNavigation,
  isNavigationOpen,
  onToggleNavigation,
  onLogout,
  isLogoutPending = false,
}: WorkbenchShellHeaderProps) {
  return (
    <header className="workbench-header">
      <div className="workbench-header-topline">
        <div className="workbench-shell-brand">
          <p className="workbench-shell-brand-eyebrow">Medical Editorial Control Deck</p>
          <div className="workbench-shell-brand-main">
            <div className="workbench-shell-brand-copy">
              <h1>医学稿件处理系统</h1>
              <p className="workbench-shell-brand-summary">
                初筛、编辑、校对与知识库在同一工作壳层内协同推进，重点工作区始终保持清晰。
              </p>
            </div>
            <ul className="workbench-shell-pillar-list" aria-label="Primary work pillars">
              {shellPillars.map((pillar) => (
                <li key={pillar} className="workbench-shell-pillar">
                  {pillar}
                </li>
              ))}
            </ul>
          </div>
          <p className="workbench-shell-session">
            Signed in as <strong>{session.displayName}</strong> ({session.username}) with role{" "}
            <code>{session.role}</code>.
          </p>
        </div>

        <div className="workbench-header-actions">
          {isCompactNavigation ? (
            <button
              type="button"
              className="workbench-nav-toggle"
              aria-controls="workbench-navigation-panel"
              aria-expanded={isNavigationOpen}
              onClick={() => void onToggleNavigation()}
            >
              {isNavigationOpen ? "Hide workbench navigation" : "Open workbench navigation"}
            </button>
          ) : null}

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
      </div>

      <div className="workbench-header-focus">
        <article className="workbench-header-focus-card">
          <span>Current Desk</span>
          <strong>{activeWorkbenchLabel}</strong>
          <small>{activeWorkbenchGroupLabel}</small>
        </article>
        <p>{activeWorkbenchDescription}</p>
      </div>
    </header>
  );
}
