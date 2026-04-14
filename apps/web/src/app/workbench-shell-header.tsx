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

function getRoleLabel(role: AuthSessionViewModel["role"]): string {
  switch (role) {
    case "admin":
      return "管理员";
    case "screener":
      return "初筛员";
    case "editor":
      return "编辑";
    case "proofreader":
      return "校对";
    case "knowledge_reviewer":
      return "知识审核员";
    case "user":
    default:
      return "投稿用户";
  }
}

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
          <p className="workbench-shell-brand-eyebrow">医学编辑中控台</p>
          <div className="workbench-shell-brand-copy">
            <h1>医学稿件处理系统</h1>
            <p className="workbench-shell-brand-summary">
              保持左侧导航、当前工作台焦点与会话状态统一收口，让页面主体回到实际处理任务。
            </p>
          </div>
          <p className="workbench-shell-session">
            当前账号 <strong>{session.displayName}</strong>
            <span>（{session.username}）</span>
            <span>角色</span>
            <code>{getRoleLabel(session.role)}</code>
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
              {isNavigationOpen ? "收起导航" : "展开导航"}
            </button>
          ) : null}

          {onLogout ? (
            <button
              type="button"
              className="workbench-secondary-action"
              onClick={() => void onLogout()}
              disabled={isLogoutPending}
            >
              {isLogoutPending ? "正在退出..." : "退出登录"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="workbench-header-focus">
        <article className="workbench-header-focus-card">
          <span>当前工作台</span>
          <strong>{activeWorkbenchLabel}</strong>
          <small>{activeWorkbenchGroupLabel}</small>
        </article>
        <p>{activeWorkbenchDescription}</p>
      </div>
    </header>
  );
}
