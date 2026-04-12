import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { AuthSessionViewModel } from "../features/auth/index.ts";
import type { AuthHttpClient } from "../features/auth/auth-api.ts";
import {
  BrowserHttpClientError,
  createBrowserHttpClient,
} from "../lib/browser-http-client.ts";
import {
  bootstrapPersistentWorkbenchSession,
  loginPersistentWorkbenchSession,
  logoutPersistentWorkbenchSession,
} from "./persistent-session.ts";

export interface PersistentAuthShellProps {
  client?: AuthHttpClient;
  renderAuthenticated: (input: {
    session: AuthSessionViewModel;
    onLogout: () => Promise<void>;
    isLogoutPending: boolean;
    noticeMessage: string | null;
  }) => ReactNode;
}

export type PersistentAuthShellViewState =
  | {
      kind: "bootstrapping";
    }
  | {
      kind: "bootstrap-error";
      message: string;
    }
  | {
      kind: "unauthenticated";
      username: string;
      password: string;
      isLoginPending: boolean;
      loginErrorMessage: string | null;
    }
  | {
      kind: "authenticated";
      session: AuthSessionViewModel;
      isLogoutPending: boolean;
      noticeMessage: string | null;
    };

export interface PersistentAuthShellViewProps {
  state: PersistentAuthShellViewState;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRetry: () => void;
  onLogout: () => void | Promise<void>;
  renderAuthenticated: PersistentAuthShellProps["renderAuthenticated"];
}

export function PersistentAuthShell({
  client,
  renderAuthenticated,
}: PersistentAuthShellProps) {
  const [httpClient] = useState<AuthHttpClient>(() => client ?? createBrowserHttpClient());
  const [phase, setPhase] = useState<
    "bootstrapping" | "bootstrap-error" | "unauthenticated" | "authenticated"
  >("bootstrapping");
  const [session, setSession] = useState<AuthSessionViewModel | null>(null);
  const [bootstrapErrorMessage, setBootstrapErrorMessage] = useState<string | null>(null);
  const [loginErrorMessage, setLoginErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [isLoginPending, setIsLoginPending] = useState(false);
  const [isLogoutPending, setIsLogoutPending] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [bootstrapVersion, setBootstrapVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setPhase("bootstrapping");
    setBootstrapErrorMessage(null);

    void bootstrapPersistentWorkbenchSession(httpClient)
      .then((nextSession) => {
        if (cancelled) {
          return;
        }

        if (nextSession == null) {
          setSession(null);
          setPassword("");
          setNoticeMessage(null);
          setPhase("unauthenticated");
          return;
        }

        setSession(nextSession);
        setUsername(nextSession.username);
        setPassword("");
        setLoginErrorMessage(null);
        setNoticeMessage(null);
        setPhase("authenticated");
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setSession(null);
        setBootstrapErrorMessage(
          toErrorMessage(error, "当前无法恢复后台工作会话，请稍后重试。"),
        );
        setPhase("bootstrap-error");
      });

    return () => {
      cancelled = true;
    };
  }, [bootstrapVersion, httpClient]);

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoginPending) {
      return;
    }

    setIsLoginPending(true);
    setLoginErrorMessage(null);

    try {
      const nextSession = await loginPersistentWorkbenchSession(httpClient, {
        username: username.trim(),
        password,
      });
      setSession(nextSession);
      setUsername(nextSession.username);
      setPassword("");
      setNoticeMessage(null);
      setPhase("authenticated");
    } catch (error) {
      setLoginErrorMessage(toErrorMessage(error, "登录失败，请检查账号、密码与网络后重试。"));
      setPhase("unauthenticated");
    } finally {
      setIsLoginPending(false);
    }
  }

  async function handleLogout(): Promise<void> {
    if (!session || isLogoutPending) {
      return;
    }

    setIsLogoutPending(true);

    try {
      await logoutPersistentWorkbenchSession(httpClient);
      setUsername(session.username);
      setPassword("");
      setLoginErrorMessage(null);
      setNoticeMessage(null);
      setSession(null);
      setPhase("unauthenticated");
    } catch (error) {
      setNoticeMessage(toErrorMessage(error, "当前无法退出登录，请稍后重试。"));
      setPhase("authenticated");
    } finally {
      setIsLogoutPending(false);
    }
  }

  return (
    <PersistentAuthShellView
      state={resolveViewState()}
      onUsernameChange={(value) => {
        setUsername(value);
        if (loginErrorMessage) {
          setLoginErrorMessage(null);
        }
      }}
      onPasswordChange={(value) => {
        setPassword(value);
        if (loginErrorMessage) {
          setLoginErrorMessage(null);
        }
      }}
      onSubmit={handleLoginSubmit}
      onRetry={() => {
        setBootstrapErrorMessage(null);
        setBootstrapVersion((current) => current + 1);
      }}
      onLogout={handleLogout}
      renderAuthenticated={renderAuthenticated}
    />
  );

  function resolveViewState(): PersistentAuthShellViewState {
    switch (phase) {
      case "bootstrapping":
        return {
          kind: "bootstrapping",
        };
      case "bootstrap-error":
        return {
          kind: "bootstrap-error",
          message: bootstrapErrorMessage ?? "当前无法恢复后台工作会话，请稍后重试。",
        };
      case "authenticated":
        if (session == null) {
          return {
            kind: "bootstrapping",
          };
        }

        return {
          kind: "authenticated",
          session,
          isLogoutPending,
          noticeMessage,
        };
      case "unauthenticated":
      default:
        return {
          kind: "unauthenticated",
          username,
          password,
          isLoginPending,
          loginErrorMessage,
        };
    }
  }
}

export function PersistentAuthShellView({
  state,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
  onRetry,
  onLogout,
  renderAuthenticated,
}: PersistentAuthShellViewProps) {
  switch (state.kind) {
    case "bootstrapping":
      return (
        <main className="app-shell">
          <section className="auth-card" role="status" aria-live="polite">
            <AuthShellBrand
              title="正在恢复工作会话"
              description="正在恢复当前后台工作会话，完成后将进入编辑部工作台。"
            />
          </section>
        </main>
      );
    case "bootstrap-error":
      return (
        <main className="app-shell">
          <section className="auth-card" role="alert">
            <AuthShellBrand title="工作会话恢复失败" />
            <p>{state.message}</p>
            <div className="auth-actions">
              <button
                type="button"
                className="workbench-secondary-action"
                onClick={onRetry}
              >
                重新检查会话
              </button>
            </div>
          </section>
        </main>
      );
    case "authenticated":
      return renderAuthenticated({
        session: state.session,
        onLogout: async () => {
          await onLogout();
        },
        isLogoutPending: state.isLogoutPending,
        noticeMessage: state.noticeMessage,
      });
    case "unauthenticated":
      return (
        <main className="app-shell app-shell-auth">
          <div className="auth-shell">
            <section className="auth-shell-hero" aria-label="系统介绍">
              <div className="auth-shell-hero-copy">
                <AuthShellBrand
                  title="为筛查、编辑、校对与知识入库提供稳定一致的工作入口"
                  description="面向医学稿件处理场景打造的专业工作台，让高频流程更聚焦，协作与回收更顺畅。"
                />
                <p className="auth-shell-hero-summary">
                  登录后进入初筛、编辑、校对与知识库工作区。
                </p>
                <div className="auth-shell-hero-metrics" aria-label="系统特点">
                  <article className="auth-shell-metric">
                    <span>队列优先</span>
                    <strong>批量筛查与单稿处理分层协同</strong>
                  </article>
                  <article className="auth-shell-metric">
                    <span>知识回流</span>
                    <strong>规则中心、知识库与复盘闭环统一归集</strong>
                  </article>
                  <article className="auth-shell-metric">
                    <span>风控可见</span>
                    <strong>AI 识别、风险提示与人工修订保持同屏</strong>
                  </article>
                </div>
              </div>
              <div className="auth-shell-visual" aria-hidden="true">
                <div className="auth-shell-visual-ring auth-shell-visual-ring-primary" />
                <div className="auth-shell-visual-ring auth-shell-visual-ring-secondary" />
                <div className="auth-shell-visual-grid">
                  <div className="auth-shell-visual-card">
                    <span>稿件队列</span>
                    <strong>初筛 / 编辑 / 校对</strong>
                  </div>
                  <div className="auth-shell-visual-card is-highlight">
                    <span>协作与回收区</span>
                    <strong>知识库 · 规则中心 · 质量优化</strong>
                  </div>
                  <div className="auth-shell-visual-card">
                    <span>AI 路由</span>
                    <strong>模型接入与 Harness 控制独立治理</strong>
                  </div>
                </div>
              </div>
            </section>

            <section className="auth-card auth-shell-card">
              <header className="auth-card-header">
                <p className="auth-card-kicker">安全登录</p>
                <h1>编辑部工作台登录</h1>
                <p>使用已授权账号进入当前内测系统。</p>
              </header>

              <form className="auth-form" onSubmit={onSubmit}>
                <label className="auth-field">
                  <span>账号</span>
                  <input
                    className="auth-input"
                    type="text"
                    name="username"
                    autoComplete="username"
                    value={state.username}
                    onChange={(event) => onUsernameChange(event.target.value)}
                    disabled={state.isLoginPending}
                    required
                  />
                </label>

                <label className="auth-field">
                  <span>密码</span>
                  <input
                    className="auth-input"
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    value={state.password}
                    onChange={(event) => onPasswordChange(event.target.value)}
                    disabled={state.isLoginPending}
                    required
                  />
                </label>

                {state.loginErrorMessage ? (
                  <p className="auth-error-message" role="alert">
                    {state.loginErrorMessage}
                  </p>
                ) : null}

                <div className="auth-actions">
                  <button
                    type="submit"
                    className="auth-primary-action"
                    disabled={state.isLoginPending}
                  >
                    {state.isLoginPending ? "登录中..." : "登录"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        </main>
      );
  }
}

interface AuthShellBrandProps {
  title: string;
  description?: string;
}

function AuthShellBrand({ title, description }: AuthShellBrandProps) {
  return (
    <div className="auth-shell-brand">
      <p className="auth-shell-brand-eyebrow">医学稿件处理系统</p>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof BrowserHttpClientError) {
    const payloadMessage = readErrorPayloadMessage(error.responseBody);
    if (payloadMessage) {
      return payloadMessage;
    }

    return `${fallback} (${error.status})`;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  return fallback;
}

function readErrorPayloadMessage(responseBody: unknown): string | null {
  if (!responseBody || typeof responseBody !== "object") {
    return null;
  }

  const message =
    readStringProperty(responseBody, "message") ??
    readStringProperty(responseBody, "error");
  return message?.trim() || null;
}

function readStringProperty(
  value: object,
  key: "message" | "error",
): string | null {
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" ? candidate : null;
}
