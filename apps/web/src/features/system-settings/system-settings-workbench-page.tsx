import { useEffect, useState, type FormEvent } from "react";
import { createBrowserHttpClient, BrowserHttpClientError } from "../../lib/browser-http-client.ts";
import {
  resolveWorkbenchRuntimeMode,
  type WorkbenchRuntimeMode,
} from "../../app/persistent-session.ts";
import type { AuthRole } from "../auth/index.ts";
import type { WorkbenchSettingsSection } from "../auth/workbench.ts";
import {
  createSystemSettingsWorkbenchController,
  type SystemSettingsWorkbenchController,
} from "./system-settings-controller.ts";
import type {
  AiProviderKind,
  SaveSystemSettingsModuleDefaultInput,
  SystemSettingsAiProviderConnectionViewModel,
  SystemSettingsModuleDefaultViewModel,
  SystemSettingsModuleKey,
  SystemSettingsWorkbenchOverview,
} from "./types.ts";

if (typeof document !== "undefined") {
  void import("./system-settings-workbench.css");
}

const defaultController = createSystemSettingsWorkbenchController(createBrowserHttpClient());
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
const moduleOptions: Array<{ value: SystemSettingsModuleKey; label: string }> = [
  { value: "screening", label: "初筛" },
  { value: "editing", label: "编辑" },
  { value: "proofreading", label: "校对" },
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

interface CreateModelFormState {
  modelName: string;
  connectionId: string;
  allowedModules: SystemSettingsModuleKey[];
  productionAllowed: boolean;
  fallbackModelId: string;
}

interface ModuleDefaultFormState {
  primaryModelId: string;
  fallbackModelId: string;
  temperature: string;
}

type ModuleDefaultFormStateMap = Record<SystemSettingsModuleKey, ModuleDefaultFormState>;

export interface SystemSettingsWorkbenchPageProps {
  controller?: SystemSettingsWorkbenchController;
  runtimeMode?: WorkbenchRuntimeMode;
  section?: WorkbenchSettingsSection;
  initialOverview?: SystemSettingsWorkbenchOverview | null;
  initialErrorMessage?: string | null;
}

export function SystemSettingsWorkbenchPage({
  controller = defaultController,
  runtimeMode = resolveWorkbenchRuntimeMode(import.meta.env),
  section = "ai-access",
  initialOverview = null,
  initialErrorMessage = null,
}: SystemSettingsWorkbenchPageProps) {
  const landingCopy = resolveSystemSettingsLandingCopy(section);
  const demoUnsupportedCopy = resolveSystemSettingsDemoUnsupportedCopy(section);
  const [overview, setOverview] = useState<SystemSettingsWorkbenchOverview | null>(initialOverview);
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
  const [createModelForm, setCreateModelForm] = useState<CreateModelFormState>(
    () => buildCreateModelFormState(initialOverview),
  );
  const [moduleDefaultForms, setModuleDefaultForms] = useState<ModuleDefaultFormStateMap>(
    () => buildModuleDefaultFormStateMap(initialOverview?.moduleDefaults ?? []),
  );

  useEffect(() => {
    if (runtimeMode !== "persistent") {
      return;
    }
    if (initialOverview) {
      synchronizeForms(initialOverview);
      return;
    }
    void loadOverview();
  }, [controller, initialOverview, runtimeMode]);

  function applyOverview(nextOverview: SystemSettingsWorkbenchOverview) {
    setOverview(nextOverview);
    synchronizeForms(nextOverview);
  }

  function synchronizeForms(nextOverview: SystemSettingsWorkbenchOverview) {
    setSelectedForm({
      displayName: nextOverview.selectedUser?.displayName ?? "",
      role: nextOverview.selectedUser?.role ?? "editor",
    });
    setSelectedProviderForm({
      name: nextOverview.selectedConnection?.name ?? "",
      providerKind: nextOverview.selectedConnection?.provider_kind ?? "qwen",
      baseUrl: nextOverview.selectedConnection?.base_url ?? "",
      testModelName: readTestModelName(nextOverview.selectedConnection) ?? "",
      enabled: nextOverview.selectedConnection?.enabled ?? true,
    });
    setCreateModelForm(buildCreateModelFormState(nextOverview));
    setModuleDefaultForms(buildModuleDefaultFormStateMap(nextOverview.moduleDefaults));
    setPasswordResetValue("");
    setCredentialRotationValue("");
  }

  async function loadOverview(input: { selectedUserId?: string | null; selectedConnectionId?: string | null } = {}) {
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

  async function runAction(action: () => Promise<SystemSettingsWorkbenchOverview>, successMessage: string) {
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
    if (!createForm.username.trim() || !createForm.displayName.trim() || !createForm.password.trim()) {
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
      setCreateForm({ username: "", displayName: "", role: "editor", password: "" });
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
    if (!selectedForm.displayName.trim()) {
      setErrorMessage("显示名称不能为空。");
      return;
    }
    await runAction(async () => {
      const result = await controller.updateUserProfileAndReload({
        userId: selectedUser.id,
        input: { displayName: selectedForm.displayName.trim(), role: selectedForm.role },
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
    if (!passwordResetValue.trim()) {
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
    if (!createProviderForm.name.trim() || !createProviderForm.testModelName.trim() || !createProviderForm.apiKey.trim()) {
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
    if (!selectedProviderForm.name.trim() || !selectedProviderForm.testModelName.trim()) {
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
    if (!credentialRotationValue.trim()) {
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
    if (!selectedProviderForm.testModelName.trim()) {
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

  async function handleCreateRegisteredModel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedConnection = overview?.providerConnections.find(
      (connection) => connection.id === createModelForm.connectionId,
    );
    if (!selectedConnection) {
      setErrorMessage("请先为模型选择可用连接。");
      return;
    }
    if (!createModelForm.modelName.trim()) {
      setErrorMessage("请填写模型名称。");
      return;
    }
    if (createModelForm.allowedModules.length === 0) {
      setErrorMessage("请至少选择一个允许模块。");
      return;
    }
    await runAction(async () => {
      const result = await controller.createRegisteredModelAndReload({
        providerKind: selectedConnection.provider_kind,
        modelName: createModelForm.modelName.trim(),
        connectionId: createModelForm.connectionId,
        allowedModules: createModelForm.allowedModules,
        productionAllowed: createModelForm.productionAllowed,
        fallbackModelId: normalizeOptionalText(createModelForm.fallbackModelId) ?? null,
        selectedUserId: overview?.selectedUserId,
        selectedConnectionId: createModelForm.connectionId,
      });
      return result.overview;
    }, "模型注册已保存。");
  }

  async function handleSaveModuleDefault(moduleKey: SystemSettingsModuleKey) {
    const formState = moduleDefaultForms[moduleKey];
    if (!formState.primaryModelId) {
      setErrorMessage("请先选择模块主模型。");
      return;
    }
    const parsedTemperature = parseTemperature(formState.temperature);
    if (parsedTemperature === "invalid") {
      setErrorMessage("温度必须是 0 到 1 之间的数字。");
      return;
    }
    await runAction(async () => {
      const input: SaveSystemSettingsModuleDefaultInput = {
        moduleKey,
        primaryModelId: formState.primaryModelId,
        fallbackModelId: normalizeOptionalText(formState.fallbackModelId) ?? null,
        ...(typeof parsedTemperature === "number" ? { temperature: parsedTemperature } : {}),
      };
      const result = await controller.saveModuleDefaultAndReload({
        ...input,
        selectedUserId: overview?.selectedUserId,
        selectedConnectionId: overview?.selectedConnectionId,
      });
      return result.overview;
    }, "模块默认值已保存。");
  }

  function selectUser(userId: string) {
    if (!overview) {
      return;
    }
    const selectedUser = overview.users.find((user) => user.id === userId) ?? null;
    if (!selectedUser) {
      return;
    }
    applyOverview({ ...overview, selectedUserId: selectedUser.id, selectedUser });
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

  function toggleCreateModelModule(moduleKey: SystemSettingsModuleKey) {
    setCreateModelForm((current) => ({
      ...current,
      allowedModules: current.allowedModules.includes(moduleKey)
        ? current.allowedModules.filter((item) => item !== moduleKey)
        : [...current.allowedModules, moduleKey],
    }));
  }

  function updateModuleDefaultForm(moduleKey: SystemSettingsModuleKey, patch: Partial<ModuleDefaultFormState>) {
    setModuleDefaultForms((current) => ({
      ...current,
      [moduleKey]: {
        ...current[moduleKey],
        ...patch,
      },
    }));
  }

  if (runtimeMode === "demo") {
    return (
      <section className="system-settings-workbench">
        <header className="system-settings-hero">
          <p className="system-settings-kicker">系统设置</p>
          <h2>{landingCopy.title}</h2>
          <p>{demoUnsupportedCopy.heroNotice}</p>
        </header>
        <article className="system-settings-panel system-settings-notice" role="status">
          <h3>暂不支持</h3>
          <p>{demoUnsupportedCopy.bodyNotice}</p>
        </article>
        {section === "accounts" ? (
          <>
            <section className="system-settings-summary-grid">
              <article className="system-settings-card"><span>账号列表</span><strong>需连接持久化后端</strong></article>
              <article className="system-settings-card"><span>创建账号</span><strong>待启用</strong></article>
              <article className="system-settings-card"><span>角色维护</span><strong>待启用</strong></article>
              <article className="system-settings-card"><span>密码重置</span><strong>待启用</strong></article>
            </section>
            <div className="system-settings-layout">
              <article className="system-settings-panel"><div className="system-settings-panel-header"><div><h3>账号列表</h3><p>连接持久化后端后，这里会展示可维护的内测账号与角色状态。</p></div></div><p className="system-settings-empty">{demoUnsupportedCopy.bodyNotice}</p></article>
              <article className="system-settings-panel"><div className="system-settings-panel-header"><div><h3>创建账号</h3><p>账号与权限分区只负责人、角色和访问控制，不承载 AI 配置。</p></div></div><p className="system-settings-empty">连接持久化后端后可创建账号并分配初始角色。</p></article>
              <article className="system-settings-panel"><div className="system-settings-panel-header"><div><h3>账号操作</h3><p>选中账号后可在这里执行资料更新、密码重置与启停操作。</p></div></div><div className="system-settings-provider-inline"><span>修改账号信息</span><span>重置登录密码</span></div><p className="system-settings-empty">演示模式下仅展示账号分区结构，不执行真实维护。</p></article>
            </div>
          </>
        ) : (
          <>
            <section className="system-settings-summary-grid">
              <article className="system-settings-card"><span>提供方连接</span><strong>需连接持久化后端</strong></article>
              <article className="system-settings-card"><span>模型注册</span><strong>待启用</strong></article>
              <article className="system-settings-card"><span>模块默认值</span><strong>待启用</strong></article>
              <article className="system-settings-card"><span>温度控制</span><strong>待启用</strong></article>
            </section>
            <div className="system-settings-layout">
              <article className="system-settings-panel"><div className="system-settings-panel-header"><div><h3>AI 提供方</h3><p>这里会集中维护 API Key、连接状态与连通性测试结果。</p></div></div><p className="system-settings-empty">{demoUnsupportedCopy.bodyNotice}</p></article>
              <article className="system-settings-panel"><div className="system-settings-panel-header"><div><h3>模型注册</h3><p>在 AI 接入内登记可用模型，并限定允许服务的业务模块。</p></div></div><p className="system-settings-empty">模型注册层会在此绑定连接、可用模块与兜底模型。</p></article>
              <article className="system-settings-panel"><div className="system-settings-panel-header"><div><h3>模块默认值</h3><p>在同一分区内设置 screening、editing、proofreading 的默认模型与温度。</p></div></div><p className="system-settings-empty">模块默认值层会在此集中配置模型绑定与温度控制。</p></article>
            </div>
          </>
        )}
      </section>
    );
  }

  return (
    <section className="system-settings-workbench">
      <header className="system-settings-hero">
        <p className="system-settings-kicker">系统设置</p>
        <h2>{landingCopy.title}</h2>
        <p>{landingCopy.summary}</p>
        <p>{landingCopy.emphasis}</p>
      </header>
      {statusMessage ? <article className="system-settings-panel system-settings-status" role="status"><p>{statusMessage}</p></article> : null}
      {errorMessage ? <article className="system-settings-panel system-settings-error" role="alert"><p>{errorMessage}</p></article> : null}
      {overview ? (
        section === "accounts" ? (
          <>
            <section className="system-settings-summary-grid">
              <article className="system-settings-card"><span>账号总数</span><strong>{overview.summary.totalUsers}</strong></article>
              <article className="system-settings-card"><span>启用中</span><strong>{overview.summary.activeUsers}</strong></article>
              <article className="system-settings-card"><span>已停用</span><strong>{overview.summary.disabledUsers}</strong></article>
              <article className="system-settings-card"><span>管理员</span><strong>{overview.summary.adminUsers}</strong></article>
            </section>
            <div className="system-settings-layout">
              <article className="system-settings-panel">
                <div className="system-settings-panel-header"><div><h3>账号列表</h3><p>选择一个账号以查看并修改它的当前状态。</p></div><button type="button" onClick={() => void loadOverview()} disabled={isBusy}>刷新列表</button></div>
                <ul className="system-settings-user-list">
                  {overview.users.map((user) => {
                    const isActive = user.id === overview.selectedUserId;
                    return <li key={user.id}><button type="button" className={`system-settings-user-row${isActive ? " is-active" : ""}`} onClick={() => selectUser(user.id)}><span>{user.displayName}</span><small>{user.username} · {formatRoleLabel(user.role)} · {formatStatusLabel(user.status)}</small></button></li>;
                  })}
                </ul>
              </article>
              <article className="system-settings-panel">
                <div className="system-settings-panel-header"><div><h3>创建账号</h3><p>只修改持久化账号数据，不会影响系统核心运行链路。</p></div></div>
                <form className="system-settings-form-grid" onSubmit={handleCreateAccount}>
                  <label className="system-settings-field"><span>用户名</span><input value={createForm.username} onChange={(event) => setCreateForm((current) => ({ ...current, username: event.target.value }))} placeholder="operator.name" /></label>
                  <label className="system-settings-field"><span>显示名称</span><input value={createForm.displayName} onChange={(event) => setCreateForm((current) => ({ ...current, displayName: event.target.value }))} placeholder="运营管理员" /></label>
                  <label className="system-settings-field"><span>角色</span><select value={createForm.role} onChange={(event) => setCreateForm((current) => ({ ...current, role: event.target.value as AuthRole }))}>{accountRoles.map((role) => <option key={role} value={role}>{formatRoleLabel(role)}</option>)}</select></label>
                  <label className="system-settings-field"><span>初始密码</span><input type="password" value={createForm.password} onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))} placeholder="请输入初始密码" /></label>
                  <div className="system-settings-actions system-settings-actions-full"><button type="submit" disabled={isBusy}>{isBusy ? "提交中..." : "创建账号"}</button></div>
                </form>
              </article>
              <article className="system-settings-panel">
                <div className="system-settings-panel-header"><div><h3>账号操作</h3><p>{overview.selectedUser ? `当前选中：${overview.selectedUser.displayName}（${overview.selectedUser.username}）` : "请选择一个账号后再执行管理操作。"}</p></div></div>
                {overview.selectedUser ? (
                  <>
                    <form className="system-settings-form-grid" onSubmit={handleUpdateSelectedUser}>
                      <label className="system-settings-field"><span>修改账号信息</span><input value={selectedForm.displayName} onChange={(event) => setSelectedForm((current) => ({ ...current, displayName: event.target.value }))} /></label>
                      <label className="system-settings-field"><span>角色</span><select value={selectedForm.role} onChange={(event) => setSelectedForm((current) => ({ ...current, role: event.target.value as AuthRole }))}>{accountRoles.map((role) => <option key={role} value={role}>{formatRoleLabel(role)}</option>)}</select></label>
                      <div className="system-settings-actions system-settings-actions-full"><button type="submit" disabled={isBusy}>保存账号信息</button></div>
                    </form>
                    <form className="system-settings-form-grid" onSubmit={handleResetPassword}>
                      <label className="system-settings-field"><span>重置登录密码</span><input type="password" value={passwordResetValue} onChange={(event) => setPasswordResetValue(event.target.value)} placeholder="输入新的登录密码" /></label>
                      <div className="system-settings-actions system-settings-actions-full"><button type="submit" disabled={isBusy}>提交新密码</button></div>
                    </form>
                    <div className="system-settings-actions"><button type="button" disabled={isBusy} onClick={() => void handleToggleAccountStatus()}>{overview.selectedUser.status === "disabled" ? "启用该账号" : "停用该账号"}</button></div>
                  </>
                ) : <p className="system-settings-empty">当前没有可维护的账号记录。</p>}
              </article>
            </div>
          </>
        ) : (
          <>
            <section className="system-settings-summary-grid">
              <article className="system-settings-card"><span>连接总数</span><strong>{overview.providerConnections.length}</strong></article>
              <article className="system-settings-card"><span>已启用</span><strong>{overview.providerConnections.filter((connection) => connection.enabled).length}</strong></article>
              <article className="system-settings-card"><span>已通过测试</span><strong>{overview.providerConnections.filter((connection) => connection.last_test_status === "passed").length}</strong></article>
              <article className="system-settings-card"><span>模块默认值</span><strong>{overview.moduleDefaults.filter((record) => record.primaryModelName).length}/{overview.moduleDefaults.length}</strong></article>
            </section>
            <section className="system-settings-provider-shell">
              <div className="system-settings-section-header"><div><h3>AI 提供方</h3><p>统一维护国内外模型连接、密钥轮换与连通性测试结果。</p></div><div className="system-settings-provider-summary"><span>连接数 {overview.providerConnections.length}</span><span>已启用 {overview.providerConnections.filter((connection) => connection.enabled).length}</span></div></div>
              <div className="system-settings-provider-layout">
                <article className="system-settings-panel">
                  <div className="system-settings-panel-header"><div><h3>连接列表</h3><p>选择一个连接查看兼容模式、密钥掩码与测试结果。</p></div><button type="button" onClick={() => void loadOverview()} disabled={isBusy}>刷新连接</button></div>
                  <ul className="system-settings-user-list">
                    {overview.providerConnections.map((connection) => {
                      const isActive = connection.id === overview.selectedConnectionId;
                      return <li key={connection.id}><button type="button" className={`system-settings-user-row${isActive ? " is-active" : ""}`} onClick={() => selectConnection(connection.id)}><span>{connection.name}</span><small>{formatProviderKindLabel(connection.provider_kind)} · {connection.enabled ? "启用状态" : "停用状态"} · {formatConnectionTestStatusLabel(connection.last_test_status)}</small></button></li>;
                    })}
                  </ul>
                </article>
                <article className="system-settings-panel">
                  <div className="system-settings-panel-header"><div><h3>新增连接</h3><p>支持 Qwen、DeepSeek、OpenAI 与兼容 OpenAI 的聚合入口。</p></div></div>
                  <form className="system-settings-form-grid" onSubmit={handleCreateProviderConnection}>
                    <label className="system-settings-field"><span>连接名称</span><input value={createProviderForm.name} onChange={(event) => setCreateProviderForm((current) => ({ ...current, name: event.target.value }))} placeholder="Qwen Production" /></label>
                    <label className="system-settings-field"><span>提供方类型</span><select value={createProviderForm.providerKind} onChange={(event) => setCreateProviderForm((current) => ({ ...current, providerKind: event.target.value as AiProviderKind }))}>{providerKindOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                    <label className="system-settings-field"><span>Base URL</span><input value={createProviderForm.baseUrl} onChange={(event) => setCreateProviderForm((current) => ({ ...current, baseUrl: event.target.value }))} placeholder="https://api.deepseek.com" /></label>
                    <label className="system-settings-field"><span>测试模型</span><input value={createProviderForm.testModelName} onChange={(event) => setCreateProviderForm((current) => ({ ...current, testModelName: event.target.value }))} placeholder="qwen-max" /></label>
                    <label className="system-settings-field"><span>API Key</span><input type="password" value={createProviderForm.apiKey} onChange={(event) => setCreateProviderForm((current) => ({ ...current, apiKey: event.target.value }))} placeholder="sk-..." /></label>
                    <label className="system-settings-field"><span>启用状态</span><select value={createProviderForm.enabled ? "enabled" : "disabled"} onChange={(event) => setCreateProviderForm((current) => ({ ...current, enabled: event.target.value === "enabled" }))}><option value="enabled">启用</option><option value="disabled">停用</option></select></label>
                    <div className="system-settings-actions system-settings-actions-full"><button type="submit" disabled={isBusy}>创建连接</button></div>
                  </form>
                </article>
                <article className="system-settings-panel">
                  <div className="system-settings-panel-header"><div><h3>连接详情</h3><p>{overview.selectedConnection ? `当前选中：${overview.selectedConnection.name}（${overview.selectedConnection.id}）` : "请选择一个连接后再执行维护操作。"}</p></div></div>
                  {overview.selectedConnection ? (
                    <>
                      <div className="system-settings-provider-meta"><div className="system-settings-provider-badge">兼容模式：{overview.selectedConnection.compatibility_mode}</div><div className="system-settings-provider-badge">密钥掩码：{overview.selectedConnection.credential_summary?.mask ?? "未配置"}</div><div className="system-settings-provider-badge">最后测试：{formatConnectionTestStatusLabel(overview.selectedConnection.last_test_status)}</div></div>
                      <form className="system-settings-form-grid" onSubmit={handleUpdateSelectedProvider}>
                        <label className="system-settings-field"><span>连接名称</span><input value={selectedProviderForm.name} onChange={(event) => setSelectedProviderForm((current) => ({ ...current, name: event.target.value }))} /></label>
                        <label className="system-settings-field"><span>提供方类型</span><select value={selectedProviderForm.providerKind} disabled>{providerKindOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                        <label className="system-settings-field"><span>Base URL</span><input value={selectedProviderForm.baseUrl} onChange={(event) => setSelectedProviderForm((current) => ({ ...current, baseUrl: event.target.value }))} /></label>
                        <label className="system-settings-field"><span>测试模型</span><input value={selectedProviderForm.testModelName} onChange={(event) => setSelectedProviderForm((current) => ({ ...current, testModelName: event.target.value }))} /></label>
                        <label className="system-settings-field"><span>启用状态</span><select value={selectedProviderForm.enabled ? "enabled" : "disabled"} onChange={(event) => setSelectedProviderForm((current) => ({ ...current, enabled: event.target.value === "enabled" }))}><option value="enabled">启用</option><option value="disabled">停用</option></select></label>
                        <div className="system-settings-actions system-settings-actions-full"><button type="submit" disabled={isBusy}>保存连接信息</button></div>
                      </form>
                      <form className="system-settings-form-grid" onSubmit={handleRotateProviderCredential}>
                        <label className="system-settings-field"><span>轮换 API Key</span><input type="password" value={credentialRotationValue} onChange={(event) => setCredentialRotationValue(event.target.value)} placeholder="输入新的 API Key" /></label>
                        <div className="system-settings-actions system-settings-actions-full"><button type="submit" disabled={isBusy}>轮换密钥</button><button type="button" disabled={isBusy} onClick={() => void handleTestProviderConnection()}>连接测试</button></div>
                      </form>
                      <div className="system-settings-provider-inline"><span>最后测试时间：{overview.selectedConnection.last_test_at ?? "尚未测试"}</span><span>错误摘要：{overview.selectedConnection.last_error_summary ?? "无"}</span></div>
                    </>
                  ) : <p className="system-settings-empty">当前没有可维护的 AI 提供方连接。</p>}
                </article>
              </div>
            </section>
            <div className="system-settings-ai-grid">
              <article className="system-settings-panel">
                <div className="system-settings-panel-header"><div><h3>模型注册</h3><p>在 AI 接入内登记可用模型，并限定模块范围与兜底关系。</p></div></div>
                {overview.registeredModels.length > 0 ? (
                  <ul className="system-settings-user-list">
                    {overview.registeredModels.map((model) => (
                      <li key={model.id}>
                        <div className="system-settings-user-row">
                          <span>{model.displayName}</span>
                          <small>{model.connectionName} · {formatAllowedModulesLabel(model.allowedModules)} · {model.productionAllowed ? "可用于生产" : "仅限试运行"}</small>
                          {model.fallbackModelName ? <small>兜底模型：{model.fallbackModelName}</small> : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : <p className="system-settings-empty">当前还没有已登记模型。请先完成连接配置，再登记可供业务模块使用的模型。</p>}
                <div className="system-settings-subpanel">
                  <div className="system-settings-panel-header"><div><h3>新增模型</h3><p>模型层只负责可用模型定义，不存储原始密钥。</p></div></div>
                  <form className="system-settings-form-grid" onSubmit={handleCreateRegisteredModel}>
                    <label className="system-settings-field"><span>模型名称</span><input value={createModelForm.modelName} onChange={(event) => setCreateModelForm((current) => ({ ...current, modelName: event.target.value }))} placeholder="qwen-max" /></label>
                    <label className="system-settings-field"><span>绑定连接</span><select value={createModelForm.connectionId} onChange={(event) => setCreateModelForm((current) => ({ ...current, connectionId: event.target.value }))}><option value="">请选择连接</option>{overview.providerConnections.map((connection) => <option key={connection.id} value={connection.id}>{connection.name}</option>)}</select></label>
                    <fieldset className="system-settings-field system-settings-fieldset"><legend>允许模块</legend><div className="system-settings-checkbox-grid">{moduleOptions.map((option) => <label key={option.value} className="system-settings-checkbox"><input type="checkbox" checked={createModelForm.allowedModules.includes(option.value)} onChange={() => toggleCreateModelModule(option.value)} /><span>{option.label}</span></label>)}</div></fieldset>
                    <label className="system-settings-field"><span>兜底模型</span><select value={createModelForm.fallbackModelId} onChange={(event) => setCreateModelForm((current) => ({ ...current, fallbackModelId: event.target.value }))}><option value="">不设置</option>{overview.registeredModels.map((model) => <option key={model.id} value={model.id}>{model.displayName}</option>)}</select></label>
                    <label className="system-settings-field"><span>生产可用</span><select value={createModelForm.productionAllowed ? "true" : "false"} onChange={(event) => setCreateModelForm((current) => ({ ...current, productionAllowed: event.target.value === "true" }))}><option value="true">是</option><option value="false">否</option></select></label>
                    <div className="system-settings-actions system-settings-actions-full"><button type="submit" disabled={isBusy}>保存模型注册</button></div>
                  </form>
                </div>
              </article>
              <article className="system-settings-panel">
                <div className="system-settings-panel-header"><div><h3>模块默认值</h3><p>集中设置各模块的主模型、兜底模型与温度，供下游页面统一读取。</p></div></div>
                <div className="system-settings-stack">
                  {overview.moduleDefaults.map((record) => (
                    <form key={record.moduleKey} className="system-settings-subpanel" onSubmit={(event) => { event.preventDefault(); void handleSaveModuleDefault(record.moduleKey); }}>
                      <div className="system-settings-panel-header"><div><h3>{record.moduleLabel}</h3><p>当前主模型：{record.primaryModelName ?? "待配置"} · {formatTemperatureLabel(record.temperature)}</p></div></div>
                      <div className="system-settings-form-grid">
                        <label className="system-settings-field"><span>主模型</span><select value={moduleDefaultForms[record.moduleKey].primaryModelId} onChange={(event) => updateModuleDefaultForm(record.moduleKey, { primaryModelId: event.target.value })}><option value="">请选择模型</option>{overview.registeredModels.map((model) => <option key={model.id} value={model.id}>{model.displayName}</option>)}</select></label>
                        <label className="system-settings-field"><span>兜底模型</span><select value={moduleDefaultForms[record.moduleKey].fallbackModelId} onChange={(event) => updateModuleDefaultForm(record.moduleKey, { fallbackModelId: event.target.value })}><option value="">不设置</option>{overview.registeredModels.map((model) => <option key={model.id} value={model.id}>{model.displayName}</option>)}</select></label>
                        <label className="system-settings-field"><span>温度</span><input type="number" min="0" max="1" step="0.1" value={moduleDefaultForms[record.moduleKey].temperature} onChange={(event) => updateModuleDefaultForm(record.moduleKey, { temperature: event.target.value })} placeholder="0.2" /></label>
                        <div className="system-settings-actions system-settings-actions-full"><button type="submit" disabled={isBusy}>保存模块默认值</button></div>
                      </div>
                    </form>
                  ))}
                </div>
              </article>
            </div>
          </>
        )
      ) : loadStatus === "loading" || loadStatus === "idle" ? (
        <article className="system-settings-panel" role="status"><p>{resolveSystemSettingsLoadingMessage(section)}</p></article>
      ) : null}
    </section>
  );
}

function resolveSystemSettingsDemoUnsupportedCopy(section: WorkbenchSettingsSection): { heroNotice: string; bodyNotice: string } {
  return section === "accounts"
    ? {
        heroNotice: "当前演示模式不提供账号与权限维护能力。",
        bodyNotice: "请连接持久化后端后再进行管理员账号维护。",
      }
    : {
        heroNotice: "当前演示模式不提供 AI 接入能力。",
        bodyNotice: "请连接持久化后端后再进行模型连接与密钥维护。",
      };
}

function resolveSystemSettingsLandingCopy(section: WorkbenchSettingsSection): { title: string; summary: string; emphasis: string } {
  return section === "accounts"
    ? {
        title: "账号与权限",
        summary: "集中维护内测环境账号、角色权限，以及访问策略。",
        emphasis: "优先关注账号状态与角色权限配置。",
      }
    : {
        title: "AI 接入",
        summary: "集中维护模型连接、密钥轮换与接入策略。",
        emphasis: "优先关注模型连接状态与密钥健康度。",
      };
}

function resolveSystemSettingsLoadingMessage(section: WorkbenchSettingsSection): string {
  return section === "accounts" ? "正在加载账号与权限..." : "正在加载 AI 接入配置...";
}

function buildCreateModelFormState(overview: SystemSettingsWorkbenchOverview | null | undefined): CreateModelFormState {
  return {
    modelName: "",
    connectionId: overview?.selectedConnectionId ?? overview?.providerConnections[0]?.id ?? "",
    allowedModules: ["screening"],
    productionAllowed: true,
    fallbackModelId: "",
  };
}

function buildModuleDefaultFormStateMap(moduleDefaults: SystemSettingsModuleDefaultViewModel[]): ModuleDefaultFormStateMap {
  return {
    screening: buildModuleDefaultFormState(moduleDefaults, "screening"),
    editing: buildModuleDefaultFormState(moduleDefaults, "editing"),
    proofreading: buildModuleDefaultFormState(moduleDefaults, "proofreading"),
  };
}

function buildModuleDefaultFormState(moduleDefaults: SystemSettingsModuleDefaultViewModel[], moduleKey: SystemSettingsModuleKey): ModuleDefaultFormState {
  const record = moduleDefaults.find((item) => item.moduleKey === moduleKey);
  return {
    primaryModelId: record?.primaryModelId ?? "",
    fallbackModelId: record?.fallbackModelId ?? "",
    temperature: typeof record?.temperature === "number" ? record.temperature.toString() : "",
  };
}

function formatAllowedModulesLabel(modules: SystemSettingsModuleKey[]): string {
  return modules.length > 0 ? modules.map((moduleKey) => resolveModuleLabel(moduleKey)).join(" / ") : "模块待配置";
}

function formatTemperatureLabel(temperature: number | null | undefined): string {
  return typeof temperature === "number" ? `温度 ${temperature}` : "温度待配置";
}

function resolveModuleLabel(moduleKey: SystemSettingsModuleKey): string {
  return moduleOptions.find((option) => option.value === moduleKey)?.label ?? moduleKey;
}

function formatRoleLabel(role: AuthRole): string {
  switch (role) {
    case "admin":
      return "管理员";
    case "screener":
      return "初筛";
    case "editor":
      return "编辑";
    case "proofreader":
      return "校对";
    case "knowledge_reviewer":
      return "知识审核";
    default:
      return "普通用户";
  }
}

function formatStatusLabel(status: "active" | "disabled" | "locked"): string {
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

function formatConnectionTestStatusLabel(status: SystemSettingsAiProviderConnectionViewModel["last_test_status"]): string {
  switch (status) {
    case "passed":
      return "已通过";
    case "failed":
      return "失败";
    default:
      return "未测试";
  }
}

function readTestModelName(connection: SystemSettingsAiProviderConnectionViewModel | null | undefined): string | null {
  const rawValue = connection?.connection_metadata?.test_model_name;
  return typeof rawValue === "string" && rawValue.trim().length > 0 ? rawValue : null;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function parseTemperature(value: string): number | undefined | "invalid" {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : "invalid";
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof BrowserHttpClientError) {
    const responseBody = typeof error.responseBody === "string" ? error.responseBody : JSON.stringify(error.responseBody);
    return `${fallback}：HTTP ${error.status} ${responseBody}`;
  }
  return error instanceof Error ? error.message : fallback;
}
