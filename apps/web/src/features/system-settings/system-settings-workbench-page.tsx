import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { createBrowserHttpClient, BrowserHttpClientError } from "../../lib/browser-http-client.ts";
import {
  resolveWorkbenchRuntimeMode,
  type WorkbenchRuntimeMode,
} from "../../app/persistent-session.ts";
import type { AuthRole } from "../auth/index.ts";
import {
  createSystemSettingsWorkbenchController,
  type SystemSettingsWorkbenchController,
} from "./system-settings-controller.ts";
import type {
  SystemSettingsUserViewModel,
  SystemSettingsWorkbenchOverview,
} from "./types.ts";

if (typeof document !== "undefined") {
  void import("./system-settings-workbench.css");
}

const defaultController = createSystemSettingsWorkbenchController(
  createBrowserHttpClient(),
);
const accountRoles: AuthRole[] = [
  "admin",
  "screener",
  "editor",
  "proofreader",
  "knowledge_reviewer",
  "user",
];

interface CreateAccountFormState {
  username: string;
  displayName: string;
  role: AuthRole;
  password: string;
}

interface SelectedAccountFormState {
  displayName: string;
  role: AuthRole;
}

export interface SystemSettingsWorkbenchPageProps {
  controller?: SystemSettingsWorkbenchController;
  runtimeMode?: WorkbenchRuntimeMode;
  initialOverview?: SystemSettingsWorkbenchOverview | null;
  initialErrorMessage?: string | null;
}

export function SystemSettingsWorkbenchPage({
  controller = defaultController,
  runtimeMode = resolveWorkbenchRuntimeMode(import.meta.env),
  initialOverview = null,
  initialErrorMessage = null,
}: SystemSettingsWorkbenchPageProps) {
  const [overview, setOverview] = useState<SystemSettingsWorkbenchOverview | null>(
    initialOverview,
  );
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "ready" | "error">(
    initialErrorMessage ? "error" : initialOverview ? "ready" : "idle",
  );
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialErrorMessage);
  const [createForm, setCreateForm] = useState<CreateAccountFormState>({
    username: "",
    displayName: "",
    role: "editor",
    password: "",
  });
  const [selectedForm, setSelectedForm] = useState<SelectedAccountFormState>({
    displayName: initialOverview?.selectedUser?.displayName ?? "",
    role: initialOverview?.selectedUser?.role ?? "editor",
  });
  const [passwordResetValue, setPasswordResetValue] = useState("");

  useEffect(() => {
    if (runtimeMode !== "persistent") {
      return;
    }

    if (initialOverview) {
      synchronizeSelectedForms(initialOverview.selectedUser);
      return;
    }

    void loadOverview();
  }, [controller, initialOverview, runtimeMode]);

  function applyOverview(nextOverview: SystemSettingsWorkbenchOverview) {
    setOverview(nextOverview);
    synchronizeSelectedForms(nextOverview.selectedUser);
  }

  function synchronizeSelectedForms(selectedUser: SystemSettingsUserViewModel | null) {
    setSelectedForm({
      displayName: selectedUser?.displayName ?? "",
      role: selectedUser?.role ?? "editor",
    });
    setPasswordResetValue("");
  }

  async function loadOverview(input: { selectedUserId?: string | null } = {}) {
    setLoadStatus("loading");
    setErrorMessage(null);

    try {
      const nextOverview = await controller.loadOverview({
        selectedUserId: input.selectedUserId ?? overview?.selectedUserId,
      });
      applyOverview(nextOverview);
      setLoadStatus("ready");
    } catch (error) {
      setLoadStatus("error");
      setErrorMessage(toErrorMessage(error, "账号列表加载失败"));
    }
  }

  async function runAction(
    action: () => Promise<SystemSettingsWorkbenchOverview>,
    successMessage: string,
  ) {
    setIsBusy(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const nextOverview = await action();
      applyOverview(nextOverview);
      setLoadStatus("ready");
      setStatusMessage(successMessage);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "账号管理操作失败"));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      createForm.username.trim().length === 0 ||
      createForm.displayName.trim().length === 0 ||
      createForm.password.trim().length === 0
    ) {
      setErrorMessage("请完整填写新账号信息。");
      return;
    }

    await runAction(async () => {
      const result = await controller.createUserAndReload({
        username: createForm.username.trim(),
        displayName: createForm.displayName.trim(),
        role: createForm.role,
        password: createForm.password,
      });
      setCreateForm({
        username: "",
        displayName: "",
        role: "editor",
        password: "",
      });
      return result.overview;
    }, "新账号已创建。");
  }

  async function handleUpdateSelectedUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedUser = overview?.selectedUser;
    if (!selectedUser) {
      setErrorMessage("请先选择要维护的账号。");
      return;
    }

    if (selectedForm.displayName.trim().length === 0) {
      setErrorMessage("显示名称不能为空。");
      return;
    }

    await runAction(async () => {
      const result = await controller.updateUserProfileAndReload({
        userId: selectedUser.id,
        input: {
          displayName: selectedForm.displayName.trim(),
          role: selectedForm.role,
        },
        selectedUserId: selectedUser.id,
      });
      return result.overview;
    }, "账号信息已更新。");
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedUser = overview?.selectedUser;
    if (!selectedUser) {
      setErrorMessage("请先选择要重置密码的账号。");
      return;
    }

    if (passwordResetValue.trim().length === 0) {
      setErrorMessage("请输入新的登录密码。");
      return;
    }

    await runAction(async () => {
      const result = await controller.resetUserPasswordAndReload({
        userId: selectedUser.id,
        nextPassword: passwordResetValue,
        selectedUserId: selectedUser.id,
      });
      return result.overview;
    }, "登录密码已重置。");
  }

  async function handleToggleAccountStatus() {
    const selectedUser = overview?.selectedUser;
    if (!selectedUser) {
      setErrorMessage("请先选择要处理的账号。");
      return;
    }

    await runAction(async () => {
      const result =
        selectedUser.status === "disabled"
          ? await controller.enableUserAndReload({
              userId: selectedUser.id,
              selectedUserId: selectedUser.id,
            })
          : await controller.disableUserAndReload({
              userId: selectedUser.id,
              selectedUserId: selectedUser.id,
            });
      return result.overview;
    }, selectedUser.status === "disabled" ? "账号已启用。" : "账号已停用。");
  }

  function selectUser(userId: string) {
    if (!overview) {
      return;
    }

    const selectedUser = overview.users.find((user) => user.id === userId) ?? null;
    if (!selectedUser) {
      return;
    }

    applyOverview({
      ...overview,
      selectedUserId: selectedUser.id,
      selectedUser,
    });
    setStatusMessage(null);
    setErrorMessage(null);
  }

  if (runtimeMode === "demo") {
    return (
      <section className="system-settings-workbench">
        <header className="system-settings-hero">
          <p className="system-settings-kicker">系统设置</p>
          <h2>账号管理</h2>
          <p>当前演示模式不提供账号管理能力。</p>
        </header>
        <article className="system-settings-panel system-settings-notice" role="status">
          <h3>暂不支持</h3>
          <p>请连接持久化后端后再进行管理员账号维护。</p>
        </article>
      </section>
    );
  }

  return (
    <section className="system-settings-workbench">
      <header className="system-settings-hero">
        <p className="system-settings-kicker">系统设置</p>
        <h2>账号管理</h2>
        <p>集中维护内测环境账号、角色权限和可登录状态。</p>
      </header>

      {statusMessage ? (
        <article className="system-settings-panel system-settings-status" role="status">
          <p>{statusMessage}</p>
        </article>
      ) : null}

      {errorMessage ? (
        <article className="system-settings-panel system-settings-error" role="alert">
          <p>{errorMessage}</p>
        </article>
      ) : null}

      {overview ? (
        <>
          <section className="system-settings-summary-grid">
            <article className="system-settings-card">
              <span>账号总数</span>
              <strong>{overview.summary.totalUsers}</strong>
            </article>
            <article className="system-settings-card">
              <span>启用中</span>
              <strong>{overview.summary.activeUsers}</strong>
            </article>
            <article className="system-settings-card">
              <span>已停用</span>
              <strong>{overview.summary.disabledUsers}</strong>
            </article>
            <article className="system-settings-card">
              <span>管理员</span>
              <strong>{overview.summary.adminUsers}</strong>
            </article>
          </section>

          <div className="system-settings-layout">
            <article className="system-settings-panel">
              <div className="system-settings-panel-header">
                <div>
                  <h3>账号列表</h3>
                  <p>选择一个账号以查看并修改它的当前状态。</p>
                </div>
                <button type="button" onClick={() => void loadOverview()} disabled={isBusy}>
                  刷新列表
                </button>
              </div>
              <ul className="system-settings-user-list">
                {overview.users.map((user) => {
                  const isActive = user.id === overview.selectedUserId;
                  return (
                    <li key={user.id}>
                      <button
                        type="button"
                        className={`system-settings-user-row${isActive ? " is-active" : ""}`}
                        onClick={() => selectUser(user.id)}
                      >
                        <span>{user.displayName}</span>
                        <small>
                          {user.username} · {formatRoleLabel(user.role)} ·{" "}
                          {formatStatusLabel(user.status)}
                        </small>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </article>

            <article className="system-settings-panel">
              <div className="system-settings-panel-header">
                <div>
                  <h3>创建账号</h3>
                  <p>只修改持久化账号数据，不会影响系统核心运行链路。</p>
                </div>
              </div>
              <form className="system-settings-form-grid" onSubmit={handleCreateAccount}>
                <label className="system-settings-field">
                  <span>用户名</span>
                  <input
                    value={createForm.username}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        username: event.target.value,
                      }))
                    }
                    placeholder="operator.name"
                  />
                </label>
                <label className="system-settings-field">
                  <span>显示名称</span>
                  <input
                    value={createForm.displayName}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        displayName: event.target.value,
                      }))
                    }
                    placeholder="运营管理员"
                  />
                </label>
                <label className="system-settings-field">
                  <span>角色</span>
                  <select
                    value={createForm.role}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        role: event.target.value as AuthRole,
                      }))
                    }
                  >
                    {accountRoles.map((role) => (
                      <option key={role} value={role}>
                        {formatRoleLabel(role)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="system-settings-field">
                  <span>初始密码</span>
                  <input
                    type="password"
                    value={createForm.password}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    placeholder="请输入初始密码"
                  />
                </label>
                <div className="system-settings-actions system-settings-actions-full">
                  <button type="submit" disabled={isBusy}>
                    {isBusy ? "提交中..." : "创建账号"}
                  </button>
                </div>
              </form>
            </article>

            <article className="system-settings-panel">
              <div className="system-settings-panel-header">
                <div>
                  <h3>账号操作</h3>
                  <p>
                    {overview.selectedUser
                      ? `当前选中：${overview.selectedUser.displayName}（${overview.selectedUser.username}）`
                      : "请选择一个账号后再执行管理操作。"}
                  </p>
                </div>
              </div>

              {overview.selectedUser ? (
                <>
                  <form className="system-settings-form-grid" onSubmit={handleUpdateSelectedUser}>
                    <label className="system-settings-field">
                      <span>修改账号信息</span>
                      <input
                        value={selectedForm.displayName}
                        onChange={(event) =>
                          setSelectedForm((current) => ({
                            ...current,
                            displayName: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="system-settings-field">
                      <span>角色</span>
                      <select
                        value={selectedForm.role}
                        onChange={(event) =>
                          setSelectedForm((current) => ({
                            ...current,
                            role: event.target.value as AuthRole,
                          }))
                        }
                      >
                        {accountRoles.map((role) => (
                          <option key={role} value={role}>
                            {formatRoleLabel(role)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="system-settings-actions system-settings-actions-full">
                      <button type="submit" disabled={isBusy}>
                        保存账号信息
                      </button>
                    </div>
                  </form>

                  <form className="system-settings-form-grid" onSubmit={handleResetPassword}>
                    <label className="system-settings-field">
                      <span>重置登录密码</span>
                      <input
                        type="password"
                        value={passwordResetValue}
                        onChange={(event) => setPasswordResetValue(event.target.value)}
                        placeholder="输入新的登录密码"
                      />
                    </label>
                    <div className="system-settings-actions system-settings-actions-full">
                      <button type="submit" disabled={isBusy}>
                        提交新密码
                      </button>
                    </div>
                  </form>

                  <div className="system-settings-actions">
                    <button type="button" disabled={isBusy} onClick={() => void handleToggleAccountStatus()}>
                      {overview.selectedUser.status === "disabled"
                        ? "启用该账号"
                        : "停用该账号"}
                    </button>
                  </div>
                </>
              ) : (
                <p className="system-settings-empty">当前没有可维护的账号记录。</p>
              )}
            </article>
          </div>
        </>
      ) : loadStatus === "loading" || loadStatus === "idle" ? (
        <article className="system-settings-panel" role="status">
          <p>正在加载账号列表...</p>
        </article>
      ) : null}
    </section>
  );
}

function formatRoleLabel(role: AuthRole): string {
  switch (role) {
    case "admin":
      return "管理员";
    case "screener":
      return "筛查员";
    case "editor":
      return "编辑";
    case "proofreader":
      return "校对";
    case "knowledge_reviewer":
      return "知识审核员";
    case "user":
    default:
      return "普通用户";
  }
}

function formatStatusLabel(status: SystemSettingsUserViewModel["status"]): string {
  switch (status) {
    case "active":
      return "启用中";
    case "disabled":
      return "已停用";
    case "locked":
      return "已锁定";
    default:
      return status;
  }
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof BrowserHttpClientError) {
    const responseBody =
      typeof error.responseBody === "string"
        ? error.responseBody
        : JSON.stringify(error.responseBody);
    return `${fallback}：HTTP ${error.status} ${responseBody}`;
  }

  return error instanceof Error ? error.message : fallback;
}
