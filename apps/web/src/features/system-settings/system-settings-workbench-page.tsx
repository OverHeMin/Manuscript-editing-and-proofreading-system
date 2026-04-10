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
  AiProviderKind,
  SystemSettingsAiProviderConnectionViewModel,
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
const providerKindOptions: Array<{ value: AiProviderKind; label: string }> = [
  { value: "openai", label: "OpenAI" },
  { value: "openai_compatible", label: "OpenAI Compatible" },
  { value: "qwen", label: "Qwen" },
  { value: "deepseek", label: "DeepSeek" },
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

interface CreateProviderFormState {
  name: string;
  providerKind: AiProviderKind;
  baseUrl: string;
  testModelName: string;
  apiKey: string;
  enabled: boolean;
}

interface SelectedProviderFormState {
  name: string;
  providerKind: AiProviderKind;
  baseUrl: string;
  testModelName: string;
  enabled: boolean;
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
  const [createProviderForm, setCreateProviderForm] = useState<CreateProviderFormState>({
    name: "",
    providerKind: "qwen",
    baseUrl: "",
    testModelName: "qwen-max",
    apiKey: "",
    enabled: true,
  });
  const [selectedProviderForm, setSelectedProviderForm] = useState<SelectedProviderFormState>({
    name: initialOverview?.selectedConnection?.name ?? "",
    providerKind: initialOverview?.selectedConnection?.provider_kind ?? "qwen",
    baseUrl: initialOverview?.selectedConnection?.base_url ?? "",
    testModelName: readTestModelName(initialOverview?.selectedConnection) ?? "",
    enabled: initialOverview?.selectedConnection?.enabled ?? true,
  });
  const [credentialRotationValue, setCredentialRotationValue] = useState("");

  useEffect(() => {
    if (runtimeMode !== "persistent") {
      return;
    }

    if (initialOverview) {
      synchronizeForms(initialOverview.selectedUser, initialOverview.selectedConnection);
      return;
    }

    void loadOverview();
  }, [controller, initialOverview, runtimeMode]);

  function applyOverview(nextOverview: SystemSettingsWorkbenchOverview) {
    setOverview(nextOverview);
    synchronizeForms(nextOverview.selectedUser, nextOverview.selectedConnection);
  }

  function synchronizeForms(
    selectedUser: SystemSettingsUserViewModel | null,
    selectedConnection: SystemSettingsAiProviderConnectionViewModel | null,
  ) {
    setSelectedForm({
      displayName: selectedUser?.displayName ?? "",
      role: selectedUser?.role ?? "editor",
    });
    setSelectedProviderForm({
      name: selectedConnection?.name ?? "",
      providerKind: selectedConnection?.provider_kind ?? "qwen",
      baseUrl: selectedConnection?.base_url ?? "",
      testModelName: readTestModelName(selectedConnection) ?? "",
      enabled: selectedConnection?.enabled ?? true,
    });
    setPasswordResetValue("");
    setCredentialRotationValue("");
  }

  async function loadOverview(input: {
    selectedUserId?: string | null;
    selectedConnectionId?: string | null;
  } = {}) {
    setLoadStatus("loading");
    setErrorMessage(null);

    try {
      const nextOverview = await controller.loadOverview({
        selectedUserId: input.selectedUserId ?? overview?.selectedUserId,
        selectedConnectionId: input.selectedConnectionId ?? overview?.selectedConnectionId,
      });
      applyOverview(nextOverview);
      setLoadStatus("ready");
    } catch (error) {
      setLoadStatus("error");
      setErrorMessage(toErrorMessage(error, "系统设置加载失败"));
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
      setErrorMessage(toErrorMessage(error, "系统设置操作失败"));
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
        selectedConnectionId: overview?.selectedConnectionId,
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
        selectedConnectionId: overview?.selectedConnectionId,
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
              selectedConnectionId: overview?.selectedConnectionId,
            })
          : await controller.disableUserAndReload({
              userId: selectedUser.id,
              selectedUserId: selectedUser.id,
              selectedConnectionId: overview?.selectedConnectionId,
            });
      return result.overview;
    }, selectedUser.status === "disabled" ? "账号已启用。" : "账号已停用。");
  }

  async function handleCreateProviderConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      createProviderForm.name.trim().length === 0 ||
      createProviderForm.testModelName.trim().length === 0 ||
      createProviderForm.apiKey.trim().length === 0
    ) {
      setErrorMessage("请完整填写 AI 提供方连接信息。");
      return;
    }

    await runAction(async () => {
      const result = await controller.createProviderConnectionAndReload({
        name: createProviderForm.name.trim(),
        providerKind: createProviderForm.providerKind,
        baseUrl: normalizeOptionalText(createProviderForm.baseUrl),
        testModelName: createProviderForm.testModelName.trim(),
        apiKey: createProviderForm.apiKey,
        enabled: createProviderForm.enabled,
      });
      setCreateProviderForm({
        name: "",
        providerKind: "qwen",
        baseUrl: "",
        testModelName: "qwen-max",
        apiKey: "",
        enabled: true,
      });
      return result.overview;
    }, "AI 提供方连接已创建。");
  }

  async function handleUpdateSelectedProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedConnection = overview?.selectedConnection;
    if (!selectedConnection) {
      setErrorMessage("请先选择要维护的 AI 提供方连接。");
      return;
    }

    if (
      selectedProviderForm.name.trim().length === 0 ||
      selectedProviderForm.testModelName.trim().length === 0
    ) {
      setErrorMessage("连接名称与测试模型不能为空。");
      return;
    }

    await runAction(async () => {
      const result = await controller.updateProviderConnectionAndReload({
        connectionId: selectedConnection.id,
        input: {
          name: selectedProviderForm.name.trim(),
          baseUrl: normalizeOptionalText(selectedProviderForm.baseUrl),
          testModelName: selectedProviderForm.testModelName.trim(),
          enabled: selectedProviderForm.enabled,
        },
        selectedUserId: overview?.selectedUserId,
        selectedConnectionId: selectedConnection.id,
      });
      return result.overview;
    }, "AI 提供方连接已更新。");
  }

  async function handleRotateProviderCredential(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedConnection = overview?.selectedConnection;
    if (!selectedConnection) {
      setErrorMessage("请先选择要轮换密钥的连接。");
      return;
    }

    if (credentialRotationValue.trim().length === 0) {
      setErrorMessage("请输入新的 API Key。");
      return;
    }

    await runAction(async () => {
      const result = await controller.rotateProviderCredentialAndReload({
        connectionId: selectedConnection.id,
        nextApiKey: credentialRotationValue,
        selectedUserId: overview?.selectedUserId,
        selectedConnectionId: selectedConnection.id,
      });
      return result.overview;
    }, "AI 提供方密钥已轮换。");
  }

  async function handleTestProviderConnection() {
    const selectedConnection = overview?.selectedConnection;
    if (!selectedConnection) {
      setErrorMessage("请先选择要测试的连接。");
      return;
    }

    if (selectedProviderForm.testModelName.trim().length === 0) {
      setErrorMessage("请先填写测试模型。");
      return;
    }

    await runAction(async () => {
      const result = await controller.testProviderConnectionAndReload({
        connectionId: selectedConnection.id,
        testModelName: selectedProviderForm.testModelName.trim(),
        selectedUserId: overview?.selectedUserId,
        selectedConnectionId: selectedConnection.id,
      });
      return result.overview;
    }, "连接测试已完成。");
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

  function selectConnection(connectionId: string) {
    if (!overview) {
      return;
    }

    const selectedConnection =
      overview.providerConnections.find((connection) => connection.id === connectionId) ?? null;
    if (!selectedConnection) {
      return;
    }

    applyOverview({
      ...overview,
      selectedConnectionId: selectedConnection.id,
      selectedConnection,
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
        <p>集中维护内测环境账号、角色权限，以及 AI 提供方连接状态。</p>
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

          <section className="system-settings-provider-shell">
            <div className="system-settings-section-header">
              <div>
                <h3>AI 提供方</h3>
                <p>统一维护国内外模型连接、密钥轮换与连通性测试结果。</p>
              </div>
              <div className="system-settings-provider-summary">
                <span>连接数 {overview.providerConnections.length}</span>
                <span>
                  已启用 {overview.providerConnections.filter((connection) => connection.enabled).length}
                </span>
              </div>
            </div>

            <div className="system-settings-provider-layout">
              <article className="system-settings-panel">
                <div className="system-settings-panel-header">
                  <div>
                    <h3>连接列表</h3>
                    <p>选择一个连接查看兼容模式、密钥掩码与测试结果。</p>
                  </div>
                  <button type="button" onClick={() => void loadOverview()} disabled={isBusy}>
                    刷新连接
                  </button>
                </div>
                <ul className="system-settings-user-list">
                  {overview.providerConnections.map((connection) => {
                    const isActive = connection.id === overview.selectedConnectionId;
                    return (
                      <li key={connection.id}>
                        <button
                          type="button"
                          className={`system-settings-user-row${isActive ? " is-active" : ""}`}
                          onClick={() => selectConnection(connection.id)}
                        >
                          <span>{connection.name}</span>
                          <small>
                            {formatProviderKindLabel(connection.provider_kind)} ·{" "}
                            {connection.enabled ? "启用状态" : "停用状态"} ·{" "}
                            {formatConnectionTestStatusLabel(connection.last_test_status)}
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
                    <h3>新增连接</h3>
                    <p>支持 Qwen、DeepSeek、OpenAI 与兼容 OpenAI 的聚合入口。</p>
                  </div>
                </div>
                <form className="system-settings-form-grid" onSubmit={handleCreateProviderConnection}>
                  <label className="system-settings-field">
                    <span>连接名称</span>
                    <input
                      value={createProviderForm.name}
                      onChange={(event) =>
                        setCreateProviderForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      placeholder="Qwen Production"
                    />
                  </label>
                  <label className="system-settings-field">
                    <span>提供方类型</span>
                    <select
                      value={createProviderForm.providerKind}
                      onChange={(event) =>
                        setCreateProviderForm((current) => ({
                          ...current,
                          providerKind: event.target.value as AiProviderKind,
                        }))
                      }
                    >
                      {providerKindOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="system-settings-field">
                    <span>Base URL</span>
                    <input
                      value={createProviderForm.baseUrl}
                      onChange={(event) =>
                        setCreateProviderForm((current) => ({
                          ...current,
                          baseUrl: event.target.value,
                        }))
                      }
                      placeholder="https://api.deepseek.com"
                    />
                  </label>
                  <label className="system-settings-field">
                    <span>测试模型</span>
                    <input
                      value={createProviderForm.testModelName}
                      onChange={(event) =>
                        setCreateProviderForm((current) => ({
                          ...current,
                          testModelName: event.target.value,
                        }))
                      }
                      placeholder="qwen-max"
                    />
                  </label>
                  <label className="system-settings-field">
                    <span>API Key</span>
                    <input
                      type="password"
                      value={createProviderForm.apiKey}
                      onChange={(event) =>
                        setCreateProviderForm((current) => ({
                          ...current,
                          apiKey: event.target.value,
                        }))
                      }
                      placeholder="sk-..."
                    />
                  </label>
                  <label className="system-settings-field">
                    <span>启用状态</span>
                    <select
                      value={createProviderForm.enabled ? "enabled" : "disabled"}
                      onChange={(event) =>
                        setCreateProviderForm((current) => ({
                          ...current,
                          enabled: event.target.value === "enabled",
                        }))
                      }
                    >
                      <option value="enabled">启用</option>
                      <option value="disabled">停用</option>
                    </select>
                  </label>
                  <div className="system-settings-actions system-settings-actions-full">
                    <button type="submit" disabled={isBusy}>
                      创建连接
                    </button>
                  </div>
                </form>
              </article>

              <article className="system-settings-panel">
                <div className="system-settings-panel-header">
                  <div>
                    <h3>连接详情</h3>
                    <p>
                      {overview.selectedConnection
                        ? `当前选中：${overview.selectedConnection.name}（${overview.selectedConnection.id}）`
                        : "请选择一个连接后再执行维护操作。"}
                    </p>
                  </div>
                </div>

                {overview.selectedConnection ? (
                  <>
                    <div className="system-settings-provider-meta">
                      <div className="system-settings-provider-badge">
                        兼容模式：{overview.selectedConnection.compatibility_mode}
                      </div>
                      <div className="system-settings-provider-badge">
                        密钥掩码：{overview.selectedConnection.credential_summary?.mask ?? "未配置"}
                      </div>
                      <div className="system-settings-provider-badge">
                        最后测试：{formatConnectionTestStatusLabel(overview.selectedConnection.last_test_status)}
                      </div>
                    </div>

                    <form className="system-settings-form-grid" onSubmit={handleUpdateSelectedProvider}>
                      <label className="system-settings-field">
                        <span>连接名称</span>
                        <input
                          value={selectedProviderForm.name}
                          onChange={(event) =>
                            setSelectedProviderForm((current) => ({
                              ...current,
                              name: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="system-settings-field">
                        <span>提供方类型</span>
                        <select value={selectedProviderForm.providerKind} disabled>
                          {providerKindOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="system-settings-field">
                        <span>Base URL</span>
                        <input
                          value={selectedProviderForm.baseUrl}
                          onChange={(event) =>
                            setSelectedProviderForm((current) => ({
                              ...current,
                              baseUrl: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="system-settings-field">
                        <span>测试模型</span>
                        <input
                          value={selectedProviderForm.testModelName}
                          onChange={(event) =>
                            setSelectedProviderForm((current) => ({
                              ...current,
                              testModelName: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="system-settings-field">
                        <span>启用状态</span>
                        <select
                          value={selectedProviderForm.enabled ? "enabled" : "disabled"}
                          onChange={(event) =>
                            setSelectedProviderForm((current) => ({
                              ...current,
                              enabled: event.target.value === "enabled",
                            }))
                          }
                        >
                          <option value="enabled">启用</option>
                          <option value="disabled">停用</option>
                        </select>
                      </label>
                      <div className="system-settings-actions system-settings-actions-full">
                        <button type="submit" disabled={isBusy}>
                          保存连接信息
                        </button>
                      </div>
                    </form>

                    <form className="system-settings-form-grid" onSubmit={handleRotateProviderCredential}>
                      <label className="system-settings-field">
                        <span>轮换 API Key</span>
                        <input
                          type="password"
                          value={credentialRotationValue}
                          onChange={(event) => setCredentialRotationValue(event.target.value)}
                          placeholder="输入新的 API Key"
                        />
                      </label>
                      <div className="system-settings-actions system-settings-actions-full">
                        <button type="submit" disabled={isBusy}>
                          轮换密钥
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleTestProviderConnection()}
                        >
                          连接测试
                        </button>
                      </div>
                    </form>

                    <div className="system-settings-provider-inline">
                      <span>最后测试时间：{overview.selectedConnection.last_test_at ?? "尚未测试"}</span>
                      <span>
                        错误摘要：{overview.selectedConnection.last_error_summary ?? "无"}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="system-settings-empty">当前没有可维护的 AI 提供方连接。</p>
                )}
              </article>
            </div>
          </section>
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

function formatProviderKindLabel(providerKind: AiProviderKind): string {
  return providerKindOptions.find((option) => option.value === providerKind)?.label ?? providerKind;
}

function formatConnectionTestStatusLabel(
  status: SystemSettingsAiProviderConnectionViewModel["last_test_status"],
): string {
  switch (status) {
    case "passed":
      return "已通过";
    case "failed":
      return "失败";
    case "unknown":
    default:
      return "未测试";
  }
}

function readTestModelName(
  connection: SystemSettingsAiProviderConnectionViewModel | null | undefined,
): string | null {
  const rawValue = connection?.connection_metadata?.test_model_name;
  return typeof rawValue === "string" && rawValue.trim().length > 0 ? rawValue : null;
}

function normalizeOptionalText(value: string): string | undefined {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
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
