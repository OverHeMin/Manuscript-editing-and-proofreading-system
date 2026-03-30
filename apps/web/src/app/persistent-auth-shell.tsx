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
          toErrorMessage(error, "Unable to restore the current backend session."),
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
      setLoginErrorMessage(toErrorMessage(error, "Sign-in failed."));
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
      setNoticeMessage(toErrorMessage(error, "Unable to sign out right now."));
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
          message: bootstrapErrorMessage ?? "Unable to restore the current backend session.",
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
            <h1>Restoring Session</h1>
            <p>
              Checking the current backend session before the workbench loads.
            </p>
          </section>
        </main>
      );
    case "bootstrap-error":
      return (
        <main className="app-shell">
          <section className="auth-card" role="alert">
            <h1>Session Bootstrap Failed</h1>
            <p>{state.message}</p>
            <div className="auth-actions">
              <button
                type="button"
                className="workbench-secondary-action"
                onClick={onRetry}
              >
                Retry Session Check
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
        <main className="app-shell">
          <section className="auth-card">
            <header className="auth-card-header">
              <h1>Persistent Workbench Sign-In</h1>
              <p>
                Sign in with a backend account to load the persistent review workbenches.
              </p>
            </header>

            <form className="auth-form" onSubmit={onSubmit}>
              <label className="auth-field">
                <span>Username</span>
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
                <span>Password</span>
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
                  {state.isLoginPending ? "Signing in..." : "Sign in"}
                </button>
              </div>
            </form>
          </section>
        </main>
      );
  }
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
